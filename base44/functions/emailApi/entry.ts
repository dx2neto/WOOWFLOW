import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const REQUIRED = ['EMAIL_IMAP_HOST', 'EMAIL_IMAP_USER', 'EMAIL_IMAP_PASSWORD', 'EMAIL_SMTP_HOST', 'EMAIL_SMTP_USER', 'EMAIL_SMTP_PASSWORD'];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const missing = REQUIRED.filter((key) => !Deno.env.get(key));
  const ready = missing.length === 0;
  const action = String(body.action || 'test_connection');
  await base44.asServiceRole.entities.IntegrationLog.create({
    integration: 'emailApi',
    action,
    status: 'sucesso',
    details: ready ? 'E-mail configurado' : `E-mail pendente: ${missing.join(', ')}`,
  }).catch(() => {});
  return Response.json({
    success: ready,
    service: 'email',
    status: ready ? 'connected' : 'pending',
    missing,
    supports: ['imap_read', 'smtp_send', 'ai_draft', 'ai_suggestion', 'priority_classification'],
    error: ready ? null : 'Configure IMAP/SMTP no backend. Gmail/Outlook OAuth pode ser ligado por conector OAuth.',
  });
});
