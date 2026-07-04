import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Recebe eventos em tempo real da Evolution API (mensagens do WhatsApp) e
// sincroniza Conversation/Message. Configure na Evolution API o webhook URL:
// https://<seu-app>/functions/evolutionWebhook?key=<EVOLUTION_API_KEY>
// evento: messages.upsert

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const apiKey = Deno.env.get('EVOLUTION_API_KEY');
    const providedKey = new URL(req.url).searchParams.get('key');
    if (!apiKey || providedKey !== apiKey) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const event = body.event;
    const instanceName = body.instance || '';
    const items = Array.isArray(body.data) ? body.data : body.data ? [body.data] : [];

    if (event !== 'messages.upsert' || items.length === 0) {
      return Response.json({ success: true, ignored: true });
    }

    for (const item of items) {
      const remoteJid = item?.key?.remoteJid || '';
      if (!remoteJid || remoteJid.endsWith('@g.us')) continue; // ignora grupos
      const phone = remoteJid.split('@')[0];
      const fromMe = !!item?.key?.fromMe;
      const pushName = item?.pushName || phone;

      const msg = item.message || item.Message || {};
      const content = msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || '[mídia]';
      const timestamp = item.messageTimestamp
        ? new Date(Number(item.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString();

      const existing = await base44.asServiceRole.entities.Conversation.filter({ phone });
      let conversation = existing[0];

      if (!conversation) {
        conversation = await base44.asServiceRole.entities.Conversation.create({
          customer_name: pushName,
          phone,
          channel: 'whatsapp',
          instance: instanceName,
          status: 'novo',
          last_message: content,
          last_message_time: timestamp,
          unread: !fromMe,
        });
      } else {
        await base44.asServiceRole.entities.Conversation.update(conversation.id, {
          instance: instanceName || conversation.instance,
          last_message: content,
          last_message_time: timestamp,
          unread: !fromMe ? true : conversation.unread,
        });
      }

      await base44.asServiceRole.entities.Message.create({
        conversation_id: conversation.id,
        content,
        direction: fromMe ? 'out' : 'in',
        type: 'text',
        status: 'received',
        timestamp,
      });
    }

    return Response.json({ success: true, processed: items.length });
  } catch (error) {
    await base44.asServiceRole.entities.ErrorLog.create({ function_name: 'evolutionWebhook', error_message: error.message }).catch(() => {});
    return Response.json({ error: error.message }, { status: 500 });
  }
});