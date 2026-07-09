import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const REQUIRED = ['ERP_API_URL', 'ERP_API_TOKEN'];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const missing = REQUIRED.filter((key) => !Deno.env.get(key));
  const ready = missing.length === 0;
  const action = String(body.action || 'test_connection');
  await base44.asServiceRole.entities.IntegrationLog.create({
    integration: 'erpApi',
    action,
    status: 'sucesso',
    details: ready ? 'ERP configurado' : `ERP pendente: ${missing.join(', ')}`,
  }).catch(() => {});
  return Response.json({
    success: ready,
    service: 'erp_provider',
    status: ready ? 'connected' : 'pending',
    missing,
    supports: ['customers', 'contracts', 'financial', 'tickets', 'billing'],
    error: ready ? null : 'Configure ERP_API_URL e ERP_API_TOKEN no backend.',
  });
});
