import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

type AnyRecord = Record<string, unknown>;

const SERVICE_ENV: Record<string, string[]> = {
  instagram: ['META_APP_ID', 'META_APP_SECRET', 'META_PAGE_ACCESS_TOKEN', 'META_VERIFY_TOKEN'],
  facebook: ['META_APP_ID', 'META_APP_SECRET', 'META_PAGE_ACCESS_TOKEN', 'META_VERIFY_TOKEN'],
  messenger: ['META_APP_ID', 'META_APP_SECRET', 'META_PAGE_ACCESS_TOKEN', 'META_VERIFY_TOKEN'],
  tiktok: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_WEBHOOK_SECRET'],
  email: ['EMAIL_IMAP_HOST', 'EMAIL_IMAP_USER', 'EMAIL_IMAP_PASSWORD', 'EMAIL_SMTP_HOST', 'EMAIL_SMTP_USER', 'EMAIL_SMTP_PASSWORD'],
  telefone: ['PABX_API_URL', 'PABX_API_TOKEN'],
  ai_assistant: ['AI_PROVIDER', 'AI_API_KEY'],
};

const MANAGED_SERVICES = new Set([
  'instagram',
  'facebook',
  'messenger',
  'tiktok',
  'email',
  'telefone',
  'chat_interno',
  'chat_externo',
  'webchat',
  'ai_assistant',
]);

function envStatus(service: string) {
  if (service === 'chat_interno' || service === 'chat_externo' || service === 'webchat') {
    return { ready: true, missing: [] as string[] };
  }
  const required = SERVICE_ENV[service] || [];
  const missing = required.filter((key) => !Deno.env.get(key));
  return { ready: required.length > 0 && missing.length === 0, missing };
}

async function upsertConfig(base44: ReturnType<typeof createClientFromRequest>, service: string, displayName: string, patch: AnyRecord = {}) {
  const status = envStatus(service);
  const payload = {
    service,
    display_name: displayName,
    status: status.ready ? 'connected' : 'pending',
    error_message: status.ready ? '' : `Configure no ambiente Base44: ${status.missing.join(', ')}`,
    last_sync: new Date().toISOString(),
    ...patch,
  };
  const existing = await base44.asServiceRole.entities.IntegrationConfig.filter({ service });
  if (existing[0]) {
    await base44.asServiceRole.entities.IntegrationConfig.update(existing[0].id, payload);
    return { ...existing[0], ...payload };
  }
  return await base44.asServiceRole.entities.IntegrationConfig.create(payload);
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'get_status');
    const service = String(body.service || '');

    if (service && !MANAGED_SERVICES.has(service)) {
      return Response.json({ success: false, error: `Serviço não suportado: ${service}` }, { status: 400 });
    }

    if (action === 'get_status' || action === 'test_connection') {
      const status = envStatus(service);
      const connected = status.ready;
      await upsertConfig(base44, service, String(body.display_name || service), {
        status: connected ? 'connected' : 'pending',
      });
      await base44.asServiceRole.entities.IntegrationLog.create({
        integration: 'omnichannelApi',
        action,
        status: 'sucesso',
        details: connected ? `${service}: pronto` : `${service}: faltando ${status.missing.join(', ')}`,
      }).catch(() => {});
      return Response.json({
        success: connected,
        service,
        connected,
        status: connected ? 'connected' : 'pending',
        missing: status.missing,
        error: connected ? null : 'Integração aguardando variáveis seguras no backend.',
      });
    }

    if (action === 'upsert_config') {
      const config = await upsertConfig(base44, service, String(body.display_name || service), {
        config: body.config && typeof body.config === 'object' ? body.config : {},
        ai_enabled: !!body.ai_enabled,
        ai_auto_reply: !!body.ai_auto_reply,
      });
      return Response.json({ success: true, config });
    }

    if (action === 'send_internal_message') {
      const conversationId = String(body.conversation_id || '');
      const content = String(body.content || '').trim();
      if (!conversationId || !content) {
        return Response.json({ success: false, error: 'conversation_id e content são obrigatórios' }, { status: 400 });
      }
      const message = await base44.asServiceRole.entities.Message.create({
        conversation_id: conversationId,
        content,
        direction: 'internal',
        type: 'text',
        status: 'sent',
        sender_name: user.full_name || user.email || 'Usuário',
        timestamp: new Date().toISOString(),
        provider: 'interno',
      });
      await base44.asServiceRole.entities.Conversation.update(conversationId, {
        last_message: content,
        last_message_time: message.timestamp,
      }).catch(() => {});
      return Response.json({ success: true, message });
    }

    if (action === 'create_webchat_conversation') {
      const customerName = String(body.customer_name || 'Visitante do site');
      const content = String(body.content || 'Olá').trim();
      const conversation = await base44.asServiceRole.entities.Conversation.create({
        customer_name: customerName,
        phone: String(body.phone || ''),
        email: String(body.email || ''),
        channel: 'webchat',
        provider: 'webchat',
        status: 'novo',
        last_message: content,
        last_message_time: new Date().toISOString(),
        unread: true,
      });
      const message = await base44.asServiceRole.entities.Message.create({
        conversation_id: conversation.id,
        content,
        direction: 'in',
        type: 'text',
        status: 'received',
        sender_name: customerName,
        timestamp: conversation.last_message_time,
        provider: 'webchat',
      });
      return Response.json({ success: true, conversation, message });
    }

    if (action === 'email_ai_suggest') {
      const status = envStatus('ai_assistant');
      if (!status.ready) {
        return Response.json({
          success: false,
          error: 'IA ainda não configurada no backend.',
          missing: status.missing,
        }, { status: 400 });
      }
      return Response.json({
        success: false,
        error: 'Conector de IA configurado, mas a geração de resposta deve ser ligada ao provedor escolhido em AI_PROVIDER.',
      }, { status: 501 });
    }

    return Response.json({ success: false, error: `Ação não suportada: ${action}` }, { status: 400 });
  } catch (error) {
    await base44.asServiceRole.entities.ErrorLog.create({
      function_name: 'omnichannelApi',
      error_message: (error as Error).message,
    }).catch(() => {});
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
});
