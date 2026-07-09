import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const REQUIRED = ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_WEBHOOK_SECRET'];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const missing = REQUIRED.filter((key) => !Deno.env.get(key));
  const ready = missing.length === 0;
  const action = String(body.action || 'test_connection');
  await base44.asServiceRole.entities.IntegrationLog.create({
    integration: 'tiktokApi',
    action,
    status: 'sucesso',
    details: ready ? 'TikTok configurado' : `TikTok pendente: ${missing.join(', ')}`,
  }).catch(() => {});
  return Response.json({
    success: ready,
    service: 'tiktok',
    status: ready ? 'connected' : 'pending',
    missing,
    supported_flows: ['leads', 'comments', 'forms', 'events', 'campaigns'],
    dm_limitation: 'Atendimento via DM depende da permissão/API disponível para a conta TikTok.',
    error: ready ? null : 'Configure as variáveis TIKTOK_* no backend.',
  });
});
