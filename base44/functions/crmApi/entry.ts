import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'test_connection');
  await base44.asServiceRole.entities.IntegrationLog.create({
    integration: 'crmApi',
    action,
    status: 'sucesso',
    details: 'CRM interno disponível',
  }).catch(() => {});
  return Response.json({
    success: true,
    service: 'crm',
    status: 'connected',
    supports: ['leads', 'opportunities', 'pipeline', 'owner', 'lead_source', 'conversation_history'],
  });
});
