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
    const vencidas = registros.filter((r) => {
      if (r.status !== 'A') return false;
      const due = r.due_date ? new Date(r.due_date) : null;
      return due && due < today;
    }).map((r) => ({
      ...r,
      days_late: Math.floor((today - new Date(r.due_date)) / 86400000),
    }));

    const alreadySent = await base44.asServiceRole.entities.NegotiationOfferLog.filter({});
    const sentIds = new Set(alreadySent.map((l) => l.invoice_id));

    let sentCount = 0;
    const errors = [];

    for (const inv of vencidas) {
      if (sentIds.has(inv.id)) continue;
      if (!inv.phone) continue;

      const message = `Olá ${inv.customer_name}, identificamos que sua fatura de R$ ${inv.value?.toFixed(2)} está em atraso (${inv.days_late} dias). Temos uma condição especial de negociação para regularizar seu contrato. Responda esta mensagem para negociar com nossa equipe.`;

      const sendRes = await fetch(origin + '/functions/evolutionApi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('Authorization') || '' },
        body: JSON.stringify({ action: 'send_message', phone: inv.phone, message }),
      });
      const sendData = await sendRes.json();

      await base44.asServiceRole.entities.NegotiationOfferLog.create({
        invoice_id: inv.id,
        customer_name: inv.customer_name,
        phone: inv.phone,
        value: inv.value,
        due_date: inv.due_date,
        days_late: inv.days_late,
        status: sendRes.ok && sendData.success ? 'enviado' : 'falha',
      });

      if (sendRes.ok && sendData.success) sentCount++;
      else errors.push({ invoice_id: inv.id, error: sendData.error });
    }

    await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'sendNegotiationOffers', action: 'run', status: errors.length ? 'falha' : 'sucesso', details: `enviados: ${sentCount}, vencidas: ${vencidas.length}` });
    return Response.json({ success: true, sent: sentCount, total_overdue: vencidas.length, errors });
  } catch (error) {
    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.ErrorLog.create({ function_name: 'sendNegotiationOffers', error_message: error.message }).catch(() => {});
    return Response.json({ error: error.message }, { status: 500 });
  }
});