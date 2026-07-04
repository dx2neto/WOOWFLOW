import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const origin = new URL(req.url).origin;
    const faturasRes = await fetch(origin + '/functions/ixcApi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('Authorization') || '' },
      body: JSON.stringify({ action: 'faturas' }),
    });
    const faturasRawText = await faturasRes.text();
    let faturasData;
    try { faturasData = JSON.parse(faturasRawText); } catch { faturasData = { error: faturasRawText }; }
    const registros = faturasData?.result?.registros || [];

    const today = new Date();
    const pendentes = registros.filter((r) => {
      if (r.status !== 'A') return false;
      const due = r.due_date ? new Date(r.due_date) : null;
      if (!due) return false;
      const daysLate = Math.floor((today - due) / (1000 * 60 * 60 * 24));
      return daysLate > 5;
    });

    const alreadySent = await base44.asServiceRole.entities.ReminderLog.filter({});
    const sentIds = new Set(alreadySent.map((l) => l.invoice_id));

    let sentCount = 0;
    const errors = [];

    for (const inv of pendentes) {
      if (sentIds.has(inv.id)) continue;
      if (!inv.phone) continue;

      const message = `Olá ${inv.customer_name}, sua fatura no valor de R$ ${inv.value?.toFixed(2)}, vencida em ${inv.due_date}, está em atraso. Regularize para evitar bloqueio do serviço.`;

      const sendRes = await fetch(origin + '/functions/evolutionApi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('Authorization') || '' },
        body: JSON.stringify({ action: 'send_message', phone: inv.phone, message }),
      });
      const sendRawText = await sendRes.text();
      let sendData;
      try { sendData = JSON.parse(sendRawText); } catch { sendData = { error: sendRawText }; }

      await base44.asServiceRole.entities.ReminderLog.create({
        invoice_id: inv.id,
        customer_name: inv.customer_name,
        phone: inv.phone,
        value: inv.value,
        due_date: inv.due_date,
        status: sendData?.success ? 'enviado' : 'falha',
      });

      if (sendData?.success) sentCount++;
      else errors.push({ invoice_id: inv.id, error: sendData?.error });
    }

    await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'sendPaymentReminders', action: 'run', status: errors.length ? 'falha' : 'sucesso', details: `enviados: ${sentCount}, pendentes: ${pendentes.length}` });
    return Response.json({ success: true, sent: sentCount, total_pending: pendentes.length, errors });
  } catch (error) {
    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.ErrorLog.create({ function_name: 'sendPaymentReminders', error_message: error.message }).catch(() => {});
    return Response.json({ error: error.message }, { status: 500 });
  }
});