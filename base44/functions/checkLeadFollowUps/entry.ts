import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Garante que leads aguardando retorno recebam um follow-up automático via
// WhatsApp no prazo correto. Disparado diariamente pelo workflow "LeadFollowUpCheck".

const FOLLOW_UP_DAYS = 2;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const today = new Date().toISOString().slice(0, 10);
    const leads = await base44.asServiceRole.entities.Lead.filter({ stage: 'aguardando_retorno' });
    const due = leads.filter((l) => l.next_contact && l.next_contact <= today && l.phone);

    let sent = 0;
    const errors: Array<{ lead_id: string; error: string }> = [];

    for (const lead of due) {
      const message = `Olá ${lead.name}, tudo bem? Passando para saber se você ainda tem interesse ${lead.plan_interest ? `no plano ${lead.plan_interest}` : 'em nossos planos'}. Posso te ajudar com mais alguma informação?`;
      const res = await base44.functions.invoke('evolutionApi', { action: 'send_message', phone: lead.phone, message }).catch((e) => ({ data: { error: e.message } }));
      const ok = !!res?.data?.success;

      if (ok) {
        const nextContactDate = new Date(Date.now() + FOLLOW_UP_DAYS * 86_400_000).toISOString().slice(0, 10);
        await base44.asServiceRole.entities.Lead.update(lead.id, { next_contact: nextContactDate });
        sent++;
      } else {
        errors.push({ lead_id: lead.id, error: res?.data?.error || 'falha ao enviar mensagem' });
      }
    }

    await base44.asServiceRole.entities.IntegrationLog.create({
      integration: 'crmApi',
      action: 'check_lead_followups',
      status: errors.length ? 'falha' : 'sucesso',
      details: `verificados: ${due.length}, enviados: ${sent}, falhas: ${errors.length}`,
    }).catch(() => {});

    return Response.json({ success: true, checked: due.length, sent, errors });
  } catch (error) {
    await base44.asServiceRole.entities.ErrorLog.create({ function_name: 'checkLeadFollowUps', error_message: error.message }).catch(() => {});
    return Response.json({ error: error.message }, { status: 500 });
  }
});