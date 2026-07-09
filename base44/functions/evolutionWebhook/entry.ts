import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Recebe eventos em tempo real da Evolution Go e sincroniza Conversation/Message.
// Configure o webhook na Evolution Go:
//   POST /instance/connect  body: { webhookUrl: "https://<app>/functions/evolutionWebhook?key=<EVOLUTION_API_KEY>", subscribe: ["ALL"] }
//
// Formato Evolution Go (diferente da Evolution API JS):
//   { event: "Message", instanceId: "<uuid>", instanceToken: "<token>", data: { Info: {...}, Message: {...} } }

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    // ── autenticação via query string ─────────────────────────────────────────
    const apiKey      = Deno.env.get('EVOLUTION_API_KEY') || Deno.env.get('GLOBAL_API_KEY') || '';
    const providedKey = new URL(req.url).searchParams.get('key');
    if (apiKey && providedKey !== apiKey) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body        = await req.json().catch(() => ({}));
    const event       = String(body.event || '');
    const instanceId  = String(body.instanceId  || body.instance || '');
    const instanceTok = String(body.instanceToken || '');

    // ── Message ───────────────────────────────────────────────────────────────
    // Formato Evolution Go: body.data é um objeto com Info e Message (não array)
    if (event === 'Message') {
      const data    = body.data || {};
      const info    = data.Info  || {};
      const msgBody = data.Message || {};

      const chat     = String(info.Chat || '');
      const isGroup  = !!info.IsGroup || chat.endsWith('@g.us');
      if (!chat || isGroup) {
        return Response.json({ success: true, ignored: true, reason: 'group or empty' });
      }

      const phone     = chat.replace(/@.*$/, '');
      const fromMe    = !!info.IsFromMe;
      const pushName  = String(info.PushName || phone);
      const mediaType = String(info.MediaType || '').toLowerCase(); // image | video | audio | document | ''

      // extrai conteúdo de texto
      const textContent = String(
        msgBody.conversation                              ??
        msgBody.extendedTextMessage?.text                ??
        msgBody.imageMessage?.caption                    ??
        msgBody.videoMessage?.caption                    ??
        msgBody.documentMessage?.title                   ??
        msgBody.documentMessage?.fileName                ??
        ''
      );

      // tipo da mensagem: text | image | video | audio | document
      const msgType = mediaType || (textContent ? 'text' : 'text');
      const content = textContent || (mediaType ? `[${mediaType}]` : '[mensagem]');

      // timestamp em ISO 8601 (Evolution Go já envia ISO, não Unix)
      const timestamp = info.Timestamp
        ? new Date(info.Timestamp).toISOString()
        : new Date().toISOString();

      // mídia em base64 (quando WEBHOOK_FILES=true)
      const mediaBase64: string | null =
        (typeof msgBody.base64 === 'string' && msgBody.base64) ? msgBody.base64 : null;
      const mediaUrl: string | null =
        (typeof msgBody.mediaUrl === 'string' && msgBody.mediaUrl) ? msgBody.mediaUrl : null;

      // ── Conversation ───────────────────────────────────────────────────────
      const existing     = await base44.asServiceRole.entities.Conversation.filter({ phone });
      let conversation   = existing[0];

      if (!conversation) {
        conversation = await base44.asServiceRole.entities.Conversation.create({
          customer_name:     pushName,
          phone,
          channel:           'whatsapp',
          instance:          instanceId,
          status:            'novo',
          last_message:      content,
          last_message_time: timestamp,
          unread:            !fromMe,
        });
      } else {
        await base44.asServiceRole.entities.Conversation.update(conversation.id, {
          instance:          instanceId || conversation.instance,
          last_message:      content,
          last_message_time: timestamp,
          unread:            !fromMe ? true : conversation.unread,
        });
      }

      // ── Message ────────────────────────────────────────────────────────────
      await base44.asServiceRole.entities.Message.create({
        conversation_id: conversation.id,
        content,
        direction:       fromMe ? 'out' : 'in',
        type:            msgType,
        status:          'received',
        timestamp,
        ...(mediaBase64 ? { media_base64: mediaBase64 } : {}),
        ...(mediaUrl    ? { media_url:    mediaUrl    } : {}),
      });

      await base44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionWebhook',
        action:      'Message',
        status:      'sucesso',
        details:     `${phone} — ${msgType}${fromMe ? ' (enviado)' : ''}`,
      });

      return Response.json({ success: true, processed: 1 });
    }

    // ── HistorySync ───────────────────────────────────────────────────────────
    // Dispara quando o WhatsApp envia histórico após /chat/history-sync.
    // Requer HISTORY_SYNC no subscribe do connect.
    if (event === 'HistorySync') {
      const data = body.data || {};
      const rawList: unknown[] = Array.isArray(data)
        ? data
        : Array.isArray(data.Messages) ? data.Messages
        : Array.isArray(data.messages) ? data.messages
        : [];

      let saved = 0;
      for (const item of rawList) {
        const msg = (item || {}) as Record<string, unknown>;
        const info = (msg.Info || {}) as Record<string, unknown>;
        const msgBody = (msg.Message || {}) as Record<string, unknown>;

        const chat = String(info.Chat || '');
        const isGroup = !!(info.IsGroup) || chat.endsWith('@g.us');
        if (!chat || isGroup) continue;

        const phone = chat.replace(/@.*$/, '');
        const fromMe = Boolean(info.IsFromMe);
        const pushName = String(info.PushName || phone);
        const mediaType = String(info.MediaType || '').toLowerCase();
        const textContent = String(
          msgBody.conversation ??
          (msgBody.extendedTextMessage as Record<string,unknown>)?.text ??
          (msgBody.imageMessage as Record<string,unknown>)?.caption ??
          (msgBody.videoMessage as Record<string,unknown>)?.caption ?? ''
        );
        const content = textContent || (mediaType ? `[${mediaType}]` : '[mensagem]');
        const timestamp = info.Timestamp ? new Date(String(info.Timestamp)).toISOString() : new Date().toISOString();

        // Busca ou cria Conversation
        const existing = await base44.asServiceRole.entities.Conversation.filter({ phone });
        let conversation = existing[0];
        if (!conversation) {
          conversation = await base44.asServiceRole.entities.Conversation.create({
            customer_name: pushName, phone, channel: 'whatsapp', instance: instanceId,
            status: 'novo', last_message: content, last_message_time: timestamp, unread: !fromMe,
          });
        }

        // Evita duplicata por timestamp
        const existingMsgs = await base44.asServiceRole.entities.Message.filter(
          { conversation_id: conversation.id, timestamp }
        );
        if (existingMsgs.length > 0) continue;

        await base44.asServiceRole.entities.Message.create({
          conversation_id: conversation.id, content,
          direction: fromMe ? 'out' : 'in',
          type: mediaType || 'text', status: 'received', timestamp,
          sender_name: fromMe ? null : pushName,
        });
        saved++;
      }

      await base44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionWebhook', action: 'HistorySync', status: 'sucesso',
        details: `saved: ${saved} / total: ${rawList.length}`,
      }).catch(() => {});

      return Response.json({ success: true, processed: saved });
    }

    // ── SendMessage ───────────────────────────────────────────────────────────
    // Registra mensagens enviadas pela própria instância (fromMe=true)
    if (event === 'SendMessage') {
      const data    = body.data || {};
      const info    = data.Info  || {};
      const msgBody = data.Message || {};

      const chat    = String(info.Chat || '');
      const isGroup = !!info.IsGroup || chat.endsWith('@g.us');
      if (!chat || isGroup) return Response.json({ success: true, ignored: true });

      const phone   = chat.replace(/@.*$/, '');
      const content = String(
        msgBody.conversation ?? msgBody.extendedTextMessage?.text ?? '[mídia]'
      );
      const timestamp = info.Timestamp ? new Date(info.Timestamp).toISOString() : new Date().toISOString();

      const existing   = await base44.asServiceRole.entities.Conversation.filter({ phone });
      const convo      = existing[0];
      if (convo) {
        await base44.asServiceRole.entities.Conversation.update(convo.id, {
          last_message:      content,
          last_message_time: timestamp,
        });
        await base44.asServiceRole.entities.Message.create({
          conversation_id: convo.id,
          content,
          direction:       'out',
          type:            'text',
          status:          'sent',
          timestamp,
        });
      }

      return Response.json({ success: true, processed: 1 });
    }

    // ── Receipt (leitura/entrega) ─────────────────────────────────────────────
    if (event === 'Receipt') {
      // state pode ser "Read" | "ReadSelf" | "Delivered"
      // Ignora por ora — pode ser usado para atualizar status de mensagem no futuro
      return Response.json({ success: true, ignored: true, reason: 'receipt handled later' });
    }

    // ── Connected / LoggedOut ─────────────────────────────────────────────────
    if (event === 'Connected' || event === 'LoggedOut' || event === 'PairSuccess') {
      await base44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionWebhook',
        action:      event,
        status:      'sucesso',
        details:     `instanceId: ${instanceId}`,
      }).catch(() => {});
      return Response.json({ success: true, event });
    }

    // ── QRCode ────────────────────────────────────────────────────────────────
    if (event === 'QRCode') {
      // Apenas loga — o QR é exibido via evolutionApi.get_qrcode no frontend
      return Response.json({ success: true, ignored: true, reason: 'qr handled by frontend polling' });
    }

    // ── outros eventos ────────────────────────────────────────────────────────
    return Response.json({ success: true, ignored: true, event });

  } catch (error) {
    await base44.asServiceRole.entities.ErrorLog.create({
      function_name:  'evolutionWebhook',
      error_message:  (error as Error).message,
    }).catch(() => {});
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
