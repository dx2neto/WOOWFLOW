import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { logError } from '../../shared/errorLogger.ts';

// Envia confirmações de instalação via WhatsApp para OS agendadas do dia.
// Consulta OS de instalação no IXCSoft e dispara mensagem automática ao cliente.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Aceita disparo por usuário autenticado (manual) OU pelo agendador
    // via token interno compartilhado — evita expor envio em massa a anônimos.
    const user = await base44.auth.me().catch(() => null);
    const internalToken = Deno.env.get('INTERNAL_FUNCTION_TOKEN') || '';
    const internalOk = internalToken !== '' && req.headers.get('x-internal-token') === internalToken;
    if (!user && !internalOk) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const internalHeaders = {
      'Content-Type': 'application/json',
      Authorization: req.headers.get('Authorization') || '',
      'x-internal-token': internalToken,
    };

    const origin = new URL(req.url).origin;

    // Busca OS de instalação agendadas para hoje no IXCSoft
    const osRes = await fetch(origin + '/functions/ixcApi', {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify({ action: 'os', limit: 200 }),
    });
    const osData = await osRes.json().catch(() => ({}));
    if (!osRes.ok) {
      await logError(base44, 'sendInstallationReminders', new Error('ixcApi os failed: ' + (osData?.error || osRes.status)), { action: 'fetch_os', severity: 'media' });
    }
    const ordens = osData?.data || osData?.result?.registros || [];

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

    // Filtra OS de instalação agendadas para hoje
    const instalacoes = ordens.filter((o) => {
      if (!o.phone) return false;
      const subject = (o.subject || '').toLowerCase();
      const isInstalacao = subject.includes('instal') || subject.includes('ativ') || subject.includes('conex') || o.type === 'instalacao';
      if (!isInstalacao) return false;
      if (o.status === 'C' || o.status === 'F') return false; // cancelada ou fechada
      const scheduled = o.scheduled_date || o.data_agenda || o.agendamento;
      if (!scheduled) return false;
      return String(scheduled).split('T')[0] === todayStr;
    });

    // Evita reenvio: checa ReminderLog com invoice_id = OS ID e rule = 'instalacao'
    const alreadySent = await base44.asServiceRole.entities.ReminderLog.filter({ rule: 'instalacao', status: 'enviado' });
    const sentOsIds = new Set(alreadySent.map((l) => l.invoice_id));

    let sentCount = 0;
    const errors = [];

    for (const os of instalacoes) {
      const osId = String(os.id);
      if (sentOsIds.has(osId)) continue;

      const customerName = os.customer_name || os.cliente || 'Cliente';
      const scheduledTime = os.scheduled_date || os.data_agenda || os.agendamento || '';
      const timeStr = scheduledTime ? new Date(scheduledTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'horário a confirmar';
      const techName = os.tech_name || os.tecnico || '';

      const msg = [
        'Olá ' + customerName + '! 👋',
        '',
        'Sua instalação de internet está confirmada para hoje, às ' + timeStr + '.',
        techName ? ('Técnico responsável: ' + techName + '.') : '',
        '',
        'Nossa equipe está a caminho! Caso precise reagendar, responda esta mensagem.',
      ].filter(Boolean).join('\n');

      const sendRes = await fetch(origin + '/functions/evolutionApi', {
        method: 'POST',
        headers: internalHeaders,
        body: JSON.stringify({ action: 'send_message', phone: os.phone, message: msg }),
      });
      const sendData = await sendRes.json();

      await base44.asServiceRole.entities.ReminderLog.create({
        invoice_id: osId,
        customer_name: customerName,
        phone: os.phone,
        value: 0,
        due_date: scheduledTime.split('T')[0] || todayStr,
        rule: 'instalacao',
        status: sendRes.ok && sendData.success ? 'enviado' : 'falha',
      });

      if (sendRes.ok && sendData.success) sentCount++;
      else errors.push({ os_id: osId, error: sendData.error });
    }

    await base44.asServiceRole.entities.IntegrationLog.create({
      integration: 'sendPaymentReminders',
      action: 'instalacao_reminder',
      status: errors.length ? 'falha' : 'sucesso',
      details: 'instalacoes enviadas: ' + sentCount,
    });

    return Response.json({ success: true, sent: sentCount, total_instalacoes: instalacoes.length, errors });
  } catch (error) {
    const base44 = createClientFromRequest(req);
    await logError(base44, 'sendInstallationReminders', error, { action: 'run', severity: 'alta' });
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});