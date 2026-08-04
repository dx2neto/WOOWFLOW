import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

export default async function(req: Request): Promise<Response> {
  const b44 = createClientFromRequest(req);
  try {
    // Permite chamada por usuário autenticado OU por workflow/agendador (token interno)
    const user = await b44.auth.me().catch(() => null);
    const internalToken = Deno.env.get('INTERNAL_FUNCTION_TOKEN') || '';
    const internalOk = internalToken !== '' && req.headers.get('x-internal-token') === internalToken;
    if (!user && !internalOk) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { signature_request_id } = body;

    if (!signature_request_id) {
      return Response.json({ error: 'signature_request_id obrigatório' }, { status: 400 });
    }

    const doc = await b44.asServiceRole.entities.SignatureRequest.get(signature_request_id);
    if (!doc) {
      return Response.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    const evoBase   = Deno.env.get('EVOLUTION_API_URL') || 'https://evolution-go-9b1u.srv1772067.hstgr.cloud';
    const evoKey    = Deno.env.get('EVOLUTION_API_KEY') || '';
    const evoInst   = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'CONNECT';
    const commercialPhone = Deno.env.get('COMMERCIAL_SECTOR_PHONE') || '';

    const origin = new URL(req.url).origin;
    const internalHeaders = {
      'Content-Type': 'application/json',
      'Authorization': req.headers.get('Authorization') || '',
      'x-internal-token': internalToken,
    };

    const docTypeLabel: Record<string, string> = {
      contrato: 'contrato',
      termo_adesao: 'termo de adesão',
      termo_comodato: 'termo de comodato',
      termo_permanencia: 'termo de permanência',
      aceite_eletronico: 'aceite eletrônico',
      aditivo: 'aditivo',
    };
    const docLabel = docTypeLabel[doc.document_type] || 'documento';
    const customerName = doc.customer_name || 'Cliente';
    const planInfo = doc.plan_name ? ` referente ao plano ${doc.plan_name}` : '';
    const docUrl = doc.document_url || doc.sign_url || '';

    let customerSent = false;
    let commercialSent = false;
    const errors: string[] = [];

    // ── 1. Notificar o cliente ──────────────────────────────────────────────
    const customerPhone = doc.phone?.replace(/\D/g, '');
    if (customerPhone) {
      const customerMsg = `Olá, ${customerName}! ✅\n\nSeu ${docLabel}${planInfo} foi assinado com sucesso e está concluído.${docUrl ? `\n\nVocê pode acessar o documento através do link:\n${docUrl}` : ''}\n\nAgradecemos a confiança! Em breve nossa equipe entrará em contato para os próximos passos.`;

      try {
        const sendRes = await fetch(origin + '/functions/evolutionApi', {
          method: 'POST',
          headers: internalHeaders,
          body: JSON.stringify({
            action: 'send_message',
            phone: customerPhone,
            message: customerMsg,
            instance: evoInst,
          }),
        });
        const sendRaw = await sendRes.text();
        let sendData;
        try { sendData = JSON.parse(sendRaw); } catch { sendData = { error: sendRaw }; }
        customerSent = !!sendData?.success;
        if (!customerSent) errors.push(`cliente: ${sendData?.error || 'falha'}`);
      } catch (e) {
        errors.push(`cliente: ${(e as Error).message}`);
      }
    } else {
      errors.push('cliente: telefone não cadastrado');
    }

    // ── 2. Notificar o setor comercial ──────────────────────────────────────
    if (commercialPhone) {
      const commercialMsg = `📋 *Contrato Assinado*\n\n*Cliente:* ${customerName}\n*Telefone:* ${customerPhone || '—'}\n*Documento:* ${docLabel}${planInfo}\n*Data:* ${new Date().toLocaleString('pt-BR')}${doc.signed_date ? `\n*Assinado em:* ${doc.signed_date}` : ''}${docUrl ? `\n*Link:* ${docUrl}` : ''}${doc.template_name ? `\n*Template:* ${doc.template_name}` : ''}\n\nEntre em contato com o cliente para dar andamento.`;

      try {
        const sendRes = await fetch(origin + '/functions/evolutionApi', {
          method: 'POST',
          headers: internalHeaders,
          body: JSON.stringify({
            action: 'send_message',
            phone: commercialPhone,
            message: commercialMsg,
            instance: evoInst,
          }),
        });
        const sendRaw = await sendRes.text();
        let sendData;
        try { sendData = JSON.parse(sendRaw); } catch { sendData = { error: sendRaw }; }
        commercialSent = !!sendData?.success;
        if (!commercialSent) errors.push(`comercial: ${sendData?.error || 'falha'}`);
      } catch (e) {
        errors.push(`comercial: ${(e as Error).message}`);
      }
    }

    // ── 3. Registrar log ────────────────────────────────────────────────────
    await b44.asServiceRole.entities.IntegrationLog.create({
      integration: 'signatureApi',
      action: 'notify_contract_signed',
      status: customerSent || commercialSent ? 'sucesso' : 'falha',
      details: `doc=${doc.id} cliente=${customerName} customer_sent=${customerSent} commercial_sent=${commercialSent}${errors.length ? ` errors=${errors.join('; ')}` : ''}`,
    });

    return Response.json({
      success: true,
      data: {
        customer_sent: customerSent,
        commercial_sent: commercialSent,
        errors: errors.length ? errors : undefined,
      },
    });
  } catch (error) {
    await b44.asServiceRole.entities.ErrorLog.create({
      function_name: 'notifyContractSigned',
      error_message: (error as Error).message,
    }).catch(() => {});
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}