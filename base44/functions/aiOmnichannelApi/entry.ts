import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const REQUIRED = ['AI_PROVIDER', 'AI_API_KEY'];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const missing = REQUIRED.filter((key) => !Deno.env.get(key));
  const ready = missing.length === 0;
  const mode = String(body.mode || 'suggestion');
  const safeMode = mode === 'auto_reply' && body.confirm_auto_reply !== true ? 'suggestion' : mode;
  const action = String(body.action || 'test_connection');
  await base44.asServiceRole.entities.IntegrationLog.create({
    integration: 'aiOmnichannelApi',
    action,
    status: 'sucesso',
    details: ready ? `IA configurada em modo ${safeMode}` : `IA pendente: ${missing.join(', ')}`,
  }).catch(() => {});
  return Response.json({
    success: ready,
    service: 'ai_sales_support',
    status: ready ? 'connected' : 'pending',
    missing,
    mode: safeMode,
    modes: ['disabled', 'suggestion', 'draft', 'auto_reply'],
    auto_reply_enabled: safeMode === 'auto_reply' && body.confirm_auto_reply === true,
    supports: ['automatic_support', 'sales', 'smart_billing', 'summary', 'reply_suggestion', 'intent', 'sentiment', 'human_handoff', 'knowledge_base'],
    error: ready ? null : 'Configure AI_PROVIDER e AI_API_KEY no backend. auto_reply nunca é ativado por padrão.',
  });
});
