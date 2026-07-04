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
    const faturasData = await faturasRes.json();
    const registros = faturasData?.result?.registros || [];

    const today = new Date();
    const pendentes = registros.filter((r) => {
      if (r.status !== 'A') return false;
      const due = r.due_date ? new Date(r.due_date) : null;
      return due && due >= today;
    });

    const alreadySent = await base44.asServiceRole.entities.ReminderLog.filter({});
    const sentIds = new Set(alreadySent.map((l) => l.invoice_id));

    let sentCount = 0;
    const errors = [];

    for (const inv of pendentes) {
      if (sentIds.has(inv.id)) continue;
      if (!inv.phone) continue;

      const message = `Olá ${inv.customer_name}, sua fatura no valor de R$ ${inv.value?.toFixed(2)} vence em ${inv.due_date}. Regularize para evitar bloqueio do serviço.`;

      const sendRes = await fetch(origin + '/functions/evolutionApi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('Authorization') || '' },
        body: JSON.stringify({ action: 'send_message', phone: inv.phone, message }),
      });
      const sendData = await sendRes.json();

      await base44.asServiceRole.entities.ReminderLog.create({
        invoice_id: inv.id,
        customer_name: inv.customer_name,
        phone: inv.phone,
        value: inv.value,
        due_date: inv.due_date,
        status: sendRes.ok && sendData.success ? 'enviado' : 'falha',
      });

      if (sendRes.ok && sendData.success) sentCount++;
      else errors.push({ invoice_id: inv.id, error: sendData.error });
    }

    return Response.json({ success: true, sent: sentCount, total_pending: pendentes.length, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});