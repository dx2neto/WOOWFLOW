import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Régua de cobrança configurável: lê as regras ativas em BillingRule e envia
// lembretes via WhatsApp de acordo com o offset de dias em relação ao vencimento.

function fillTemplate(template, inv) {
  return template
    .replace(/{customer_name}/g, inv.customer_name || '')
    .replace(/{value}/g, (inv.value || 0).toFixed(2))
    .replace(/{due_date}/g, inv.due_date || '');
}

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

    const rules = await base44.asServiceRole.entities.BillingRule.filter({ active: true });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alreadySent = await base44.asServiceRole.entities.ReminderLog.filter({});
    const sentKeys = new Set(alreadySent.map((l) => `${l.rule}:${l.invoice_id}`));

    let sentCount = 0;
    const errors = [];

    for (const inv of registros) {
      if (inv.status !== 'A' || !inv.due_date || !inv.phone) continue;
      const due = new Date(inv.due_date);
      due.setHours(0, 0, 0, 0);
      const daysDiff = Math.round((due - today) / (1000 * 60 * 60 * 24));

      for (const rule of rules) {
        if (daysDiff !== rule.days_offset) continue;
        const key = `${rule.name}:${inv.id}`;
        if (sentKeys.has(key)) continue;

        const message = fillTemplate(rule.message_template, inv);
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
          rule: rule.name,
          status: sendRes.ok && sendData.success ? 'enviado' : 'falha',
        });

        if (sendRes.ok && sendData.success) sentCount++;
        else errors.push({ invoice_id: inv.id, rule: rule.name, error: sendData.error });
      }
    }

    await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'sendBillingRuleReminders', action: 'run', status: errors.length ? 'falha' : 'sucesso', details: `enviados: ${sentCount}` });
    return Response.json({ success: true, sent: sentCount, errors });
  } catch (error) {
    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.ErrorLog.create({ function_name: 'sendBillingRuleReminders', error_message: error.message }).catch(() => {});
    return Response.json({ error: error.message }, { status: 500 });
  }
});