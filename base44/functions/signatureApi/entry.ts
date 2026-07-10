import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const REQUIRED = ['ZAPSIGN_API_TOKEN'];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const missing = REQUIRED.filter((key) => !Deno.env.get(key));
  const ready = missing.length === 0;
  const action = String(body.action || 'test_connection');
  await base44.asServiceRole.entities.IntegrationLog.create({
    integration: 'signatureApi',
    action,
    status: 'sucesso',
    details: ready ? 'Assinatura digital configurada' : `Assinatura pendente: ${missing.join(', ')}`,
  }).catch(() => {});
  return Response.json({
    success: ready,
    service: 'digital_signature',
    status: ready ? 'connected' : 'pending',
    missing,
    supports: ['send_contract', 'signature_status', 'signature_link', 'signed_webhook', 'conversation_link'],
    error: ready ? null : 'Configure ZAPSIGN_API_TOKEN no backend.',
  });
});
