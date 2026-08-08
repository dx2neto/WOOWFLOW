import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sendWhatsAppMessage } from '../../shared/evolutionSend.ts';
import { logError } from '../../shared/errorLogger.ts';

// Envia lembrete via WhatsApp para assinaturas ZapSign pendentes há mais de 24h.
// Usa whatsapp_sent_at para evitar reenvio duplicado no mesmo ciclo de 24h.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const internalToken = Deno.env.get('INTERNAL_FUNCTION_TOKEN') || '';
    const internalOk = internalToken !== '' && req.headers.get('x-internal-token') === internalToken;
    if (!user && !internalOk) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const evoBase = Deno.env.get('EVOLUTION_API_URL') || '';
    const evoKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    const instance = Deno.env.get('EVOLUTION_INSTANCE_NAME') || '';

    // Busca todas as assinaturas pendentes
    const pending = await base44.asServiceRole.entities.SignatureRequest
      .filter({ status: 'pendente' }, '-created_date', 200)
      .catch(() => []);

    const now = Date.now();
    const cutoff = 24 * 60 * 60 * 1000; // 24h

    // Filtra: criado há mais de 24h E (nunca enviado lembrete OU último lembrete há mais de 24h)
    const toRemind = (pending || []).filter((doc) => {
      const createdAt = new Date(doc.created_date || doc.created_at || now).getTime();
      if (now - createdAt < cutoff) return false; // ainda não completou 24h
      if (!doc.whatsapp_sent) return true; // nunca recebeu lembrete
      const lastSent = new Date(doc.whatsapp_sent_at || 0).getTime();
      return now - lastSent >= cutoff; // último lembrete foi há mais de 24h
    });

    let sentCount = 0;
    const errors = [];

    for (const doc of toRemind) {
      if (!doc.phone || !doc.sign_url) continue;
      const phone = String(doc.phone).replace(/\D/g, '');
      if (phone.length < 10) continue;

      const firstName = (doc.customer_name || 'Cliente').split(' ')[0];
      const docType = doc.document_type === 'termo_adesao' ? 'termo de adesão'
        : doc.document_type === 'termo_comodato' ? 'termo de comodato'
        : doc.document_type === 'termo_permanencia' ? 'termo de permanência'
        : 'contrato';

      const msg = [
        `Olá ${firstName}! 📋`,
        '',
        `Identificamos que seu ${docType} ainda está pendente de assinatura.`,
        'Para concluir, basta acessar o link abaixo:',
        '',
        doc.sign_url,
        '',
        '⏰ O documento expira em breve. Caso já tenha assinado, desconsidere esta mensagem.',
        'Em caso de dúvidas, estamos à disposição!',
      ].join('\n');

      const result = await sendWhatsAppMessage({
        base: evoBase, apiKey: evoKey, instanceName: instance,
        number: phone, text: msg,
      });

      // Atualiza o registro com o status do envio
      await base44.asServiceRole.entities.SignatureRequest.update(doc.id, {
        whatsapp_sent: result.success,
        whatsapp_sent_at: new Date().toISOString(),
        whatsapp_instance: instance || undefined,
      });

      if (result.success) sentCount++;
      else errors.push({ id: doc.id, phone, error: result.error });
    }

    await base44.asServiceRole.entities.IntegrationLog.create({
      integration: 'zapsignApi',
      action: 'signature_reminder_24h',
      status: errors.length === toRemind.length && toRemind.length > 0 ? 'falha' : 'sucesso',
      details: `lembretes enviados: ${sentCount}/${toRemind.length}`,
    });

    return Response.json({ success: true, sent: sentCount, total_pending: pending.length, eligible: toRemind.length, errors });
  } catch (error) {
    const base44 = createClientFromRequest(req);
    await logError(base44, 'sendSignatureReminders', error, { action: 'run', severity: 'alta' });
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});