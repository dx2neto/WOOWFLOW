import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { phone, reason } = await req.json().catch(() => ({}));
    if (!phone) return Response.json({ error: 'phone é obrigatório' }, { status: 400 });

    const digits = phone.replace(/\D/g, '');
    const leads = await base44.asServiceRole.entities.Lead.filter({});
    const lead = leads.find((l) => (l.phone || '').replace(/\D/g, '') === digits);

    if (!lead) {
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'advanceCrmStage', action: reason || 'advance', status: 'falha', details: `Lead não encontrado para o telefone ${phone}` });
      return Response.json({ success: false, message: 'Lead não encontrado' });
    }

    if (lead.stage === 'venda_fechada') {
      return Response.json({ success: true, message: 'Lead já estava em venda_fechada' });
    }

    await base44.asServiceRole.entities.Lead.update(lead.id, { stage: 'venda_fechada' });
    await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'advanceCrmStage', action: reason || 'advance', status: 'sucesso', details: `Lead ${lead.id} movido para venda_fechada` });

    return Response.json({ success: true, lead_id: lead.id });
  } catch (error) {
    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.ErrorLog.create({ function_name: 'advanceCrmStage', error_message: error.message }).catch(() => {});
    return Response.json({ error: error.message }, { status: 500 });
  }
});