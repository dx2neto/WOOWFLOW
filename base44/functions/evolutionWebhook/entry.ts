import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Recebe eventos em tempo real da Evolution Go e sincroniza Conversation/Message.
// Configure o webhook na Evolution Go:
//   POST /instance/connect  body: { webhookUrl: "https://<app>/functions/evolutionWebhook?key=<EVOLUTION_API_KEY>", subscribe: ["ALL"] }
//
// Formato Evolution Go (diferente da Evolution API JS):
//   { event: "Message", instanceId: "<uuid>", instanceToken: "<token>", data: { Info: {...}, Message: {...} } }

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

function pickRecord(...values: unknown[]): AnyRecord {
  for (const value of values) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as AnyRecord;
  }
  return {};
}

function normalizeEvent(value: unknown): string {
  return String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
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

function mediaInfo(msgBody: AnyRecord) {
  const media = pickRecord(
    msgBody.imageMessage,
    msgBody.videoMessage,
    msgBody.audioMessage,
    msgBody.documentMessage,
    msgBody.stickerMessage,
  );
  return {
    caption: String(media.caption || ''),
    fileName: String(media.fileName || media.title || ''),
    mimeType: String(media.mimetype || media.mimeType || ''),
    mediaUrl: typeof msgBody.mediaUrl === 'string' ? msgBody.mediaUrl : typeof media.url === 'string' ? media.url : null,
    mediaBase64: typeof msgBody.base64 === 'string' ? msgBody.base64 : null,
  };
}

function detectMsgType(info: AnyRecord, msgBody: AnyRecord): string {
  const mediaType = String(info.MediaType || '').toLowerCase();
  if (mediaType && ['image', 'video', 'audio', 'document', 'sticker'].includes(mediaType)) return mediaType;
  if (msgBody.locationMessage) return 'location';
  if (msgBody.reactionMessage) return 'reaction';
  if (msgBody.pollCreationMessage || msgBody.pollUpdateMessage) return 'poll';
  if (msgBody.contactMessage || msgBody.contactsArrayMessage) return 'contact';
  return 'text';
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    // ── autenticação via query string ─────────────────────────────────────────
    const apiKey      = Deno.env.get('EVOLUTION_GO_WEBHOOK_SECRET') || Deno.env.get('EVOLUTION_GO_ADMIN_TOKEN') || Deno.env.get('EVOLUTION_API_KEY') || Deno.env.get('GLOBAL_API_KEY') || '';
    const providedKey = new URL(req.url).searchParams.get('key');
    if (apiKey && providedKey !== apiKey) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body       = await req.json().catch(() => ({}));
    const event      = String(body.event || body.type || '');
    const eventKey   = normalizeEvent(event);
    const instanceId = String(body.instanceId || body.instance || body.instanceName || '');

    // ── Message ───────────────────────────────────────────────────────────────
    // Formato Evolution Go: body.data tem Info e Message
    if (['message', 'messages', 'messagesupsert', 'sendmessage'].includes(eventKey)) {
      const data    = body.data || {};
      const info    = pickRecord((data as AnyRecord).Info, (data as AnyRecord).info, (data as AnyRecord).key);
      const msgBody = pickRecord((data as AnyRecord).Message, (data as AnyRecord).message, data);

      const chat    = String(info.Chat || info.chat || info.remoteJid || info.RemoteJid || '');
      const isGroup = !!info.IsGroup || chat.endsWith('@g.us');
      if (!chat || isGroup) {
        return Response.json({ success: true, ignored: true, reason: 'group or empty' });
      }

      const waId    = String(info.ID || info.id || info.messageId || info.MessageID || '');
      const phone   = chat.replace(/@.*$/, '');
      const fromMe  = !!(info.IsFromMe ?? info.fromMe);
      const pushName = String(info.PushName || info.pushName || phone);
      const msgType  = detectMsgType(info, msgBody);
      const textContent = extractText(msgBody);
      const content  = textContent || `[${msgType}]`;
      const timestamp = normalizeTimestamp(info.Timestamp || info.timestamp || (data as AnyRecord).timestamp);
      const media = mediaInfo(msgBody);

      // ── Deduplication by wa_message_id ────────────────────────────────────
      if (waId) {
        const dup = await base44.asServiceRole.entities.Message.filter({ wa_message_id: waId });
        if (dup.length > 0) {
          return Response.json({ success: true, ignored: true, reason: 'duplicate wa_message_id' });
        }
      }

      // ── Upsert Conversation ───────────────────────────────────────────────
      const existing   = await base44.asServiceRole.entities.Conversation.filter({ phone, channel: 'whatsapp' });
      let conversation = existing[0];

      if (!conversation) {
        conversation = await base44.asServiceRole.entities.Conversation.create({
          customer_name:     pushName,
          phone,
          channel:           'whatsapp',
          instance:          instanceId,
          provider:          'evolution_go',
          provider_contact_id: chat,
          status:            'novo',
          last_message:      content,
          last_message_time: timestamp,
          unread:            !fromMe,
        });
      } else {
        await base44.asServiceRole.entities.Conversation.update(conversation.id, {
          instance:          instanceId || conversation.instance,
          provider:          'evolution_go',
          provider_contact_id: chat,
          last_message:      content,
          last_message_time: timestamp,
          unread:            !fromMe ? true : conversation.unread,
        });
      }

      // ── Save Message ──────────────────────────────────────────────────────
      await base44.asServiceRole.entities.Message.create({
        conversation_id: conversation.id,
        content,
        direction:       fromMe ? 'out' : 'in',
        type:            msgType,
        status:          fromMe ? 'sent' : 'received',
        timestamp,
        wa_message_id:   waId,
        provider:        'evolution_go',
        provider_message_id: waId,
        instance_id:     instanceId,
        contact_id:      chat,
        phone,
        chat_jid:        chat,
        is_group:        false,
        sender_name:     fromMe ? null : pushName,
        payload:         body,
        ...(media.caption ? { caption: media.caption } : {}),
        ...(media.fileName ? { file_name: media.fileName } : {}),
        ...(media.mimeType ? { mime_type: media.mimeType } : {}),
        ...(media.mediaBase64 ? { media_base64: media.mediaBase64 } : {}),
        ...(media.mediaUrl    ? { media_url: media.mediaUrl } : {}),
      });

      // ── Auto-tag via IA (apenas mensagens recebidas com texto) ─────────────
      if (!fromMe && textContent) {
        try {
          const tagList = await base44.asServiceRole.entities.Tag.list();
          if (tagList.length > 0) {
            const tagNames = tagList.map((t: AnyRecord) => String(t.name));
            const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
              prompt: `Mensagem do cliente: "${textContent}"\n\nEtiquetas disponíveis: ${tagNames.join(', ')}\n\nEscolha até 3 etiquetas da lista acima que sejam relevantes para esta mensagem. Se nenhuma for relevante, retorne uma lista vazia. Responda apenas com nomes exatamente como estão na lista.`,
              response_json_schema: { type: 'object', properties: { tags: { type: 'array', items: { type: 'string' } } } },
            }) as AnyRecord;
            const suggestedTags = (Array.isArray(aiResult.tags) ? aiResult.tags as string[] : []).filter((t) => tagNames.includes(t));
            if (suggestedTags.length > 0) {
              const currentTags = Array.isArray(conversation.tags) ? conversation.tags as string[] : [];
              const mergedTags = Array.from(new Set([...currentTags, ...suggestedTags]));
              if (mergedTags.length !== currentTags.length) {
                await base44.asServiceRole.entities.Conversation.update(conversation.id, { tags: mergedTags });
              }
            }
          }
        } catch (_e) {
          // não bloqueia o fluxo principal em caso de falha na IA
        }
      }

      await base44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionWebhook',
        action:      event || 'Message',
        status:      'sucesso',
        details:     `${phone} — ${msgType}${fromMe ? ' (enviado)' : ''}`,
      }).catch(() => {});

      return Response.json({ success: true, processed: 1 });
    }

    // ── SendMessage ───────────────────────────────────────────────────────────
    // Evento disparado quando a própria instância envia uma mensagem (por fora do sistema)
    if (eventKey === 'sendmessage') {
      const data    = body.data || {};
      const info    = (data.Info || {}) as AnyRecord;
      const msgBody = (data.Message || {}) as AnyRecord;

      const chat    = String(info.Chat || '');
      const isGroup = !!info.IsGroup || chat.endsWith('@g.us');
      if (!chat || isGroup) return Response.json({ success: true, ignored: true });

      const waId      = String(info.ID || '');
      const phone     = chat.replace(/@.*$/, '');
      const msgType   = detectMsgType(info, msgBody);
      const content   = extractText(msgBody) || `[${msgType}]`;
      const timestamp = info.Timestamp ? new Date(String(info.Timestamp)).toISOString() : new Date().toISOString();

      // Deduplication
      if (waId) {
        const dup = await base44.asServiceRole.entities.Message.filter({ wa_message_id: waId });
        if (dup.length > 0) return Response.json({ success: true, ignored: true, reason: 'duplicate' });
      }

      const existing = await base44.asServiceRole.entities.Conversation.filter({ phone });
      let convo      = existing[0];

      if (!convo) {
        convo = await base44.asServiceRole.entities.Conversation.create({
          customer_name: phone, phone, channel: 'whatsapp',
          instance: instanceId, status: 'novo',
          last_message: content, last_message_time: timestamp, unread: false,
        });
      } else {
        await base44.asServiceRole.entities.Conversation.update(convo.id, {
          last_message: content, last_message_time: timestamp,
        });
      }

      await base44.asServiceRole.entities.Message.create({
        conversation_id: convo.id,
        content,
        direction:       'out',
        type:            msgType,
        status:          'sent',
        timestamp,
        wa_message_id:   waId,
        chat_jid:        chat,
        is_group:        false,
      });

      return Response.json({ success: true, processed: 1 });
    }

    // ── HistorySync ───────────────────────────────────────────────────────────
    // Resposta assíncrona de POST /chat/history-sync.
    // Requer subscribe: ["HISTORY_SYNC"] ou ["ALL"] no connect.
    if (eventKey === 'historysync') {
      const data = body.data || {};
      const rawList: unknown[] = Array.isArray(data)
        ? data
        : Array.isArray((data as AnyRecord).Messages) ? (data as AnyRecord).Messages as unknown[]
        : Array.isArray((data as AnyRecord).messages) ? (data as AnyRecord).messages as unknown[]
        : Array.isArray((data as AnyRecord).Conversations) ? (data as AnyRecord).Conversations as unknown[]
        : [data];

      let saved = 0;
      for (const item of rawList) {
        const msg     = (item || {}) as AnyRecord;
        const info    = (msg.Info || {}) as AnyRecord;
        const msgBody = (msg.Message || {}) as AnyRecord;

        const chat    = String(info.Chat || '');
        const isGroup = !!info.IsGroup || chat.endsWith('@g.us');
        if (!chat || isGroup) continue;

        const waId    = String(info.ID || '');
        if (!waId) continue; // Sem ID não é possível deduplicar

        // Deduplication por wa_message_id (robusto)
        const dup = await base44.asServiceRole.entities.Message.filter({ wa_message_id: waId });
        if (dup.length > 0) continue;

        const phone      = chat.replace(/@.*$/, '');
        const fromMe     = !!info.IsFromMe;
        const pushName   = String(info.PushName || phone);
        const msgType    = detectMsgType(info, msgBody);
        const textContent = extractText(msgBody);
        const content    = textContent || `[${msgType}]`;
        const timestamp  = info.Timestamp ? new Date(String(info.Timestamp)).toISOString() : new Date().toISOString();

        // Busca ou cria Conversation
        const existing = await base44.asServiceRole.entities.Conversation.filter({ phone, channel: 'whatsapp' });
        let conversation = existing[0];
        if (!conversation) {
          conversation = await base44.asServiceRole.entities.Conversation.create({
            customer_name: pushName, phone, channel: 'whatsapp', instance: instanceId, provider: 'evolution_go', provider_contact_id: chat,
            status: 'novo', last_message: content, last_message_time: timestamp, unread: !fromMe,
          });
        } else {
          await base44.asServiceRole.entities.Conversation.update(conversation.id, {
            last_message: content,
            last_message_time: timestamp,
            unread: !fromMe ? true : conversation.unread,
          }).catch(() => {});
        }

        await base44.asServiceRole.entities.Message.create({
          conversation_id: conversation.id,
          content,
          direction:       fromMe ? 'out' : 'in',
          type:            msgType,
          status:          fromMe ? 'sent' : 'received',
          timestamp,
          wa_message_id:   waId,
          provider:        'evolution_go',
          provider_message_id: waId,
          instance_id:     instanceId,
          contact_id:      chat,
          phone,
          chat_jid:        chat,
          is_group:        false,
          sender_name:     fromMe ? null : pushName,
          payload:         item,
        });
        saved++;
      }

      await base44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionWebhook', action: 'HistorySync', status: 'sucesso',
        details: `saved: ${saved} / total: ${rawList.length}`,
      }).catch(() => {});

      return Response.json({ success: true, processed: saved });
    }

    // ── Receipt (entrega / leitura) ───────────────────────────────────────────
    // state: "Delivered" | "Read" | "ReadSelf" | "Played"
    if (['receipt', 'readreceipt', 'messagereceipt'].includes(eventKey)) {
      const data  = body.data || {};
      const ids   = Array.isArray(data.ids) ? data.ids as string[] : data.id ? [String(data.id)] : [];
      const state = String(data.state || data.State || '').toLowerCase();

      let statusValue: string | null = null;
      if (state.includes('read') || state.includes('played')) statusValue = 'read';
      else if (state.includes('deliver')) statusValue = 'delivered';

      if (statusValue && ids.length > 0) {
        for (const waId of ids) {
          const msgs = await base44.asServiceRole.entities.Message.filter({ wa_message_id: waId }).catch(() => []);
          for (const msg of msgs) {
            await base44.asServiceRole.entities.Message.update(msg.id, { status: statusValue }).catch(() => {});
          }
        }
      }

      return Response.json({ success: true, processed: ids.length });
    }

    // ── Connected / LoggedOut / PairSuccess ───────────────────────────────────
    if (['connected', 'loggedout', 'pairsuccess', 'disconnected', 'qrcode'].includes(eventKey)) {
      await base44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionWebhook',
        action:      event,
        status:      'sucesso',
        details:     `instanceId: ${instanceId}`,
      }).catch(() => {});
      return Response.json({ success: true, event });
    }

    // ── QRCode ────────────────────────────────────────────────────────────────
    if (eventKey === 'qrcode') {
      // QR é exibido via polling no frontend (evolutionApi.get_qrcode)
      return Response.json({ success: true, ignored: true, reason: 'qr handled by frontend polling' });
    }

    // ── Outros eventos ────────────────────────────────────────────────────────
    return Response.json({ success: true, ignored: true, event });

  } catch (error) {
    await base44.asServiceRole.entities.ErrorLog.create({
      function_name:  'evolutionWebhook',
      error_message:  (error as Error).message,
    }).catch(() => {});
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});