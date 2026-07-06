import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Verifica diariamente os contratos próximos ao vencimento no IXC e envia
// uma mensagem personalizada via WhatsApp (Evolution API) lembrando o cliente da renovação.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const origin = new URL(req.url).origin;

    const contratosRes = await fetch(origin + '/functions/ixcApi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('Authorization') || '' },
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
      if (!c.renewal_date || !c.phone) return false;
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

      const message = `Olá ${c.customer_name}, seu contrato${c.plan_name ? ` do plano ${c.plan_name}` : ''} vence em ${new Date(c.renewal_date).toLocaleDateString('pt-BR')}. Para continuar aproveitando seus serviços sem interrupção, entre em contato conosco para renovar!`;

      const sendRes = await fetch(origin + '/functions/evolutionApi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('Authorization') || '' },
        body: JSON.stringify({ action: 'send_message', phone: c.phone, message }),
      });
      const sendRawText = await sendRes.text();
      let sendData;
      try { sendData = JSON.parse(sendRawText); } catch { sendData = { error: sendRawText }; }

      await base44.asServiceRole.entities.ReminderLog.create({
        invoice_id: c.id,
        customer_name: c.customer_name,
        phone: c.phone,
        due_date: c.renewal_date,
        rule: 'renovacao_contrato',
        status: sendData?.success ? 'enviado' : 'falha',
      });

      if (sendData?.success) sentCount++;
      else errors.push({ contract_id: c.id, error: sendData?.error });
    }

    await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'evolutionApi', action: 'sendContractRenewalReminders', status: errors.length ? 'falha' : 'sucesso', details: `enviados: ${sentCount}, proximos: ${proximos.length}` });
    return Response.json({ success: true, sent: sentCount, total_upcoming: proximos.length, errors });
  } catch (error) {
    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.ErrorLog.create({ function_name: 'sendContractRenewalReminders', error_message: error.message }).catch(() => {});
    return Response.json({ error: error.message }, { status: 500 });
  }
});