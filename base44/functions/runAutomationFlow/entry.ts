import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Executa, em ordem, as etapas configuradas no editor visual de automações do CRM
// (base44/entities/AutomationFlow) para um determinado gatilho (contrato_assinado
// ou pagamento_confirmado).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { phone, trigger } = await req.json().catch(() => ({}));
    if (!phone || !trigger) return Response.json({ error: 'phone e trigger são obrigatórios' }, { status: 400 });

    const flows = await base44.asServiceRole.entities.AutomationFlow.filter({ trigger, active: true });
    const flow = flows[0];
    const steps = flow?.steps || [];

    const results = [];
    for (const step of steps) {
      if (step.type === 'avancar_crm') {
        const res = await base44.functions.invoke('advanceCrmStage', { phone, reason: trigger });
        results.push({ type: step.type, ok: !res?.data?.error });
      } else if (step.type === 'enviar_whatsapp') {
        const res = await base44.functions.invoke('evolutionApi', { action: 'send_message', phone, message: step.message || '' });
        results.push({ type: step.type, ok: !res?.data?.error });
      }
    }

    await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'runAutomationFlow', action: trigger, status: 'sucesso', details: `${steps.length} etapa(s) executadas` });
    return Response.json({ success: true, steps_executed: steps.length, results });
  } catch (error) {
    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.ErrorLog.create({ function_name: 'runAutomationFlow', error_message: error.message }).catch(() => {});
    return Response.json({ error: error.message }, { status: 500 });
  }
});