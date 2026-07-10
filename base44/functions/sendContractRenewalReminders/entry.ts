import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Verifica diariamente os contratos próximos ao vencimento no IXC, gera um documento
// de renovação no ZapSign para cada cliente e envia o link via WhatsApp (Evolution API).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Aceita disparo por usuário autenticado (trigger manual) OU pelo agendador
    // via token interno compartilhado — evita expor envio em massa a anônimos.
    const user = await base44.auth.me().catch(() => null);
    const internalToken = Deno.env.get('INTERNAL_FUNCTION_TOKEN') || '';
    const internalOk = internalToken !== '' && req.headers.get('x-internal-token') === internalToken;
    if (!user && !internalOk) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const origin = new URL(req.url).origin;
    const authHeader = req.headers.get('Authorization') || '';
    const internalHeaders = {
      'Content-Type': 'application/json',
      Authorization: authHeader,
      'x-internal-token': internalToken,
    };

    // Busca o template de renovação configurado em Assinaturas (document_type = renovacao)
    const templates = await base44.asServiceRole.entities.ContractTemplate.filter({ document_type: 'renovacao', active: true });
    const renewalTemplate = templates?.[0];

    if (!renewalTemplate) {
      return Response.json({
        success: false,
        error: 'Nenhum modelo de contrato de renovação configurado. Cadastre um modelo com tipo "Renovação" e um zapsign_template_id em Assinaturas.',
      }, { status: 400 });
    }

    const contratosRes = await fetch(origin + '/functions/ixcApi', {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify({ action: 'contratos' }),
    });
    const contratosRawText = await contratosRes.text();
    let contratosData;
    try { contratosData = JSON.parse(contratosRawText); } catch { contratosData = { error: contratosRawText }; }
    const registros = contratosData?.result?.registros || [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const DAYS_AHEAD = 7;

    const proximos = registros.filter((c) => {
      if (!c.renewal_date || !c.phone || !c.client_id) return false;
      const renewal = new Date(c.renewal_date);
      renewal.setHours(0, 0, 0, 0);
      const daysDiff = Math.round((renewal - today) / (1000 * 60 * 60 * 24));
      return daysDiff >= 0 && daysDiff <= DAYS_AHEAD;
    });

    const alreadySent = await base44.asServiceRole.entities.ReminderLog.filter({ rule: 'renovacao_contrato' });
    const sentIds = new Set(alreadySent.map((l) => l.invoice_id));

    let sentCount = 0;
    const errors = [];

    for (const c of proximos) {
      if (sentIds.has(c.id)) continue;

      const zapRes = await fetch(origin + '/functions/zapsignApi', {
        method: 'POST',
        headers: internalHeaders,
        body: JSON.stringify({
          action: 'create_from_ixc',
          ixcCustomerId: c.client_id,
          ixcContractId: c.id,
          templateId: renewalTemplate.id,
          sendWhatsApp: true,
        }),
      });
      const zapRawText = await zapRes.text();
      let zapData;
      try { zapData = JSON.parse(zapRawText); } catch { zapData = { error: zapRawText }; }

      const success = Boolean(zapData?.success);

      await base44.asServiceRole.entities.ReminderLog.create({
        invoice_id: c.id,
        customer_name: c.customer_name,
        phone: c.phone,
        due_date: c.renewal_date,
        rule: 'renovacao_contrato',
        status: success ? 'enviado' : 'falha',
      });

      if (success) sentCount++;
      else errors.push({ contract_id: c.id, error: zapData?.error });
    }

    await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'zapsignApi', action: 'sendContractRenewalReminders', status: errors.length ? 'falha' : 'sucesso', details: `enviados: ${sentCount}, proximos: ${proximos.length}` });
    return Response.json({ success: true, sent: sentCount, total_upcoming: proximos.length, errors });
  } catch (error) {
    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.ErrorLog.create({ function_name: 'sendContractRenewalReminders', error_message: error.message }).catch(() => {});
    return Response.json({ error: error.message }, { status: 500 });
  }
});