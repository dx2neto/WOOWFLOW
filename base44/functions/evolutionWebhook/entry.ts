import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { logError } from '../../shared/errorLogger.ts';
import { validateWebhookRequest } from '../../shared/webhookSecurity.ts';

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

function extractMediaInfo(msgBody: AnyRecord): { url: string | null; mimeType: string | null; fileName: string | null } {
  const img = asRecord(msgBody.imageMessage);
  const aud = asRecord(msgBody.audioMessage);
  const vid = asRecord(msgBody.videoMessage);
  const doc = asRecord(msgBody.documentMessage);
  const stc = asRecord(msgBody.stickerMessage);
  if (img.url || img.jpegThumbnail) return { url: String(img.url || ''), mimeType: String(img.mimetype || img.mime_type || 'image/jpeg'), fileName: null };
  if (aud.url) return { url: String(aud.url), mimeType: String(aud.mimetype || aud.mime_type || 'audio/ogg'), fileName: null };
  if (vid.url) return { url: String(vid.url), mimeType: String(vid.mimetype || vid.mime_type || 'video/mp4'), fileName: null };
  if (doc.url) return { url: String(doc.url), mimeType: String(doc.mimetype || doc.mime_type || 'application/octet-stream'), fileName: String(doc.fileName || doc.title || 'documento') };
  if (stc.url) return { url: String(stc.url), mimeType: String(stc.mimetype || 'image/webp'), fileName: null };
  return { url: null, mimeType: null, fileName: null };
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
    // ── Validação de origem e segurança (fail-closed) ────────────────────────
    // Rate limiting + API key + validação de origem via módulo compartilhado.
    const security = validateWebhookRequest(req, {
      apiKeyEnv: 'EVOLUTION_API_KEY',
      allowedOriginEnv: 'EVOLUTION_API_URL',
      rateLimitMax: 120,
    });
    if (!security.ok) {
      if (security.status === 429) {
        await base44.asServiceRole.entities.MessageSyncLog.create({
          sync_status: 'rate_limited', action: 'rate_limit',
          error_message: `IP ${security.clientIp} excedeu o limite de req/min`,
        }).catch(() => {});
      }
      return Response.json({ error: security.error }, { status: security.status });
    }

    const body = await req.json().catch(() => ({}));
    const event = String(body.event || body.type || '');
    const instanceId = String(body.instance || body.instanceName || body.instanceId || '');
    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // ── messages.upsert (nova mensagem recebida ou enviada) ─────────────────
    if (event === 'messages.upsert' || event === 'message' || event === 'messages') {
      const data = asRecord(body.data);
      const messages: AnyRecord[] = Array.isArray(data.messages) ? data.messages : [data];

      // Rate limit: max 50 mensagens por request para evitar sobrecarga
      const MAX_MSGS = 50;
      const batch = messages.slice(0, MAX_MSGS);

      // Pré-filtro: coletar wa_message_ids e fazer UMA query de deduplicação
      const waIds = batch.map((m) => {
        const k = asRecord(m.key || m.Key);
        return String(k.id || k.ID || k.messageId || '');
      }).filter(Boolean);

      const existingMsgIds = new Set<string>();
      if (waIds.length > 0) {
        const existing = await base44.asServiceRole.entities.Message.filter({ wa_message_id: { $in: waIds } }).catch(() => []);
        for (const em of existing) if (em.wa_message_id) existingMsgIds.add(em.wa_message_id as string);
      }

      // Pré-busca de conversas existentes por phone (1 query por phone único)
      const phones = [...new Set(batch.map((m) => {
        const k = asRecord(m.key || m.Key);
        return String(k.remoteJid || k.RemoteJid || k.Chat || '').replace(/@.*$/, '');
      }).filter(Boolean))];

      const convMap = new Map<string, AnyRecord>();
      if (phones.length > 0) {
        const existingConvs = await base44.asServiceRole.entities.Conversation.filter({ phone: { $in: phones }, channel: 'whatsapp' }).catch(() => []);
        for (const c of existingConvs) convMap.set(c.phone as string, c as AnyRecord);
      }

      // Pré-carregar tags uma única vez para todo o batch
      let tagNames: string[] = [];
      try {
        const tagList = await base44.asServiceRole.entities.Tag.list();
        tagNames = tagList.map((t) => String(t.name));
      } catch { /* sem tags disponíveis */ }

      let saved = 0;
      let skipped = 0;
      let errors = 0;

      for (const msg of batch) {
        try {
          const key = asRecord(msg.key || msg.Key);
          const chat = String(key.remoteJid || key.RemoteJid || key.Chat || '');
          const waId = String(key.id || key.ID || key.messageId || '');
          const phone = chat.replace(/@.*$/, '');
          const fromMe = !!(key.fromMe ?? key.FromMe ?? key.IsFromMe);
          const pushName = String(msg.pushName || key.PushName || msg.PushName || phone);
          const msgBody = asRecord(msg.message || msg.Message || {});
          const msgType = detectMsgType(key, msgBody);
          const textContent = extractText(msgBody);
          const content = textContent || `[${msgType}]`;
          const timestamp = normalizeTimestamp(msg.messageTimestamp || key.Timestamp || msg.Timestamp);
          const mediaInfo = extractMediaInfo(msgBody);

          // Filtro: grupos ou sem chat
          if (!chat || chat.endsWith('@g.us')) {
            await base44.asServiceRole.entities.MessageSyncLog.create({
              phone: phone || null, wa_message_id: waId || null, instance: instanceId,
              direction: fromMe ? 'out' : 'in', sync_status: 'filtered', action: 'message_create',
              error_message: chat ? 'Mensagem de grupo ignorada' : 'Chat vazio',
              message_preview: content.slice(0, 100), event_type: event, batch_id: batchId,
            }).catch(() => {});
            continue;
          }

          // Deduplicação (batch)
          if (waId && existingMsgIds.has(waId)) {
            skipped++;
            await base44.asServiceRole.entities.MessageSyncLog.create({
              phone, wa_message_id: waId, instance: instanceId,
              direction: fromMe ? 'out' : 'in', sync_status: 'duplicate', action: 'message_create',
              message_preview: content.slice(0, 100), event_type: event, batch_id: batchId,
            }).catch(() => {});
            continue;
          }

          // Upsert Conversation
          let conversation = convMap.get(phone);
          if (!conversation) {
            conversation = await base44.asServiceRole.entities.Conversation.create({
              customer_name: pushName, phone, channel: 'whatsapp', instance: instanceId, provider: 'evolution_api',
              provider_contact_id: chat, status: 'novo', last_message: content, last_message_time: timestamp, unread: !fromMe,
            }) as AnyRecord;
            convMap.set(phone, conversation);
            // Pré-vinculação automática com IXCSoft (busca cliente por telefone)
            try {
              const ixcBase = Deno.env.get('IXC_API_URL') || '';
              const ixcToken = Deno.env.get('IXC_API_TOKEN') || '';
              if (ixcBase && ixcToken) {
                const phoneClean = phone.replace(/^55/, '');
                const ixcRes = await fetch(ixcBase.replace(/\/$/, '') + '/cliente', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Basic ${ixcToken}`, ixcsoft: 'listar' },
                  body: JSON.stringify({ qtype: 'cliente.telefone_celular', query: phoneClean, oper: 'L', page: '1', rp: '1' }),
                });
                const ixcData = await ixcRes.json().catch(() => ({}));
                const ixcClient = (ixcData.registros || [])[0];
                if (ixcClient) {
                  const realName = ixcClient.razao || ixcClient.fantasia || pushName;
                  await base44.asServiceRole.entities.Conversation.update(conversation.id as string, {
                    customer_name: realName, city: ixcClient.cidade_nome || '',
                  }).catch(() => {});
                }
              }
            } catch { /* não bloqueia o fluxo principal */ }
          } else {
            await base44.asServiceRole.entities.Conversation.update(conversation.id as string, {
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
            assigned_user_id: (conversation.assigned_user_id as string) || null,
            ...(mediaInfo.url ? { media_url: mediaInfo.url } : {}),
            ...(mediaInfo.mimeType ? { mime_type: mediaInfo.mimeType } : {}),
            ...(mediaInfo.fileName ? { file_name: mediaInfo.fileName } : {}),
          });

          // Auto-tag via IA (apenas mensagens recebidas com texto, tags disponíveis)
          if (!fromMe && textContent && tagNames.length > 0) {
            try {
              const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: `Mensagem do cliente: "${textContent}"\n\nEtiquetas disponíveis: ${tagNames.join(', ')}\n\nEscolha até 3 etiquetas relevantes. Se nenhuma for relevante, retorne lista vazia. Responda apenas com nomes exatamente como estão na lista.`,
                response_json_schema: { type: 'object', properties: { tags: { type: 'array', items: { type: 'string' } } } },
              }) as AnyRecord;
              const suggested = (Array.isArray(aiResult.tags) ? aiResult.tags as string[] : []).filter((t) => tagNames.includes(t));
              if (suggested.length > 0) {
                const currentTags = Array.isArray(conversation.tags) ? conversation.tags as string[] : [];
                const merged = Array.from(new Set([...currentTags, ...suggested]));
                if (merged.length !== currentTags.length) {
                  await base44.asServiceRole.entities.Conversation.update(conversation.id as string, { tags: merged });
                }
              }
            } catch { /* não bloqueia o fluxo principal */ }
          }
          saved++;
          await base44.asServiceRole.entities.MessageSyncLog.create({
            phone, wa_message_id: waId, conversation_id: conversation.id as string, instance: instanceId,
            direction: fromMe ? 'out' : 'in', sync_status: 'synced', action: 'message_create',
            message_preview: content.slice(0, 100), event_type: event, batch_id: batchId,
          }).catch(() => {});
         } catch (err) {
           errors++;
           await base44.asServiceRole.entities.MessageSyncLog.create({
             sync_status: 'error', action: 'message_create',
             error_message: (err as Error)?.message?.slice(0, 500) || 'Erro desconhecido',
             event_type: event, batch_id: batchId, instance: instanceId,
           }).catch(() => {});
         }
       }

      // ── Auto-resposta via IA (orquestrador) ──────────────────────────────────
      // Para cada mensagem recebida (incoming) onde a conversa tem ai_enabled,
      // chama o orquestrador com contexto do cliente (nome, IXC, horário) e envia
      // a resposta automaticamente via Evolution API.
      try {
        const evoBase = Deno.env.get('EVOLUTION_API_URL') || '';
        const evoKey = Deno.env.get('EVOLUTION_API_KEY') || '';
        let instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'woow';
        // Auto-detecta instância conectada se a padrão não estiver ativa
        if (evoBase && evoKey && instanceName) {
          try {
            const listRes = await fetch(evoBase.replace(/\/+$/, '') + '/instance/fetchInstances', { headers: { apikey: evoKey } });
            if (listRes.ok) {
              const listData = await listRes.json().catch(() => []);
              const list = Array.isArray(listData) ? listData : [];
              const all = list.map((item) => {
                const rec = asRecord(item);
                const inst = asRecord(rec.instance || rec);
                const stateRaw = String(inst.connectionStatus || inst.state || inst.status || 'close').toLowerCase();
                return { name: String(inst.name || inst.instanceName || ''), state: stateRaw === 'open' || stateRaw === 'connected' ? 'connected' : 'disconnected' };
              });
              const target = all.find((i) => i.name === instanceName);
              if (!target || target.state !== 'connected') {
                const connected = all.find((i) => i.state === 'connected' && i.name);
                if (connected) instanceName = connected.name;
              }
            }
          } catch { /* mantém instanceName atual */ }
        }

        for (const msg of batch) {
          const key = asRecord(msg.key || msg.Key);
          const fromMe = !!(key.fromMe ?? key.FromMe ?? key.IsFromMe);
          if (fromMe) continue;
          const phone = String(key.remoteJid || key.RemoteJid || key.Chat || '').replace(/@.*$/, '');
          if (!phone) continue;
          const conversation = convMap.get(phone) as AnyRecord | undefined;
          if (!conversation || !(conversation.ai_enabled)) continue;

          const textContent = extractText(asRecord(msg.message || msg.Message || {}));
          if (!textContent) continue;

          // Busca mensagens recentes para contexto da conversa
          const recentMsgs = await base44.asServiceRole.entities.Message.filter({ conversation_id: conversation.id }).catch(() => []);
          const history = (recentMsgs as AnyRecord[])
            .sort((a, b) => new Date((a.timestamp as string) || 0).getTime() - new Date((b.timestamp as string) || 0).getTime())
            .slice(-10)
            .map((m) => ({ direction: (m.direction as string) === 'in' ? 'in' : 'out', content: String(m.content || '') }));

          // Determina saudação por horário
          const hour = new Date().getHours();
          const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
          const customerName = (conversation.customer_name as string) || phone;

          // Chama o orquestrador de IA
          const orchResp = await base44.asServiceRole.functions.invoke('aiOrchestrator', {
            message: textContent,
            phone,
            customer_name: customerName,
            conversation_history: history,
            customer_context: {
              name: customerName,
              phone,
              city: (conversation.city as string) || null,
              greeting,
            },
            mode: 'auto',
          }) as AnyRecord;

          const reply = (orchResp?.orchestrator as AnyRecord)?.response && typeof (orchResp.orchestrator as AnyRecord).response === 'object'
            ? ((orchResp.orchestrator as AnyRecord).response as AnyRecord).reply as string
            : undefined;

          if (reply && evoBase && evoKey) {
            // Envia a resposta via Evolution API
            const { sendWhatsAppMessage } = await import('../../shared/evolutionSend.ts');
            const sendResult = await sendWhatsAppMessage({ base: evoBase, apiKey: evoKey, instanceName, number: phone, text: reply });

            // Salva a resposta da IA como mensagem
            const nowIso = new Date().toISOString();
            await base44.asServiceRole.entities.Message.create({
              conversation_id: conversation.id,
              content: reply,
              direction: 'ai',
              type: 'text',
              status: sendResult.success ? 'sent' : 'failed',
              timestamp: nowIso,
              sender_name: 'IA Lara',
              phone,
              assigned_user_id: (conversation.assigned_user_id as string) || null,
              ...(sendResult.wa_message_id ? { wa_message_id: sendResult.wa_message_id } : {}),
            });

            // Atualiza última mensagem da conversa
            await base44.asServiceRole.entities.Conversation.update(conversation.id as string, {
              last_message: reply,
              last_message_time: nowIso,
              is_ai: true,
            }).catch(() => {});

            // Log de sincronização da resposta da IA
            await base44.asServiceRole.entities.MessageSyncLog.create({
              phone, wa_message_id: sendResult?.wa_message_id || null,
              conversation_id: conversation.id as string, instance: instanceName,
              direction: 'ai', sync_status: sendResult?.success ? 'synced' : 'error',
              action: 'ai_response',
              message_preview: reply.slice(0, 100),
              error_message: sendResult?.success ? null : sendResult?.error || null,
              event_type: event, batch_id: batchId,
            }).catch(() => {});
          }
        }
      } catch { /* não bloqueia o fluxo principal do webhook */ }

      await base44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionWebhook', action: event, status: 'sucesso',
        details: `saved: ${saved}, skipped: ${skipped}, errors: ${errors}, total: ${batch.length}`,
      }).catch(() => {});
      return Response.json({ success: true, saved, skipped, errors, total: batch.length });
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
    await logError(base44, 'evolutionWebhook', error, { action: event || 'unknown', severity: 'alta' });
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {};
}