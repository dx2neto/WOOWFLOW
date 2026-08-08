import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { logError } from '../../shared/errorLogger.ts';
import { sendWhatsAppMessage } from '../../shared/evolutionSend.ts';
import { fetchWithRetry } from '../../shared/fetchWithRetry.ts';

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {};
}

function extractText(msgBody: AnyRecord): string {
  return String(
    msgBody.conversation ??
    (msgBody.extendedTextMessage as AnyRecord)?.text ??
    (msgBody.imageMessage as AnyRecord)?.caption ??
    (msgBody.videoMessage as AnyRecord)?.caption ??
    (msgBody.documentMessage as AnyRecord)?.title ??
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

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'get_status');

    const evoBase = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const evoKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    const defaultInst = Deno.env.get('EVOLUTION_INSTANCE_NAME') || '';
    const authHeaders: Record<string, string> = { apikey: evoKey };
    const jsonHeaders: Record<string, string> = { ...authHeaders, 'Content-Type': 'application/json' };

    const log = (a: string, s: string, d = '') =>
      base44.asServiceRole.entities.IntegrationLog.create({
        integration: 'aiOmnichannelApi', action: a, status: s, details: d.slice(0, 500),
      }).catch(() => {});

    // ── get_status: verifica conexão com Evolution API ──────────────────────
    if (action === 'get_status' || action === 'test_connection') {
      const ready = !!evoBase && !!evoKey;
      let instances: AnyRecord[] = [];
      let connectedInstance = '';
      if (ready) {
        try {
          const res = await fetchWithRetry(`${evoBase}/instance/fetchInstances`, { headers: authHeaders });
          if (res.ok) {
            const data = await res.json().catch(() => []);
            const list = Array.isArray(data) ? data : [];
            instances = list.map((item) => {
              const rec = asRecord(item);
              const inst = asRecord(rec.instance || rec);
              const stateRaw = String(inst.connectionStatus || inst.state || inst.status || 'close').toLowerCase();
              return {
                name: String(inst.name || inst.instanceName || ''),
                state: stateRaw === 'open' || stateRaw === 'connected' ? 'connected' : stateRaw === 'connecting' ? 'connecting' : 'disconnected',
              };
            }).filter((i) => i.name);
            connectedInstance = instances.find((i) => i.state === 'connected')?.name || '';
          }
        } catch { /* ignore */ }
      }
      const status = ready && (connectedInstance || defaultInst) ? 'connected' : ready ? 'pending' : 'disconnected';
      await log(action, ready ? 'sucesso' : 'falha', `status: ${status}, instances: ${instances.length}`);
      return Response.json({
        success: ready,
        service: 'ai_omnichannel',
        status,
        evolution_ready: ready,
        connected_instance: connectedInstance || defaultInst || null,
        instances,
        error: ready ? null : 'Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no backend.',
      });
    }

    // ── send_message: envia mensagem via Evolution API ───────────────────────
    if (action === 'send_message' || action === 'send_text') {
      const phone = String(body.phone || '').replace(/\D/g, '');
      const text = String(body.message || body.text || '').trim();
      const instanceName = String(body.instance || defaultInst || '');
      const conversationId = String(body.conversation_id || '');

      if (!phone || !text) return Response.json({ success: false, error: 'phone e message são obrigatórios' }, { status: 400 });
      if (!evoBase || !evoKey) return Response.json({ success: false, error: 'Evolution API não configurada' }, { status: 500 });
      if (!instanceName) return Response.json({ success: false, error: 'Nenhuma instância configurada' }, { status: 400 });

      const sendResult = await sendWhatsAppMessage({ base: evoBase, apiKey: evoKey, instanceName, number: phone, text });

      if (!sendResult.success) {
        await log('send_message', 'falha', sendResult.error || '');
        return Response.json({ success: false, error: sendResult.error || 'Falha ao enviar mensagem' }, { status: 502 });
      }

      // Salva a mensagem enviada no banco
      const nowIso = new Date().toISOString();
      const savedMessage = await base44.asServiceRole.entities.Message.create({
        conversation_id: conversationId || null,
        content: text,
        direction: 'out',
        type: 'text',
        status: 'sent',
        timestamp: nowIso,
        sender_name: user.full_name || user.email || 'Atendente',
        provider: 'evolution_api',
        provider_message_id: sendResult.wa_message_id || null,
        wa_message_id: sendResult.wa_message_id || null,
        instance_id: instanceName,
        phone,
        chat_jid: `${phone}@s.whatsapp.net`,
      }).catch(() => null);

      // Atualiza última mensagem da conversa
      if (conversationId && savedMessage) {
        await base44.asServiceRole.entities.Conversation.update(conversationId, {
          last_message: text,
          last_message_time: nowIso,
          status: 'em_atendimento',
          unread: false,
        }).catch(() => {});
      }

      await base44.asServiceRole.entities.MessageSyncLog.create({
        phone, wa_message_id: sendResult.wa_message_id || null,
        conversation_id: conversationId || null, instance: instanceName,
        direction: 'out', sync_status: 'synced', action: 'message_send',
        message_preview: text.slice(0, 100),
      }).catch(() => {});

      await log('send_message', 'sucesso', `phone: ${phone}, wa_id: ${sendResult.wa_message_id || ''}`);
      return Response.json({ success: true, wa_message_id: sendResult.wa_message_id, message: savedMessage });
    }

    // ── load_messages: carrega mensagens de uma conversa ─────────────────────
    if (action === 'load_messages' || action === 'get_messages') {
      const conversationId = String(body.conversation_id || '');
      const phone = String(body.phone || '').replace(/\D/g, '');
      const limit = Number(body.limit || 100);

      if (!conversationId && !phone) return Response.json({ success: false, error: 'conversation_id ou phone é obrigatório' }, { status: 400 });

      let filter: AnyRecord = {};
      if (conversationId) filter.conversation_id = conversationId;
      else filter.phone = phone;

      const messages = await base44.asServiceRole.entities.Message.filter(filter, '-timestamp', limit);
      await log('load_messages', 'sucesso', `conversation: ${conversationId || phone}, count: ${messages.length}`);
      return Response.json({ success: true, messages });
    }

    // ── sync_history: solicita sincronização de histórico via Evolution API ──
    if (action === 'sync_history') {
      const phone = String(body.phone || '').replace(/\D/g, '');
      if (!phone) return Response.json({ success: false, error: 'phone é obrigatório' }, { status: 400 });
      if (!evoBase || !evoKey) return Response.json({ success: false, error: 'Evolution API não configurada' }, { status: 500 });

      let instName = String(body.instance || defaultInst || '');

      // Se não houver instância definida, busca uma conectada
      if (!instName) {
        const res = await fetchWithRetry(`${evoBase}/instance/fetchInstances`, { headers: authHeaders });
        const data = await res.json().catch(() => []);
        const list = Array.isArray(data) ? data : [];
        const connected = list.map((item) => {
          const rec = asRecord(item);
          const inst = asRecord(rec.instance || rec);
          const stateRaw = String(inst.connectionStatus || inst.state || inst.status || '').toLowerCase();
          return { name: String(inst.name || inst.instanceName || ''), state: stateRaw === 'open' || stateRaw === 'connected' ? 'connected' : 'disconnected' };
        }).find((i) => i.state === 'connected' && i.name);
        instName = connected?.name || '';
      }

      if (!instName) return Response.json({ success: false, error: 'Nenhuma instância conectada' }, { status: 400 });

      const r = await fetchWithRetry(`${evoBase}/chat/findMessages/${encodeURIComponent(instName)}`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ where: { id: `${phone}@s.whatsapp.net` }, limit: Number(body.limit || 50) }),
      }).catch(() => null);

      await log('sync_history', r?.ok ? 'sucesso' : 'falha', `phone: ${phone}, instance: ${instName}`);
      return Response.json({
        success: r?.ok ?? false,
        requested: r?.ok ?? false,
        note: 'Mensagens antigas chegam via webhook.',
        instance: instName,
      });
    }

    // ── load_conversations: lista conversas do WhatsApp ──────────────────────
    if (action === 'load_conversations' || action === 'get_chats') {
      if (!evoBase || !evoKey) return Response.json({ success: false, error: 'Evolution API não configurada' }, { status: 500 });
      const instName = String(body.instance || defaultInst || '');
      if (!instName) return Response.json({ success: false, error: 'Nenhuma instância configurada' }, { status: 400 });

      const r = await fetchWithRetry(`${evoBase}/chat/findChats/${encodeURIComponent(instName)}`, { headers: authHeaders });
      if (!r.ok) {
        await log('load_conversations', 'falha', `status: ${r.status}`);
        return Response.json({ success: false, error: 'Falha ao carregar conversas', chats: [] }, { status: r.status || 502 });
      }
      const data = await r.json().catch(() => []);
      const chats = Array.isArray(data) ? data : [];
      await log('load_conversations', 'sucesso', `chats: ${chats.length}`);
      return Response.json({ success: true, chats });
    }

    // ── mark_read: marca conversa como lida ──────────────────────────────────
    if (action === 'mark_read' || action === 'mark_as_read') {
      const phone = String(body.phone || '').replace(/\D/g, '');
      if (!phone) return Response.json({ success: false, error: 'phone é obrigatório' }, { status: 400 });
      if (!evoBase || !evoKey) return Response.json({ success: false, error: 'Evolution API não configurada' }, { status: 500 });
      const instName = String(body.instance || defaultInst || '');
      if (!instName) return Response.json({ success: false, error: 'Nenhuma instância configurada' }, { status: 400 });

      const ids = (Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : []).map((id: unknown) => ({ id, fromMe: false, remoteJid: `${phone}@s.whatsapp.net` }));
      const r = await fetchWithRetry(`${evoBase}/chat/markMessageAsRead/${encodeURIComponent(instName)}`, {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ read: ids }),
      });

      if (body.conversation_id) {
        await base44.asServiceRole.entities.Conversation.update(String(body.conversation_id), { unread: false }).catch(() => {});
      }
      await log('mark_read', r.ok ? 'sucesso' : 'falha', `phone: ${phone}`);
      return Response.json({ success: r.ok });
    }

    return Response.json({ success: false, error: `Ação não suportada: ${action}` }, { status: 400 });
  } catch (error) {
    await logError(base44, 'aiOmnichannelApi', error, { action: (body as AnyRecord)?.action || 'unknown', severity: 'alta' });
    return Response.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
});