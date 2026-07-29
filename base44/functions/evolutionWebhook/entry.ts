import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Webhook handler para a Evolution API oficial (Baileys).
// Formato do evento: { event: "messages.upsert", instance: "nome", data: { key, message, messageTimestamp, pushName } }
// Configure o webhook ao criar a instância:
//   POST /instance/create  body: { instanceName, webhook: { enabled: true, url: "https://<app>/functions/evolutionWebhook?key=<EVOLUTION_API_KEY>", events: ["messages.upsert","connection.update","qrcode.updated","messages.update"] } }

type AnyRecord = Record<string, unknown>;

function extractText(msgBody: AnyRecord): string {
  return String(
    msgBody.conversation ??
    (msgBody.extendedTextMessage as AnyRecord)?.text ??
    (msgBody.imageMessage as AnyRecord)?.caption ??
    (msgBody.videoMessage as AnyRecord)?.caption ??
    (msgBody.documentMessage as AnyRecord)?.title ??
    (msgBody.documentMessage as AnyRecord)?.fileName ??
    ''
  );
}

function normalizeTimestamp(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'number') return new Date(value > 9999999999 ? value : value * 1000).toISOString();
  const raw = String(value);
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return new Date(numeric > 9999999999 ? numeric : numeric * 1000).toISOString();
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function detectMsgType(key: AnyRecord, msgBody: AnyRecord): string {
  const mediaType = String(key.MediaType || '').toLowerCase();
  if (mediaType && ['image', 'video', 'audio', 'document', 'sticker'].includes(mediaType)) return mediaType;
  if (msgBody.imageMessage) return 'image';
  if (msgBody.videoMessage) return 'video';
  if (msgBody.audioMessage) return 'audio';
  if (msgBody.documentMessage) return 'document';
  if (msgBody.stickerMessage) return 'sticker';
  if (msgBody.locationMessage) return 'location';
  if (msgBody.reactionMessage) return 'reaction';
  if (msgBody.pollCreationMessage || msgBody.pollUpdateMessage) return 'poll';
  if (msgBody.contactMessage || msgBody.contactsArrayMessage) return 'contact';
  return 'text';
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    // ── Autenticação do webhook (fail-closed) ────────────────────────────────
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    if (!apiKey) return Response.json({ error: 'Webhook secret not configured' }, { status: 500 });
    const providedKey = new URL(req.url).searchParams.get('key') || req.headers.get('x-webhook-secret') || req.headers.get('apikey');
    if (providedKey !== apiKey) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const event = String(body.event || body.type || '');
    const instanceId = String(body.instance || body.instanceName || body.instanceId || '');

    // ── messages.upsert (nova mensagem recebida ou enviada) ─────────────────
    if (event === 'messages.upsert' || event === 'message' || event === 'messages') {
      const data = asRecord(body.data);
      // data pode ser { messages: [...] } ou uma mensagem direta
      const messages: AnyRecord[] = Array.isArray(data.messages) ? data.messages : [data];

      let saved = 0;
      for (const msg of messages) {
        const key = asRecord(msg.key || msg.Key);
        const chat = String(key.remoteJid || key.RemoteJid || key.Chat || '');
        if (!chat || chat.endsWith('@g.us')) continue;

        const waId = String(key.id || key.ID || key.messageId || '');
        const phone = chat.replace(/@.*$/, '');
        const fromMe = !!(key.fromMe ?? key.FromMe ?? key.IsFromMe);
        const pushName = String(msg.pushName || key.PushName || msg.PushName || phone);
        const msgBody = asRecord(msg.message || msg.Message || {});
        const msgType = detectMsgType(key, msgBody);
        const textContent = extractText(msgBody);
        const content = textContent || `[${msgType}]`;
        const timestamp = normalizeTimestamp(msg.messageTimestamp || key.Timestamp || msg.Timestamp);

        // Deduplicação por wa_message_id
        if (waId) {
          const dup = await base44.asServiceRole.entities.Message.filter({ wa_message_id: waId });
          if (dup.length > 0) continue;
        }

        // Upsert Conversation
        const existing = await base44.asServiceRole.entities.Conversation.filter({ phone, channel: 'whatsapp' });
        let conversation = existing[0];
        if (!conversation) {
          conversation = await base44.asServiceRole.entities.Conversation.create({
            customer_name: pushName, phone, channel: 'whatsapp', instance: instanceId, provider: 'evolution_api',
            provider_contact_id: chat, status: 'novo', last_message: content, last_message_time: timestamp, unread: !fromMe,
          });
        } else {
          await base44.asServiceRole.entities.Conversation.update(conversation.id, {
            instance: instanceId || conversation.instance, provider: 'evolution_api',
            provider_contact_id: chat, last_message: content, last_message_time: timestamp,
            unread: !fromMe ? true : conversation.unread,
          });
        }

        // Save Message
        await base44.asServiceRole.entities.Message.create({
          conversation_id: conversation.id, content, direction: fromMe ? 'out' : 'in',
          type: msgType, status: fromMe ? 'sent' : 'received', timestamp,
          wa_message_id: waId, provider: 'evolution_api', provider_message_id: waId,
          instance_id: instanceId, contact_id: chat, phone, chat_jid: chat, is_group: false,
          sender_name: fromMe ? null : pushName, payload: body,
        });

        // Auto-tag via IA (apenas mensagens recebidas com texto)
        if (!fromMe && textContent) {
          try {
            const tagList = await base44.asServiceRole.entities.Tag.list();
            if (tagList.length > 0) {
              const tagNames = tagList.map((t) => String(t.name));
              const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: `Mensagem do cliente: "${textContent}"\n\nEtiquetas disponíveis: ${tagNames.join(', ')}\n\nEscolha até 3 etiquetas relevantes. Se nenhuma for relevante, retorne lista vazia. Responda apenas com nomes exatamente como estão na lista.`,
                response_json_schema: { type: 'object', properties: { tags: { type: 'array', items: { type: 'string' } } } },
              }) as AnyRecord;
              const suggested = (Array.isArray(aiResult.tags) ? aiResult.tags as string[] : []).filter((t) => tagNames.includes(t));
              if (suggested.length > 0) {
                const currentTags = Array.isArray(conversation.tags) ? conversation.tags as string[] : [];
                const merged = Array.from(new Set([...currentTags, ...suggested]));
                if (merged.length !== currentTags.length) {
                  await base44.asServiceRole.entities.Conversation.update(conversation.id, { tags: merged });
                }
              }
            }
          } catch { /* não bloqueia o fluxo principal */ }
        }
        saved++;
      }

      await base44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionWebhook', action: event, status: 'sucesso',
        details: `saved: ${saved}`,
      }).catch(() => {});
      return Response.json({ success: true, processed: saved });
    }

    // ── messages.update (entrega / leitura) ─────────────────────────────────
    if (event === 'messages.update' || event === 'message.ack') {
      const data = asRecord(body.data);
      const updates: AnyRecord[] = Array.isArray(data.messages) ? data.messages : Array.isArray(body.data) ? body.data : [data];
      for (const upd of updates) {
        const key = asRecord(upd.key || upd.Key);
        const waId = String(key.id || key.ID || '');
        const statusRaw = String(upd.status || upd.Status || '').toLowerCase();
        let statusValue: string | null = null;
        if (statusRaw.includes('read') || statusRaw.includes('played')) statusValue = 'read';
        else if (statusRaw.includes('deliver')) statusValue = 'delivered';
        if (statusValue && waId) {
          const msgs = await base44.asServiceRole.entities.Message.filter({ wa_message_id: waId }).catch(() => []);
          for (const msg of msgs) await base44.asServiceRole.entities.Message.update(msg.id, { status: statusValue }).catch(() => {});
        }
      }
      return Response.json({ success: true, processed: updates.length });
    }

    // ── connection.update (conectado / QR / desconectado) ───────────────────
    if (event === 'connection.update' || event === 'connected' || event === 'disconnected' || event === 'qrcode.updated') {
      await base44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionWebhook', action: event, status: 'sucesso',
        details: `instance: ${instanceId} — ${JSON.stringify(body.data || {}).slice(0, 200)}`,
      }).catch(() => {});
      return Response.json({ success: true, event });
    }

    // ── Outros eventos ──────────────────────────────────────────────────────
    return Response.json({ success: true, ignored: true, event });
  } catch (error) {
    await base44.asServiceRole.entities.ErrorLog.create({
      function_name: 'evolutionWebhook', error_message: (error as Error).message,
    }).catch(() => {});
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {};
}