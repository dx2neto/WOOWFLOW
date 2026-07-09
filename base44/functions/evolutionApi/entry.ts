import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── helpers ─────────────────────────────────────────────────────────────────
const BASE = (url: string) => url.replace(/\/$/, '');
type AnyRecord = Record<string, unknown>;

/**
 * Faz uma requisição à Evolution Go e retorna { ok, status, data }.
 */
async function evoFetch(url: string, opts: RequestInit = {}) {
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: {
        message: 'Não foi possível acessar a Evolution Go API.',
        detail: (error as Error).message,
      },
    };
  }
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as AnyRecord
    : {};
}

function payloadList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const root = asRecord(data);
  const nested = asRecord(root.data);
  const candidates = [
    root.instances, root.instance, root.result, root.response, root.data,
    nested.instances, nested.instance, nested.result, nested.response,
  ];
  for (const value of candidates) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function nestedInstance(inst: AnyRecord): AnyRecord {
  return asRecord(inst.instance);
}

function instanceNameOf(inst: AnyRecord): string {
  const nested = nestedInstance(inst);
  return String(inst.name ?? inst.instanceName ?? nested.name ?? nested.instanceName ?? inst.id ?? '');
}

// Busca todas as instâncias (endpoint admin) e retorna a instância pelo nome.
// Se o nome informado não bater com nenhuma instância mas existir só uma instância cadastrada, usa essa (evita
// falhas quando o nome padrão/salvo no navegador ficou desatualizado em relação ao nome real na Evolution Go).
async function findInstance(base: string, adminToken: string, name: string) {
  const r = await evoFetch(`${base}/instance/all`, { headers: { apikey: adminToken } });
  if (!r.ok) return null;
  const list = payloadList(r.data).map(asRecord);
  const match = list.find((i) => instanceNameOf(i) === name);
  if (match) return match;
  if (list.length === 1) return list[0];
  return undefined;
}

// Extrai o TOKEN DA INSTÂNCIA (usado como apikey em todas as rotas por-instância: /send, /user, /chat, /message, /group, /instance/status, /instance/qr, /instance/connect, etc.)
function extractToken(inst: AnyRecord, fallback: string): string {
  const nested = nestedInstance(inst);
  return String(
    inst.token ?? inst.apitoken ?? inst.apiToken ?? inst.instanceToken ??
    nested.token ?? nested.apitoken ?? nested.apiToken ?? nested.instanceToken ??
    fallback
  );
}

function normalizeState(inst: AnyRecord): string {
  const nested = nestedInstance(inst);
  if (asRecord(inst.data).LoggedIn === true || inst.LoggedIn === true || nested.LoggedIn === true) return 'connected';
  if (typeof inst?.connected === 'boolean') return inst.connected ? 'connected' : 'disconnected';
  if (typeof nested?.connected === 'boolean') return nested.connected ? 'connected' : 'disconnected';
  const raw = String(
    inst?.status ?? inst?.connectionStatus ?? inst?.state ??
    nested?.status ?? nested?.connectionStatus ?? nested?.state ?? ''
  ).toLowerCase();
  if (raw.includes('open') || raw.includes('logged') || raw === 'true') return 'connected';
  if (raw.includes('qr') || raw.includes('connect') || raw.includes('pair')) return 'connecting';
  if (raw.includes('close') || raw.includes('disconnect') || raw.includes('logout')) return 'disconnected';
  return raw || 'unknown';
}

function normalizeQrString(value: unknown) {
  if (typeof value !== 'string') return { base64: null as string | null, code: null as string | null };
  const raw = value.trim();
  if (!raw) return { base64: null, code: null };
  const firstPart = raw.split('|')[0].trim();
  if (firstPart.startsWith('data:image/')) return { base64: firstPart, code: null };
  if (firstPart.includes('base64,')) {
    const dataUrl = firstPart.startsWith('data:') ? firstPart : `data:image/png;base64,${firstPart.split('base64,').pop()}`;
    return { base64: dataUrl, code: null };
  }
  if (/^(iVBORw0KGgo|\/9j\/|R0lGOD|PHN2Zy)/.test(firstPart) || (firstPart.length > 400 && /^[A-Za-z0-9+/=\s]+$/.test(firstPart))) {
    return { base64: `data:image/png;base64,${firstPart.replace(/\s/g, '')}`, code: null };
  }
  return { base64: null, code: raw };
}

function normalizeQrPayload(payload: unknown) {
  const seen = new Set<unknown>();
  const qrKeys = new Set(['qrcode', 'qrCode', 'Qrcode', 'QRCode', 'qr', 'base64', 'code']);
  const queue = [payload];
  let code: string | null = null;
  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    if (typeof current === 'string') {
      const parsed = normalizeQrString(current);
      if (parsed.base64) return parsed;
      if (parsed.code && !code) code = parsed.code;
      continue;
    }
    if (Array.isArray(current)) { queue.push(...current); continue; }
    if (typeof current === 'object') {
      const record = current as AnyRecord;
      for (const key of qrKeys) {
        if (record[key] !== undefined) {
          const parsed = normalizeQrString(record[key]);
          if (parsed.base64) return parsed;
          if (parsed.code && !code) code = parsed.code;
        }
      }
      queue.push(...Object.values(record).filter((value) => value && typeof value === 'object'));
    }
  }
  return { base64: null as string | null, code };
}

function normalizeInstance(raw: unknown) {
  const inst = asRecord(raw);
  const nested = nestedInstance(inst);
  return {
    id: String(inst.id ?? nested.id ?? ''),
    name: instanceNameOf(inst),
    state: normalizeState(inst),
    qrcode: normalizeQrPayload(inst).base64,
    phone: inst.phone ?? inst.owner ?? nested.phone ?? nested.owner ?? null,
    profileName: inst.profileName ?? inst.pushName ?? nested.profileName ?? nested.pushName ?? instanceNameOf(inst) ?? null,
  };
}

// ─── main ────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const b44 = createClientFromRequest(req);

  try {
    const user = await b44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const base        = BASE(Deno.env.get('EVOLUTION_API_URL') || 'https://evolution-go-9b1u.srv1772067.hstgr.cloud');
    // Na Evolution Go, este é o "adminToken": autentica endpoints administrativos (/instance/create, /instance/all, /instance/info, /instance/logs, /instance/delete).
    const adminToken   = Deno.env.get('EVOLUTION_API_KEY') || '';
    const defaultInst = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'CONNECT';

    if (!adminToken) {
      return Response.json({
        success: false,
        error: { code: 'EVOLUTION_NOT_CONFIGURED', message: 'EVOLUTION_API_KEY não configurada nas variáveis de ambiente.' },
      }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'list_instances';

    // ── list_instances ───────────────────────────────────────────────────────
    // GET /instance/all  (apikey: adminToken)
    if (action === 'list_instances' || action === 'get_instances' || action === 'test_connection' || !body.action) {
      const r = await evoFetch(`${base}/instance/all`, { headers: { apikey: adminToken } });
      if (!r.ok) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'list_instances', status: 'falha',
          details: JSON.stringify(r.data).slice(0, 500),
        });
        return Response.json({ success: false, error: 'Falha ao conectar à Evolution Go API', details: r.data }, { status: r.status || 502 });
      }
      const instances = payloadList(r.data).map(normalizeInstance).filter((inst) => inst.name);
      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: action === 'test_connection' ? 'test_connection' : 'list_instances', status: 'sucesso',
      });
      return Response.json({ success: true, instances, defaultInstance: defaultInst });
    }

    // ── create_instance ──────────────────────────────────────────────────────
    // POST /instance/create  (apikey: adminToken)  body: { instanceId?, name, token }
    if (action === 'create_instance') {
      const { instanceName, webhookUrl } = body;
      if (!instanceName?.trim()) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      const name = String(instanceName).trim();
      const newToken = crypto.randomUUID();

      const r = await evoFetch(`${base}/instance/create`, {
        method: 'POST',
        headers: { apikey: adminToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, token: newToken }),
      });

      if (!r.ok) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'create_instance', status: 'falha',
          details: JSON.stringify(r.data).slice(0, 500),
        });
        return Response.json({ success: false, error: 'Falha ao criar instância', details: r.data }, { status: r.status || 502 });
      }

      // Conecta a instância recém-criada para gerar o QR code (auth com o token da própria instância).
      const appWebhookUrl = webhookUrl || '';
      const connectBody: Record<string, unknown> = { subscribe: ['ALL'] };
      if (appWebhookUrl) connectBody.webhookUrl = appWebhookUrl;

      const connect = await evoFetch(`${base}/instance/connect`, {
        method: 'POST',
        headers: { apikey: newToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(connectBody),
      });

      let qrcode = normalizeQrPayload(connect.ok ? connect.data : null);
      if (!qrcode.base64) {
        const qrResp = await evoFetch(`${base}/instance/qr`, { headers: { apikey: newToken } });
        if (qrResp.ok) qrcode = normalizeQrPayload(qrResp.data);
      }

      const inst = await findInstance(base, adminToken, name);

      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'create_instance', status: 'sucesso',
        details: `instance: ${name}`,
      });
      return Response.json({
        success: true,
        instance: normalizeInstance(inst ?? { name, token: newToken }),
        qrcode: qrcode.base64,
        qrCode: qrcode,
      });
    }

    // ── connect_instance ─────────────────────────────────────────────────────
    // POST /instance/connect  (apikey: TOKEN DA INSTÂNCIA)  body: { subscribe: ["ALL"], webhookUrl }
    if (action === 'connect_instance') {
      const { instanceName, webhookUrl } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });

      const found = await findInstance(base, adminToken, instanceName);
      if (!found) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      const instToken = extractToken(found, adminToken);

      const appWebhookUrl = webhookUrl || '';
      const connectBody: Record<string, unknown> = { subscribe: ['ALL'] };
      if (appWebhookUrl) connectBody.webhookUrl = appWebhookUrl;

      const r = await evoFetch(`${base}/instance/connect`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(connectBody),
      });

      if (!r.ok) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'connect_instance', status: 'falha',
          details: JSON.stringify(r.data).slice(0, 500),
        });
        return Response.json({ success: false, error: 'Falha ao conectar instância', details: r.data }, { status: r.status || 502 });
      }

      let qrcode = normalizeQrPayload(r.data);
      if (!qrcode.base64) {
        const qrResp = await evoFetch(`${base}/instance/qr`, { headers: { apikey: instToken } });
        if (qrResp.ok) qrcode = normalizeQrPayload(qrResp.data);
      }

      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'connect_instance', status: 'sucesso',
        details: `instance: ${instanceName}`,
      });
      return Response.json({ success: true, result: r.data, qrcode: qrcode.base64, qrCode: qrcode, state: 'connecting' });
    }

    // ── get_qrcode ───────────────────────────────────────────────────────────
    // GET /instance/qr  (apikey: TOKEN DA INSTÂNCIA)
    if (action === 'get_qrcode') {
      const { instanceName } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });

      const inst = await findInstance(base, adminToken, instanceName);
      if (!inst) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'get_qrcode', status: 'falha',
          details: `instance: ${instanceName} — não encontrada`,
        });
        return Response.json({ error: 'Instância não encontrada' }, { status: 404 });
      }
      const instToken = extractToken(inst, adminToken);

      const st = await evoFetch(`${base}/instance/status`, { headers: { apikey: instToken } });
      const statusState = st.ok ? normalizeState(asRecord(st.data)) : normalizeState(inst);
      if (statusState === 'connected') {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'get_qrcode', status: 'sucesso',
          details: `instance: ${instanceName} — já conectada`,
        });
        return Response.json({ success: true, qrcode: null, state: 'connected', message: 'A instância já está conectada.' });
      }

      const r = await evoFetch(`${base}/instance/qr`, { headers: { apikey: instToken } });
      const qrcode = r.ok ? normalizeQrPayload(r.data) : { base64: null, code: null };
      if (qrcode.base64 || qrcode.code) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'get_qrcode', status: 'sucesso',
          details: `instance: ${instanceName}`,
        });
        return Response.json({ success: true, qrcode, state: 'connecting' });
      }

      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'get_qrcode', status: 'falha',
        details: `instance: ${instanceName} — QR indisponível: ${JSON.stringify(r.data).slice(0, 300)}`,
      });
      return Response.json({
        success: false,
        error: 'QR code indisponível. Clique em "Reconectar" para gerar um novo.',
        details: r.data,
      }, { status: r.status || 404 });
    }

    // ── logout_instance ──────────────────────────────────────────────────────
    // DELETE /instance/logout  (apikey: TOKEN DA INSTÂNCIA)
    if (action === 'logout_instance') {
      const { instanceName } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });

      const found = await findInstance(base, adminToken, instanceName);
      if (!found) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      const instToken = extractToken(found, adminToken);

      const r = await evoFetch(`${base}/instance/logout`, { method: 'DELETE', headers: { apikey: instToken } });
      if (!r.ok) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'logout_instance', status: 'falha',
          details: JSON.stringify(r.data).slice(0, 500),
        });
        return Response.json({ success: false, error: 'Falha ao desconectar instância', details: r.data }, { status: r.status || 502 });
      }
      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'logout_instance', status: 'sucesso',
        details: `instance: ${instanceName}`,
      });
      return Response.json({ success: true });
    }

    // ── delete_instance ──────────────────────────────────────────────────────
    // DELETE /instance/delete/:instanceId  (apikey: adminToken)
    if (action === 'delete_instance') {
      const { instanceName } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });

      const found = await findInstance(base, adminToken, instanceName);
      if (!found) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      const instanceId = String(found.id ?? nestedInstance(found).id ?? '');
      if (!instanceId) return Response.json({ success: false, error: 'ID da instância não encontrado' }, { status: 404 });

      const r = await evoFetch(`${base}/instance/delete/${encodeURIComponent(instanceId)}`, {
        method: 'DELETE',
        headers: { apikey: adminToken },
      });
      if (!r.ok) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'delete_instance', status: 'falha',
          details: JSON.stringify(r.data).slice(0, 500),
        });
        return Response.json({ success: false, error: 'Falha ao excluir instância', details: r.data }, { status: r.status || 502 });
      }
      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'delete_instance', status: 'sucesso',
        details: `instance: ${instanceName}`,
      });
      return Response.json({ success: true });
    }

    // ── send_message ─────────────────────────────────────────────────────────
    // POST /send/text  (apikey: TOKEN DA INSTÂNCIA)  body: { number, text, delay }
    if (action === 'send_message') {
      const instanceName = body.instance || defaultInst;
      const { phone, message } = body;
      if (!phone || !message) return Response.json({ error: 'phone e message são obrigatórios' }, { status: 400 });

      const inst = await findInstance(base, adminToken, instanceName);
      if (!inst) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      const instToken = extractToken(inst, adminToken);

      const number = phone.replace(/\D/g, '');
      const r = await evoFetch(`${base}/send/text`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, text: message, delay: 500 }),
      });
      if (!r.ok) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'send_message', status: 'falha',
          details: JSON.stringify(r.data).slice(0, 500),
        });
        return Response.json({ success: false, error: 'Falha ao enviar mensagem', details: r.data }, { status: r.status || 502 });
      }
      // Extrai o ID da mensagem retornado pela Evolution Go para salvar no banco
      const rData = asRecord(r.data);
      const waMessageId = String(
        rData.id ?? rData.messageId ?? rData.ID ??
        asRecord(rData.result).id ?? asRecord(rData.message).id ?? ''
      );
      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'send_message', status: 'sucesso',
        details: waMessageId ? `wa_id: ${waMessageId}` : undefined,
      });
      return Response.json({ success: true, result: r.data, wa_message_id: waMessageId || null });
    }

    // ── get_instance_info ────────────────────────────────────────────────────
    if (action === 'get_instance_info') {
      const { instanceName } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      const inst = await findInstance(base, adminToken, instanceName);
      if (!inst) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      return Response.json({ success: true, instance: normalizeInstance(inst) });
    }

    // ── get_messages ─────────────────────────────────────────────────────────
    // Evolution GO NÃO tem endpoint REST de leitura de mensagens.
    // O histórico chega via webhook HistorySync (subscribe: HISTORY_SYNC).
    // Esta action retorna as mensagens já salvas no Base44.
    if (action === 'get_messages') {
      const conversationId = String(body.conversation_id || '');
      if (!conversationId) return Response.json({ error: 'conversation_id é obrigatório' }, { status: 400 });
      const messages = await b44.asServiceRole.entities.Message.filter({ conversation_id: conversationId });
      return Response.json({ success: true, messages });
    }

    // ── sync_history ──────────────────────────────────────────────────────────
    // A Evolution Go NÃO tem um endpoint de "listar mensagens" direto. O único mecanismo real é:
    //   POST /chat/history-sync  { messageInfo: { Chat, ID, IsFromMe, IsGroup, Timestamp }, count }
    // Isso exige uma mensagem de REFERÊNCIA já conhecida (Chat/ID/Timestamp) para pedir o que veio ANTES dela,
    // e a resposta chega de forma assíncrona via webhook (evento HistorySync) — não nesta chamada.
    if (action === 'sync_history') {
      const instanceName = body.instance || defaultInst;
      const phone = String(body.phone || '').replace(/\D/g, '');
      const conversationId = String(body.conversation_id || '');
      if (!phone) return Response.json({ error: 'phone é obrigatório' }, { status: 400 });

      const inst = await findInstance(base, adminToken, instanceName);
      if (!inst) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'sync_history', status: 'falha',
          details: JSON.stringify({ phone, instance: instanceName, error: 'Instância não encontrada' }).slice(0, 2000),
        });
        return Response.json({ success: false, created: 0, error: 'Instância não encontrada' });
      }
      const instToken = extractToken(inst, adminToken);
      const jid = `${phone}@s.whatsapp.net`;
      const limit = Number(body.limit ?? 50);

      // Busca a mensagem mais antiga já salva localmente para essa conversa, para usar como referência.
      const existing = await b44.asServiceRole.entities.Message.filter({ conversation_id: conversationId }, 'timestamp', 1);
      const oldest = existing[0];

      if (!oldest || !oldest.wa_message_id) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'sync_history', status: 'falha',
          details: JSON.stringify({
            phone, instance: instanceName,
            reason: 'Sem mensagem de referência (wa_message_id) para acionar /chat/history-sync. Ainda não chegou nenhuma mensagem via webhook nesta conversa.',
          }).slice(0, 2000),
        });
        return Response.json({
          success: true, created: 0,
          note: 'Ainda não há histórico local para esta conversa. As mensagens chegam pelo webhook em tempo real; envie ou receba uma mensagem para iniciar o histórico.',
        });
      }

      const r = await evoFetch(`${base}/chat/history-sync`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageInfo: {
            Chat: oldest.chat_jid || jid,
            ID: oldest.wa_message_id,
            IsFromMe: oldest.direction === 'out',
            IsGroup: !!oldest.is_group,
            Timestamp: oldest.timestamp,
          },
          count: limit,
        }),
      });

      if (!r.ok) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'sync_history', status: 'falha',
          details: JSON.stringify({ phone, instance: instanceName, endpoint: 'POST /chat/history-sync', status: r.status, error: r.data }).slice(0, 2000),
        });
        return Response.json({ success: false, created: 0, error: 'Falha ao solicitar histórico', details: r.data });
      }

      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'sync_history', status: 'sucesso',
        details: JSON.stringify({ phone, instance: instanceName, requested: true, referenceId: oldest.wa_message_id }).slice(0, 2000),
      });
      // Importante: as mensagens antigas chegam depois, via webhook (evento HistorySync) — não nesta resposta.
      return Response.json({
        success: true, created: 0, requested: true,
        note: 'Histórico solicitado à Evolution Go; as mensagens antigas chegarão em instantes via webhook.',
      });
    }

    // ── get_chats ─────────────────────────────────────────────────────────────
    // A Evolution Go não expõe "listar conversas" — usamos os contatos (GET /user/contacts) como base.
    if (action === 'get_chats') {
      const instanceName = body.instance || defaultInst;
      const inst = await findInstance(base, adminToken, instanceName);
      if (!inst) return Response.json({ success: false, error: 'Instância não encontrada', chats: [] });
      const instToken = extractToken(inst, adminToken);

      const r = await evoFetch(`${base}/user/contacts`, { headers: { apikey: instToken } });
      if (!r.ok) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'get_chats', status: 'falha',
          details: `status ${r.status}: ${JSON.stringify(r.data).slice(0, 300)}`,
        });
        return Response.json({ success: false, error: 'Não foi possível listar contatos', chats: [] });
      }

      const rawContacts = asRecord(r.data).data ?? r.data;
      const entries = Array.isArray(rawContacts) ? rawContacts : Object.entries(asRecord(rawContacts)).map(([jid, info]) => ({ jid, ...asRecord(info) }));

      const chats = entries
        .map((item: unknown) => {
          const rec = asRecord(item);
          const jid = String(rec.jid ?? rec.JID ?? rec.Jid ?? rec.id ?? '');
          const phone = jid.split('@')[0];
          const name = String(rec.FullName ?? rec.PushName ?? rec.BusinessName ?? rec.name ?? phone);
          return { jid, phone, name, isGroup: jid.includes('@g.us'), last_message: null, last_message_time: null };
        })
        .filter((c) => c.jid.includes('@s.whatsapp.net'));

      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'get_chats', status: 'sucesso',
        details: `contatos: ${chats.length}`,
      });
      return Response.json({ success: true, chats });
    }

    // ── get_contacts ─────────────────────────────────────────────────────────
    // GET /user/contacts  (apikey: TOKEN DA INSTÂNCIA)
    if (action === 'get_contacts') {
      const instanceName = body.instance || defaultInst;
      const inst = await findInstance(base, adminToken, instanceName);
      if (!inst) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      const instToken = extractToken(inst, adminToken);

      const r = await evoFetch(`${base}/user/contacts`, { headers: { apikey: instToken } });
      if (!r.ok) {
        const friendly = r.status === 401
          ? 'A instância do WhatsApp está desconectada. Reconecte escaneando o QR code.'
          : 'Falha ao carregar contatos';
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'get_contacts', status: 'falha',
          details: `status ${r.status}: ${JSON.stringify(r.data).slice(0, 400)}`,
        });
        return Response.json({ success: false, error: friendly, status: r.status, details: r.data }, { status: r.status || 502 });
      }
      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'get_contacts', status: 'sucesso',
      });
      return Response.json({ success: true, contacts: (r.data as Record<string, unknown>)?.data ?? r.data });
    }

    // ── send_media ────────────────────────────────────────────────────────────
    // POST /send/media  — envia imagem, vídeo, áudio ou documento
    // body: { number, url, type, caption?, filename?, delay? }
    // O campo "url" aceita URL HTTP(S) OU base64 sem prefixo data:
    if (action === 'send_media') {
      const instanceName = body.instance || defaultInst;
      const { phone, url, type: mediaType, caption, filename, delay } = body;
      if (!phone || !url) return Response.json({ error: 'phone e url são obrigatórios' }, { status: 400 });

      const inst = await findInstance(base, adminToken, instanceName);
      const instanceToken = inst ? extractToken(inst, adminToken) : adminToken;
      const number = String(phone).replace(/\D/g, '');

      const r = await evoFetch(`${base}/send/media`, {
        method: 'POST',
        headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, url, type: mediaType || 'image', caption, filename, delay: delay ?? 1000 }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao enviar mídia', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── send_link ─────────────────────────────────────────────────────────────
    // POST /send/link  — envia link (com preview)
    if (action === 'send_link') {
      const instanceName = body.instance || defaultInst;
      const { phone, text, delay } = body;
      if (!phone || !text) return Response.json({ error: 'phone e text são obrigatórios' }, { status: 400 });

      const inst = await findInstance(base, adminToken, instanceName);
      const instanceToken = inst ? extractToken(inst, adminToken) : adminToken;
      const number = String(phone).replace(/\D/g, '');

      const r = await evoFetch(`${base}/send/link`, {
        method: 'POST',
        headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, text, delay: delay ?? 1000 }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao enviar link', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── send_location ─────────────────────────────────────────────────────────
    // POST /send/location
    if (action === 'send_location') {
      const instanceName = body.instance || defaultInst;
      const { phone, name: locName, address, latitude, longitude, delay } = body;
      if (!phone || latitude == null || longitude == null) return Response.json({ error: 'phone, latitude e longitude são obrigatórios' }, { status: 400 });

      const inst = await findInstance(base, adminToken, instanceName);
      const instanceToken = inst ? extractToken(inst, adminToken) : adminToken;
      const number = String(phone).replace(/\D/g, '');

      const r = await evoFetch(`${base}/send/location`, {
        method: 'POST',
        headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, name: locName, address, latitude, longitude, delay: delay ?? 1000 }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao enviar localização', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── check_user ────────────────────────────────────────────────────────────
    // POST /user/check  — verifica se número(s) estão no WhatsApp
    // body: { phone } ou { phones: ["5511..."] }
    if (action === 'check_user') {
      const instanceName = body.instance || defaultInst;
      const inst = await findInstance(base, adminToken, instanceName);
      const instanceToken = inst ? extractToken(inst, adminToken) : adminToken;

      const phones: string[] = Array.isArray(body.phones)
        ? body.phones
        : body.phone ? [String(body.phone)] : [];
      if (!phones.length) return Response.json({ error: 'phone ou phones é obrigatório' }, { status: 400 });

      const numbers = phones.map((p) => p.replace(/\D/g, ''));
      const r = await evoFetch(`${base}/user/check`, {
        method: 'POST',
        headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: numbers }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao verificar usuário', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── get_user_info ─────────────────────────────────────────────────────────
    // POST /user/info  — retorna informações de perfil de um ou mais números
    if (action === 'get_user_info') {
      const instanceName = body.instance || defaultInst;
      const inst = await findInstance(base, adminToken, instanceName);
      const instanceToken = inst ? extractToken(inst, adminToken) : adminToken;

      const phones: string[] = Array.isArray(body.phones)
        ? body.phones
        : body.phone ? [String(body.phone)] : [];
      if (!phones.length) return Response.json({ error: 'phone ou phones é obrigatório' }, { status: 400 });

      const numbers = phones.map((p) => p.replace(/\D/g, ''));
      const r = await evoFetch(`${base}/user/info`, {
        method: 'POST',
        headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: numbers }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao obter info do usuário', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── get_avatar ────────────────────────────────────────────────────────────
    // POST /user/avatar  — retorna URL do avatar do contato
    if (action === 'get_avatar') {
      const instanceName = body.instance || defaultInst;
      const inst = await findInstance(base, adminToken, instanceName);
      const instanceToken = inst ? extractToken(inst, adminToken) : adminToken;
      const phone = String(body.phone || '').replace(/\D/g, '');
      if (!phone) return Response.json({ error: 'phone é obrigatório' }, { status: 400 });

      const r = await evoFetch(`${base}/user/avatar`, {
        method: 'POST',
        headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: phone, preview: body.preview ?? false }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao obter avatar', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── mark_read ─────────────────────────────────────────────────────────────
    // POST /message/markread  — marca mensagens como lidas
    // body: { phone, ids: ["msgId1", "msgId2"] }
    if (action === 'mark_read') {
      const instanceName = body.instance || defaultInst;
      const inst = await findInstance(base, adminToken, instanceName);
      const instanceToken = inst ? extractToken(inst, adminToken) : adminToken;
      const phone = String(body.phone || '').replace(/\D/g, '');
      if (!phone) return Response.json({ error: 'phone é obrigatório' }, { status: 400 });

      const ids: string[] = Array.isArray(body.ids) ? body.ids : body.id ? [String(body.id)] : [];
      const r = await evoFetch(`${base}/message/markread`, {
        method: 'POST',
        headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: phone, id: ids }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao marcar como lida', details: r.data }, { status: r.status || 502 });

      // Atualiza flag de não lido na conversa local
      if (body.conversation_id) {
        await b44.asServiceRole.entities.Conversation.update(String(body.conversation_id), { unread: false }).catch(() => {});
      }
      return Response.json({ success: true, result: r.data });
    }

    // ── react_message ─────────────────────────────────────────────────────────
    // POST /message/react  — envia reação (emoji) a uma mensagem
    // body: { phone, messageId, reaction }
    if (action === 'react_message') {
      const instanceName = body.instance || defaultInst;
      const inst = await findInstance(base, adminToken, instanceName);
      const instanceToken = inst ? extractToken(inst, adminToken) : adminToken;
      const { phone, messageId, reaction } = body;
      if (!phone || !messageId || !reaction) return Response.json({ error: 'phone, messageId e reaction são obrigatórios' }, { status: 400 });

      const r = await evoFetch(`${base}/message/react`, {
        method: 'POST',
        headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: String(phone).replace(/\D/g, ''), id: messageId, reaction }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao reagir à mensagem', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── delete_message ────────────────────────────────────────────────────────
    // POST /message/delete
    // body: { chat, messageId }
    if (action === 'delete_message') {
      const instanceName = body.instance || defaultInst;
      const inst = await findInstance(base, adminToken, instanceName);
      const instanceToken = inst ? extractToken(inst, adminToken) : adminToken;
      const { chat, messageId } = body;
      if (!chat || !messageId) return Response.json({ error: 'chat e messageId são obrigatórios' }, { status: 400 });

      const jid = String(chat).includes('@') ? chat : `${String(chat).replace(/\D/g, '')}@s.whatsapp.net`;
      const r = await evoFetch(`${base}/message/delete`, {
        method: 'POST',
        headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: jid, messageId }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao apagar mensagem', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── edit_message ──────────────────────────────────────────────────────────
    // POST /message/edit
    // body: { chat, messageId, message }
    if (action === 'edit_message') {
      const instanceName = body.instance || defaultInst;
      const inst = await findInstance(base, adminToken, instanceName);
      const instanceToken = inst ? extractToken(inst, adminToken) : adminToken;
      const { chat, messageId, message: newText } = body;
      if (!chat || !messageId || !newText) return Response.json({ error: 'chat, messageId e message são obrigatórios' }, { status: 400 });

      const jid = String(chat).includes('@') ? chat : `${String(chat).replace(/\D/g, '')}@s.whatsapp.net`;
      const r = await evoFetch(`${base}/message/edit`, {
        method: 'POST',
        headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: jid, messageId, message: newText }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao editar mensagem', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── presence ──────────────────────────────────────────────────────────────
    // POST /message/presence  — envia estado de digitação/gravação
    // body: { phone, state: "composing"|"paused", isAudio? }
    if (action === 'presence') {
      const instanceName = body.instance || defaultInst;
      const inst = await findInstance(base, adminToken, instanceName);
      const instanceToken = inst ? extractToken(inst, adminToken) : adminToken;
      const { phone, state: presState, isAudio } = body;
      if (!phone) return Response.json({ error: 'phone é obrigatório' }, { status: 400 });

      const r = await evoFetch(`${base}/message/presence`, {
        method: 'POST',
        headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: String(phone).replace(/\D/g, ''), state: presState || 'composing', isAudio: !!isAudio }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao enviar presença', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── pin_chat / unpin_chat ─────────────────────────────────────────────────
    // POST /chat/pin  |  POST /chat/unpin
    if (action === 'pin_chat' || action === 'unpin_chat') {
      const instanceName = body.instance || defaultInst;
      const inst = await findInstance(base, adminToken, instanceName);
      const instanceToken = inst ? extractToken(inst, adminToken) : adminToken;
      const { phone } = body;
      if (!phone) return Response.json({ error: 'phone é obrigatório' }, { status: 400 });

      const jid = `${String(phone).replace(/\D/g, '')}@s.whatsapp.net`;
      const endpoint = action === 'pin_chat' ? 'pin' : 'unpin';
      const r = await evoFetch(`${base}/chat/${endpoint}`, {
        method: 'POST',
        headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: jid }),
      });
      if (!r.ok) return Response.json({ success: false, error: `Falha ao ${endpoint} chat`, details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── archive_chat / unarchive_chat ─────────────────────────────────────────
    // POST /chat/archive  |  POST /chat/unarchive
    if (action === 'archive_chat' || action === 'unarchive_chat') {
      const instanceName = body.instance || defaultInst;
      const inst = await findInstance(base, adminToken, instanceName);
      const instanceToken = inst ? extractToken(inst, adminToken) : adminToken;
      const { phone } = body;
      if (!phone) return Response.json({ error: 'phone é obrigatório' }, { status: 400 });

      const jid = `${String(phone).replace(/\D/g, '')}@s.whatsapp.net`;
      const endpoint = action === 'archive_chat' ? 'archive' : 'unarchive';
      const r = await evoFetch(`${base}/chat/${endpoint}`, {
        method: 'POST',
        headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: jid }),
      });
      if (!r.ok) return Response.json({ success: false, error: `Falha ao ${endpoint} chat`, details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── mute_chat / unmute_chat ───────────────────────────────────────────────
    // POST /chat/mute  |  POST /chat/unmute
    if (action === 'mute_chat' || action === 'unmute_chat') {
      const instanceName = body.instance || defaultInst;
      const inst = await findInstance(base, adminToken, instanceName);
      const instanceToken = inst ? extractToken(inst, adminToken) : adminToken;
      const { phone } = body;
      if (!phone) return Response.json({ error: 'phone é obrigatório' }, { status: 400 });

      const jid = `${String(phone).replace(/\D/g, '')}@s.whatsapp.net`;
      const endpoint = action === 'mute_chat' ? 'mute' : 'unmute';
      const r = await evoFetch(`${base}/chat/${endpoint}`, {
        method: 'POST',
        headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: jid }),
      });
      if (!r.ok) return Response.json({ success: false, error: `Falha ao ${endpoint} chat`, details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── reconnect_instance ────────────────────────────────────────────────────
    // POST /instance/reconnect  — reconecta instância sem apagar sessão
    if (action === 'reconnect_instance') {
      const { instanceName } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });

      const found = await findInstance(base, adminToken, instanceName);
      if (!found) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      const instToken = extractToken(found, adminToken);

      const r = await evoFetch(`${base}/instance/reconnect`, {
        method: 'POST',
        headers: { apikey: instToken },
      });
      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'reconnect_instance', status: r.ok ? 'sucesso' : 'falha',
        details: `instance: ${instanceName}`,
      }).catch(() => {});
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao reconectar', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── pair_instance ─────────────────────────────────────────────────────────
    // POST /instance/pair  — gera código de pareamento (alternativa ao QR)
    // body: { instanceName, phone }
    if (action === 'pair_instance') {
      const { instanceName, phone } = body;
      if (!instanceName || !phone) return Response.json({ error: 'instanceName e phone são obrigatórios' }, { status: 400 });

      const found = await findInstance(base, adminToken, instanceName);
      if (!found) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      const instToken = extractToken(found, adminToken);

      const r = await evoFetch(`${base}/instance/pair`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: String(phone) }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao gerar código de pareamento', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── get_instance_logs ─────────────────────────────────────────────────────
    // GET /instance/logs/:instanceId  — logs da instância
    if (action === 'get_instance_logs') {
      const { instanceName, startDate, endDate, level, limit } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });

      const found = await findInstance(base, adminToken, instanceName);
      if (!found) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      const instanceId = String(found.id ?? nestedInstance(found).id ?? instanceName);

      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate)   params.set('end_date', endDate);
      if (level)     params.set('level', level);
      if (limit)     params.set('limit', String(limit));

      const url = `${base}/instance/logs/${encodeURIComponent(instanceId)}?${params}`;
      const r = await evoFetch(url, { headers: { apikey: adminToken } });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao buscar logs', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, logs: r.data });
    }

    return Response.json({ error: `Action inválida: ${action}` }, { status: 400 });

  } catch (error) {
    await b44.asServiceRole.entities.ErrorLog.create({
      function_name: 'evolutionApi',
      error_message: (error as Error).message,
    }).catch(() => {});
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});