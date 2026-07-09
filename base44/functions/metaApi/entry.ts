import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const REQUIRED = ['META_APP_ID', 'META_APP_SECRET', 'META_PAGE_ACCESS_TOKEN', 'META_VERIFY_TOKEN'];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const service = String(body.service || 'facebook_messenger');
  const missing = REQUIRED.filter((key) => !Deno.env.get(key));
  const ready = missing.length === 0;
  const action = String(body.action || 'test_connection');
  await base44.asServiceRole.entities.IntegrationLog.create({
    integration: 'metaApi',
    action,
    status: 'sucesso',
    details: ready ? `${service}: configurado` : `${service}: faltando ${missing.join(', ')}`,
  }).catch(() => {});
  return Response.json({
    success: ready,
    service,
    status: ready ? 'connected' : 'pending',
    missing,
    oauth_ready: ready,
    webhook_ready: ready,
    error: ready ? null : 'Configure as variáveis META_* no backend para ativar OAuth, webhook e envio de respostas.',
  });
});
