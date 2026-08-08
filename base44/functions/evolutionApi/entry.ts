import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { logError } from '../../shared/errorLogger.ts';
import { fetchWithRetry } from '../../shared/fetchWithRetry.ts';

// ═══════════════════════════════════════════════════════════════════════════
// Evolution API (oficial, Baileys) — https://docs.evolutionfoundation.com.br
// Autenticação: header global `apikey` em todos os endpoints.
// Instância identificada por nome no path: /instance/connect/{instanceName}
// ═══════════════════════════════════════════════════════════════════════════

const BASE = (url: string) => url.replace(/\/+$/, '');
type AnyRecord = Record<string, unknown>;

async function evoFetch(url: string, opts: RequestInit = {}) {
  try {
    const res = await fetchWithRetry(url, opts);
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: { message: 'Não foi possível acessar a Evolution API.', detail: (error as Error).message } };
  }
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : {};
}

// QR code chega em `base64` (data:image/png;base64,...) ou `code` (string de pareamento).
function extractQr(payload: unknown): { base64: string | null; code: string | null } {
  const root = asRecord(payload);
  const qr = asRecord(root.qrcode || root.qr || root);
  const b64 = String(qr.base64 || root.base64 || '');
  const code = String(qr.code || root.code || qr.pairingCode || root.pairingCode || '');
  return {
    base64: b64.startsWith('data:image') ? b64 : (b64 ? `data:image/png;base64,${b64}` : null),
    code: code && code !== 'null' ? code : null,
  };
}

// Lista de instâncias — response pode ser flat [{ id, name, connectionStatus, ... }]
// ou aninhado [{ instance: { instanceName, status, ... } }] conforme a versão.
function normalizeInstanceList(data: unknown) {
  const list = Array.isArray(data) ? data : [];
  return list.map((item) => {
    const rec = asRecord(item);
    const inst = asRecord(rec.instance || rec);
    const stateRaw = String(inst.connectionStatus || inst.state || inst.status || 'close').toLowerCase();
    return {
      id: String(inst.id || inst.instanceId || inst.instanceName || ''),
      name: String(inst.name || inst.instanceName || ''),
      state: stateRaw === 'open' || stateRaw === 'connected' ? 'connected' : stateRaw === 'connecting' ? 'connecting' : 'disconnected',
      qrcode: extractQr(inst).base64,
      phone: String(inst.number || inst.ownerJid || '').replace(/\s/g, ''),
      profileName: String(inst.profileName || inst.pushName || inst.name || inst.instanceName || ''),
    };
  }).filter((i) => i.name);
}

function extractMessageId(payload: unknown): string | null {
  const root = asRecord(payload);
  const key = asRecord(root.key);
  const id = String(key.id || key.ID || root.id || root.messageId || '');
  return id && id !== 'null' ? id : null;
}

Deno.serve(async (req) => {
  const b44 = createClientFromRequest(req);

  try {
    const user = await b44.auth.me().catch(() => null);
    const internalToken = Deno.env.get('INTERNAL_FUNCTION_TOKEN') || '';
    const internalOk = internalToken !== '' && req.headers.get('x-internal-token') === internalToken;
    if (!user && !internalOk) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const base = BASE(Deno.env.get('EVOLUTION_API_URL') || '');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    const envInst = Deno.env.get('EVOLUTION_INSTANCE_NAME') || '';

    if (!base) return Response.json({ success: false, error: { code: 'EVOLUTION_API_URL_NOT_SET', message: 'Variável EVOLUTION_API_URL não configurada.' } }, { status: 500 });
    if (!apiKey) return Response.json({ success: false, error: { code: 'EVOLUTION_API_KEY_NOT_SET', message: 'Variável EVOLUTION_API_KEY não configurada.' } }, { status: 500 });

    const authHeaders = { apikey: apiKey };
    const jsonHeaders = { ...authHeaders, 'Content-Type': 'application/json' };

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'list_instances');

    // Instância: prioriza a selecionada no frontend; se não houver, auto-detecta conectada
    let instanceName = String(body.instanceName || body.instance || '').trim();
    if (!instanceName) {
      try {
        const listRes = await fetchWithRetry(`${base}/instance/fetchInstances`, { headers: authHeaders });
        const listData = listRes.ok ? await listRes.json().catch(() => []) : [];
        const list = Array.isArray(listData) ? listData : [];
        const connected = list.map((item) => {
          const rec = asRecord(item);
          const inst = asRecord(rec.instance || rec);
          const stateRaw = String(inst.connectionStatus || inst.state || inst.status || 'close').toLowerCase();
          return { name: String(inst.name || inst.instanceName || ''), state: stateRaw === 'open' || stateRaw === 'connected' ? 'connected' : 'disconnected' };
        }).find((i) => i.state === 'connected' && i.name);
        instanceName = connected?.name || envInst || '';
      } catch { instanceName = envInst || ''; }
    }

    const log = (a: string, s: string, d = '') => b44.asServiceRole.entities.IntegrationLog.create({ integration: 'evolutionApi', action: a, status: s, details: d.slice(0, 500) }).catch(() => {});

    // ── list_instances / test_connection ────────────────────────────────────
    // GET /instance/fetchInstances
    if (action === 'list_instances' || action === 'get_instances' || action === 'test_connection' || !body.action) {
      const r = await evoFetch(`${base}/instance/fetchInstances`, { headers: authHeaders });
      if (!r.ok) {
        await log(action, 'falha', JSON.stringify(r.data));
        return Response.json({ success: false, error: 'Falha ao conectar à Evolution API', details: r.data }, { status: r.status || 502 });
      }
      const instances = normalizeInstanceList(r.data);
      await log(action, 'sucesso', `instâncias: ${instances.length}`);
      return Response.json({ success: true, instances, defaultInstance: defaultInst });
    }

    // ── create_instance ──────────────────────────────────────────────────────
    // POST /instance/create  body: { instanceName, qrcode, integration, token, webhook }
    if (action === 'create_instance') {
      const name = String(body.instanceName || '').trim();
      if (!name) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      const createBody: AnyRecord = { instanceName: name, qrcode: true, integration: 'WHATSAPP-BAILEYS' };
      if (body.token) createBody.token = body.token;
      if (body.webhookUrl || body.webhook_url) {
        createBody.webhook = { enabled: true, url: body.webhookUrl || body.webhook_url, events: body.events || ['messages.upsert', 'connection.update', 'qrcode.updated', 'messages.update'] };
      }
      const r = await evoFetch(`${base}/instance/create`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(createBody) });
      if (!r.ok) { await log('create_instance', 'falha', JSON.stringify(r.data)); return Response.json({ success: false, error: 'Falha ao criar instância', details: r.data }, { status: r.status || 502 }); }
      const qr = extractQr(r.data);
      await log('create_instance', 'sucesso', `instance: ${name}`);
      return Response.json({ success: true, instance: normalizeInstanceList([r.data])[0] || { name }, qrcode: qr.base64, qrCode: qr });
    }

    // ── connect_instance ────────────────────────────────────────────────────
    // GET /instance/connect/{instanceName}
    if (action === 'connect_instance') {
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      const r = await evoFetch(`${base}/instance/connect/${encodeURIComponent(instanceName)}`, { headers: authHeaders });
      if (!r.ok) { await log('connect_instance', 'falha', JSON.stringify(r.data)); return Response.json({ success: false, error: 'Falha ao conectar instância', details: r.data }, { status: r.status || 502 }); }
      const qr = extractQr(r.data);
      await log('connect_instance', 'sucesso', `instance: ${instanceName}`);
      return Response.json({ success: true, result: r.data, qrcode: qr.base64, qrCode: qr, state: 'connecting' });
    }

    // ── get_qrcode ───────────────────────────────────────────────────────────
    // GET /instance/connect/{instanceName} (re-conecta e devolve QR)
    if (action === 'get_qrcode') {
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      const st = await evoFetch(`${base}/instance/connectionState/${encodeURIComponent(instanceName)}`, { headers: authHeaders });
      const stInst = asRecord(asRecord(st.data).instance);
      const state = String(stInst.state || '').toLowerCase();
      if (state === 'open' || state === 'connected') { await log('get_qrcode', 'sucesso', 'já conectada'); return Response.json({ success: true, qrcode: null, state: 'connected', message: 'A instância já está conectada.' }); }
      const r = await evoFetch(`${base}/instance/connect/${encodeURIComponent(instanceName)}`, { headers: authHeaders });
      const qr = extractQr(r.ok ? r.data : null);
      if (qr.base64 || qr.code) { await log('get_qrcode', 'sucesso', `instance: ${instanceName}`); return Response.json({ success: true, qrcode: qr, state: 'connecting' }); }
      await log('get_qrcode', 'falha', `instance: ${instanceName} — QR indisponível`);
      return Response.json({ success: false, error: 'QR code indisponível. Clique em "Reconectar" para gerar um novo.', details: r.data }, { status: r.status || 404 });
    }

    // ── get_status / get_instance_status ────────────────────────────────────
    // GET /instance/connectionState/{instanceName}
    if (action === 'get_status' || action === 'get_instance_status') {
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      const r = await evoFetch(`${base}/instance/connectionState/${encodeURIComponent(instanceName)}`, { headers: authHeaders });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao buscar status', details: r.data }, { status: r.status || 502 });
      const inst = asRecord(asRecord(r.data).instance);
      const raw = String(inst.state || '').toLowerCase();
      return Response.json({ success: true, state: raw === 'open' ? 'connected' : raw === 'connecting' ? 'connecting' : 'disconnected', instance: inst, result: r.data });
    }

    // ── get_instance_info ───────────────────────────────────────────────────
    if (action === 'get_instance_info') {
      const r = await evoFetch(`${base}/instance/fetchInstances`, { headers: authHeaders });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao buscar instâncias', details: r.data }, { status: r.status || 502 });
      const inst = normalizeInstanceList(r.data).find((i) => i.name === instanceName);
      return Response.json({ success: true, instance: inst || { name: instanceName, state: 'unknown' } });
    }

    // ── logout_instance ─────────────────────────────────────────────────────
    // DELETE /instance/logout/{instanceName}
    if (action === 'logout_instance') {
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      const r = await evoFetch(`${base}/instance/logout/${encodeURIComponent(instanceName)}`, { method: 'DELETE', headers: authHeaders });
      await log('logout_instance', r.ok ? 'sucesso' : 'falha', `instance: ${instanceName}`);
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao desconectar instância', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── delete_instance ─────────────────────────────────────────────────────
    // DELETE /instance/delete/{instanceName}
    if (action === 'delete_instance') {
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      const r = await evoFetch(`${base}/instance/delete/${encodeURIComponent(instanceName)}`, { method: 'DELETE', headers: authHeaders });
      await log('delete_instance', r.ok ? 'sucesso' : 'falha', `instance: ${instanceName}`);
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao excluir instância', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── reconnect_instance ──────────────────────────────────────────────────
    // POST /instance/restart/{instanceName}
    if (action === 'reconnect_instance' || action === 'restart_instance') {
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      const r = await evoFetch(`${base}/instance/restart/${encodeURIComponent(instanceName)}`, { method: 'POST', headers: authHeaders });
      await log('reconnect_instance', r.ok ? 'sucesso' : 'falha', `instance: ${instanceName}`);
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao reiniciar instância', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── send_message / send_text ───────────────────────────────────────────
    // POST /message/sendText/{instanceName}  body: { number, textMessage: { text }, delay }
    if (action === 'send_message' || action === 'send_text') {
      const { phone, message, text } = body;
      const number = String(phone || '').replace(/\D/g, '');
      const textContent = String(message ?? text ?? '');
      if (!number || !textContent) return Response.json({ error: 'phone e message são obrigatórios' }, { status: 400 });
      const r = await evoFetch(`${base}/message/sendText/${encodeURIComponent(instanceName)}`, {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ number, text: textContent, textMessage: { text: textContent }, delay: body.delay ?? 500 }),
      });
      if (!r.ok) { await log('send_message', 'falha', JSON.stringify(r.data)); return Response.json({ success: false, error: 'Falha ao enviar mensagem', details: r.data }, { status: r.status || 502 }); }
      const waId = extractMessageId(r.data);
      await log('send_message', 'sucesso', waId ? `wa_id: ${waId}` : '');
      return Response.json({ success: true, result: r.data, wa_message_id: waId, provider_message_id: waId });
    }

    // ── send_media ──────────────────────────────────────────────────────────
    // POST /message/sendMedia/{instanceName}  multipart/form-data
    if (action === 'send_media') {
      const { phone, url, type: mediaType, caption, filename } = body;
      const number = String(phone || '').replace(/\D/g, '');
      if (!number || !url) return Response.json({ error: 'phone e url são obrigatórios' }, { status: 400 });

      // Baixa o arquivo da URL e reenvia como multipart
      const mediaRes = await fetch(url);
      if (!mediaRes.ok) return Response.json({ success: false, error: 'Falha ao baixar mídia da URL informada' }, { status: 502 });
      const mediaBlob = await mediaRes.blob();
      const formData = new FormData();
      formData.append('number', number);
      formData.append('mediatype', String(mediaType || 'image'));
      formData.append('media', mediaBlob, String(filename || 'media'));
      if (caption) formData.append('caption', String(caption));
      if (filename) formData.append('fileName', String(filename));

      const r = await evoFetch(`${base}/message/sendMedia/${encodeURIComponent(instanceName)}`, { method: 'POST', headers: authHeaders, body: formData });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao enviar mídia', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data, wa_message_id: extractMessageId(r.data) });
    }

    // ── send_audio (PTT — push to talk) ──────────────────────────────────────
    // POST /message/sendWhatsAppAudio/{instanceName}  body: { number, audio: { audio: url }, delay }
    if (action === 'send_audio' || action === 'send_ptt') {
      const { phone, url, caption } = body;
      const number = String(phone || '').replace(/\D/g, '');
      if (!number || !url) return Response.json({ error: 'phone e url são obrigatórios' }, { status: 400 });
      const r = await evoFetch(`${base}/message/sendWhatsAppAudio/${encodeURIComponent(instanceName)}`, {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ number, audio: { audio: url }, delay: body.delay ?? 500 }),
      });
      if (!r.ok) { await log('send_audio', 'falha', JSON.stringify(r.data)); return Response.json({ success: false, error: 'Falha ao enviar áudio', details: r.data }, { status: r.status || 502 }); }
      const waId = extractMessageId(r.data);
      await log('send_audio', 'sucesso', waId ? `wa_id: ${waId}` : '');
      return Response.json({ success: true, result: r.data, wa_message_id: waId, provider_message_id: waId });
    }

    // ── get_contacts ────────────────────────────────────────────────────────
    // GET /chat/findContacts/{instanceName}
    if (action === 'get_contacts') {
      const r = await evoFetch(`${base}/chat/findContacts/${encodeURIComponent(instanceName)}`, { headers: authHeaders });
      if (!r.ok) { await log('get_contacts', 'falha', `status ${r.status}`); return Response.json({ success: false, error: r.status === 401 ? 'Instância desconectada. Reconecte via QR code.' : 'Falha ao carregar contatos', details: r.data }, { status: r.status || 502 }); }
      await log('get_contacts', 'sucesso');
      return Response.json({ success: true, contacts: r.data });
    }

    // ── get_chats ───────────────────────────────────────────────────────────
    // GET /chat/findChats/{instanceName}
    if (action === 'get_chats') {
      const r = await evoFetch(`${base}/chat/findChats/${encodeURIComponent(instanceName)}`, { headers: authHeaders });
      if (!r.ok) return Response.json({ success: false, error: 'Não foi possível listar conversas', chats: [] }, { status: r.status || 502 });
      return Response.json({ success: true, chats: r.data });
    }

    // ── get_messages ────────────────────────────────────────────────────────
    // Retorna mensagens já salvas localmente (não há endpoint REST de leitura).
    if (action === 'get_messages') {
      const conversationId = String(body.conversation_id || '');
      if (!conversationId) return Response.json({ error: 'conversation_id é obrigatório' }, { status: 400 });
      const messages = await b44.asServiceRole.entities.Message.filter({ conversation_id: conversationId });
      return Response.json({ success: true, messages });
    }

    // ── sync_history ────────────────────────────────────────────────────────
    // POST /chat/findMessages/{instanceName}  body: { where: { id, limit } }
    // No official Evolution API, history arrives via webhook; this requests a sync.
    if (action === 'sync_history') {
      const phone = String(body.phone || '').replace(/\D/g, '');
      if (!phone) return Response.json({ error: 'phone é obrigatório' }, { status: 400 });

      // Se a instância informada não existir, tenta encontrar uma conectada
      let instName = instanceName;
      if (instName === defaultInst) {
        const instList = await evoFetch(`${base}/instance/fetchInstances`, { headers: authHeaders });
        const instances = normalizeInstanceList(instList.data);
        const connected = instances.find((i) => i.state === 'connected');
        if (connected) instName = connected.name;
      }

      const r = await evoFetch(`${base}/chat/findMessages/${encodeURIComponent(instName)}`, {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ where: { id: `${phone}@s.whatsapp.net` }, limit: Number(body.limit ?? 50) }),
      }).catch(() => ({ ok: false, status: 501, data: { message: 'Endpoint de histórico não disponível nesta versão.' } }));
      await log('sync_history', r.ok ? 'sucesso' : 'falha', `phone: ${phone}, instance: ${instName}`);
      return Response.json({ success: r.ok, created: 0, requested: r.ok, note: 'Mensagens antigas chegam via webhook.', details: r.data, instance: instName });
    }

    // ── mark_read ───────────────────────────────────────────────────────────
    // POST /chat/markMessageAsRead/{instanceName}  body: { read: [{ id, fromMe, remoteJid }] }
    if (action === 'mark_read' || action === 'mark_as_read') {
      const phone = String(body.phone || '').replace(/\D/g, '');
      if (!phone) return Response.json({ error: 'phone é obrigatório' }, { status: 400 });
      const ids: AnyRecord[] = (Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : []).map((id: unknown) => ({ id, fromMe: false, remoteJid: `${phone}@s.whatsapp.net` }));
      const r = await evoFetch(`${base}/chat/markMessageAsRead/${encodeURIComponent(instanceName)}`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ read: ids }) });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao marcar como lida', details: r.data }, { status: r.status || 502 });
      if (body.conversation_id) await b44.asServiceRole.entities.Conversation.update(String(body.conversation_id), { unread: false }).catch(() => {});
      return Response.json({ success: true, result: r.data });
    }

    // ── presence ────────────────────────────────────────────────────────────
    // POST /chat/presence/{instanceName}  body: { presence: "composing"|"paused" }
    if (action === 'presence' || action === 'send_presence') {
      const phone = String(body.phone || '').replace(/\D/g, '');
      if (!phone) return Response.json({ error: 'phone é obrigatório' }, { status: 400 });
      const r = await evoFetch(`${base}/chat/presence/${encodeURIComponent(instanceName)}`, {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ presence: body.state || 'composing', remoteJid: `${phone}@s.whatsapp.net` }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao enviar presença', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── server_health ───────────────────────────────────────────────────────
    if (action === 'server_health') {
      const r = await evoFetch(`${base}/instance/fetchInstances`, { headers: authHeaders });
      return Response.json({ success: r.ok, status: r.status });
    }

    // ── get_instance_logs / disconnect_instance / force_reconnect ───────────
    if (action === 'disconnect_instance') {
      const r = await evoFetch(`${base}/instance/logout/${encodeURIComponent(instanceName)}`, { method: 'DELETE', headers: authHeaders });
      await log('disconnect_instance', r.ok ? 'sucesso' : 'falha', `instance: ${instanceName}`);
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao desconectar', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    if (action === 'force_reconnect' || action === 'get_instance_logs') {
      const r = await evoFetch(`${base}/instance/restart/${encodeURIComponent(instanceName)}`, { method: 'POST', headers: authHeaders });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao reiniciar', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    return Response.json({ error: `Action inválida: ${action}` }, { status: 400 });
  } catch (error) {
    await logError(b44, 'evolutionApi', error, { action: action || 'unknown', severity: 'alta' });
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});