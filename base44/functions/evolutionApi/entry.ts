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

    // ── Variáveis de ambiente (suporta nomes novos EVOLUTION_GO_* e antigos EVOLUTION_*) ──
    const base        = BASE(
      Deno.env.get('EVOLUTION_GO_BASE_URL') ||
      Deno.env.get('EVOLUTION_API_URL') ||
      'https://evolution-go-9b1u.srv1772067.hstgr.cloud'
    );
    // adminToken: autentica endpoints administrativos (/instance/create, /instance/all, /instance/info, /instance/logs, /instance/delete)
    const adminToken  = Deno.env.get('EVOLUTION_GO_ADMIN_TOKEN') || Deno.env.get('EVOLUTION_API_KEY') || '';
    // instanceToken: token padrão da instância (usado como apikey em /send, /user, /chat, /message, /group etc.)
    const envInstToken = Deno.env.get('EVOLUTION_GO_INSTANCE_TOKEN') || '';
    const defaultInst = Deno.env.get('EVOLUTION_GO_INSTANCE_ID') || Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'CONNECT';
    const webhookUrl  = Deno.env.get('EVOLUTION_GO_WEBHOOK_URL') || '';

    if (!adminToken) {
      return Response.json({
        success: false,
        error: {
          code: 'EVOLUTION_NOT_CONFIGURED',
          message: 'Variável EVOLUTION_GO_ADMIN_TOKEN (ou EVOLUTION_API_KEY) não configurada. Configure no painel Base44 > Variáveis de Ambiente.',
        },
      }, { status: 500 });
    }

    // Helper: resolve token da instância — prefere EVOLUTION_GO_INSTANCE_TOKEN, senão busca via /instance/all
    async function resolveToken(instanceName: string): Promise<{ inst: AnyRecord | null; token: string }> {
      if (envInstToken) return { inst: null, token: envInstToken };
      const found = await findInstance(base, adminToken, instanceName);
      if (!found) return { inst: null, token: adminToken };
      return { inst: found, token: extractToken(found, adminToken) };
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

    // ═══════════════════════════════════════════════════════════════════════════
    // INSTANCE — ações adicionais
    // ═══════════════════════════════════════════════════════════════════════════

    // ── disconnect_instance ───────────────────────────────────────────────────
    // POST /instance/disconnect  — desconecta sem apagar sessão (mantém QR)
    if (action === 'disconnect_instance') {
      const { instanceName } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/instance/disconnect`, {
        method: 'POST',
        headers: { apikey: instToken },
      });
      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'disconnect_instance', status: r.ok ? 'sucesso' : 'falha',
        details: `instance: ${instanceName}`,
      }).catch(() => {});
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao desconectar instância', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── force_reconnect ───────────────────────────────────────────────────────
    // POST /instance/forcereconnect/:instanceId
    if (action === 'force_reconnect') {
      const { instanceName } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      const found = await findInstance(base, adminToken, instanceName);
      if (!found) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      const instanceId = String(found.id ?? nestedInstance(found).id ?? instanceName);
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/instance/forcereconnect/${encodeURIComponent(instanceId)}`, {
        method: 'POST',
        headers: { apikey: instToken },
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao forçar reconexão', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── get_advanced_settings ─────────────────────────────────────────────────
    // GET /instance/:instanceId/advanced-settings
    if (action === 'get_advanced_settings') {
      const { instanceName } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      const found = await findInstance(base, adminToken, instanceName);
      if (!found) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      const instanceId = String(found.id ?? nestedInstance(found).id ?? instanceName);
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/instance/${encodeURIComponent(instanceId)}/advanced-settings`, {
        headers: { apikey: instToken },
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao buscar configurações', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, settings: r.data });
    }

    // ── update_advanced_settings ──────────────────────────────────────────────
    // PUT /instance/:instanceId/advanced-settings
    // body: { instanceName, rejectCalls, rejectCallMessage, readMessages, readStatus, alwaysOnline }
    if (action === 'update_advanced_settings') {
      const { instanceName, rejectCalls, rejectCallMessage, readMessages, readStatus, alwaysOnline } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      const found = await findInstance(base, adminToken, instanceName);
      if (!found) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      const instanceId = String(found.id ?? nestedInstance(found).id ?? instanceName);
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/instance/${encodeURIComponent(instanceId)}/advanced-settings`, {
        method: 'PUT',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectCalls, rejectCallMessage, readMessages, readStatus, alwaysOnline }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao atualizar configurações', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── server_health ─────────────────────────────────────────────────────────
    // GET /server/ok
    if (action === 'server_health') {
      const r = await evoFetch(`${base}/server/ok`, { headers: { apikey: adminToken } });
      return Response.json({ success: r.ok, status: r.status, result: r.data });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SEND MESSAGE — ações adicionais
    // ═══════════════════════════════════════════════════════════════════════════

    // ── send_poll ─────────────────────────────────────────────────────────────
    // POST /send/poll
    // body: { phone, question, options: string[], maxAnswer?, delay?, instance }
    if (action === 'send_poll') {
      const instanceName = body.instance || defaultInst;
      const { phone, question, options, maxAnswer, delay } = body;
      if (!phone || !question || !Array.isArray(options)) return Response.json({ error: 'phone, question e options[] são obrigatórios' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const number = String(phone).replace(/\D/g, '');
      const r = await evoFetch(`${base}/send/poll`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, question, options, maxAnswer: maxAnswer ?? 1, delay: delay ?? 1000 }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao enviar enquete', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── send_sticker ──────────────────────────────────────────────────────────
    // POST /send/sticker
    // body: { phone, sticker (URL ou base64), delay?, instance }
    if (action === 'send_sticker') {
      const instanceName = body.instance || defaultInst;
      const { phone, sticker, delay } = body;
      if (!phone || !sticker) return Response.json({ error: 'phone e sticker são obrigatórios' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/send/sticker`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: String(phone).replace(/\D/g, ''), sticker, delay: delay ?? 1000 }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao enviar sticker', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── send_contact ──────────────────────────────────────────────────────────
    // POST /send/contact
    // body: { phone, vcard: { fullName, organization?, phone }, delay?, instance }
    if (action === 'send_contact') {
      const instanceName = body.instance || defaultInst;
      const { phone, vcard, delay } = body;
      if (!phone || !vcard) return Response.json({ error: 'phone e vcard são obrigatórios' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/send/contact`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: String(phone).replace(/\D/g, ''), vcard, delay: delay ?? 1000 }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao enviar contato', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── send_button ───────────────────────────────────────────────────────────
    // POST /send/button
    // body: { phone, title, description, footer?, buttons[], delay?, instance }
    if (action === 'send_button') {
      const instanceName = body.instance || defaultInst;
      const { phone, title, description, footer, buttons, delay } = body;
      if (!phone || !title || !Array.isArray(buttons)) return Response.json({ error: 'phone, title e buttons[] são obrigatórios' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/send/button`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: String(phone).replace(/\D/g, ''), title, description, footer, buttons, delay: delay ?? 1000 }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao enviar botão', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── send_list ─────────────────────────────────────────────────────────────
    // POST /send/list
    // body: { phone, title, description, buttonText, footerText?, sections[], delay?, instance }
    if (action === 'send_list') {
      const instanceName = body.instance || defaultInst;
      const { phone, title, description, buttonText, footerText, sections, delay } = body;
      if (!phone || !title || !Array.isArray(sections)) return Response.json({ error: 'phone, title e sections[] são obrigatórios' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/send/list`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: String(phone).replace(/\D/g, ''), title, description, buttonText, footerText, sections, delay: delay ?? 1000 }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao enviar lista', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── send_carousel ─────────────────────────────────────────────────────────
    // POST /send/carousel
    // body: { phone, text, cards[], delay?, instance }
    if (action === 'send_carousel') {
      const instanceName = body.instance || defaultInst;
      const { phone, text, cards, delay } = body;
      if (!phone || !Array.isArray(cards)) return Response.json({ error: 'phone e cards[] são obrigatórios' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/send/carousel`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: String(phone).replace(/\D/g, ''), text, cards, delay: delay ?? 1000 }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao enviar carrossel', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // USER — ações adicionais
    // ═══════════════════════════════════════════════════════════════════════════

    // ── get_privacy ───────────────────────────────────────────────────────────
    // GET /user/privacy
    if (action === 'get_privacy') {
      const instanceName = body.instance || defaultInst;
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/user/privacy`, { headers: { apikey: instToken } });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao buscar privacidade', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── block_user / unblock_user ─────────────────────────────────────────────
    // POST /user/block  |  POST /user/unblock
    if (action === 'block_user' || action === 'unblock_user') {
      const instanceName = body.instance || defaultInst;
      const { phone } = body;
      if (!phone) return Response.json({ error: 'phone é obrigatório' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const endpoint = action === 'block_user' ? 'block' : 'unblock';
      const r = await evoFetch(`${base}/user/${endpoint}`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: String(phone).replace(/\D/g, '') }),
      });
      if (!r.ok) return Response.json({ success: false, error: `Falha ao ${endpoint} contato`, details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── get_blocklist ─────────────────────────────────────────────────────────
    // GET /user/blocklist
    if (action === 'get_blocklist') {
      const instanceName = body.instance || defaultInst;
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/user/blocklist`, { headers: { apikey: instToken } });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao buscar lista de bloqueados', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── set_profile_picture ───────────────────────────────────────────────────
    // POST /user/profilePicture  body: { image: URL }
    if (action === 'set_profile_picture') {
      const instanceName = body.instance || defaultInst;
      const { image } = body;
      if (!image) return Response.json({ error: 'image é obrigatório' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/user/profilePicture`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao definir foto de perfil', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── set_profile_name ──────────────────────────────────────────────────────
    // POST /user/profileName  body: { name }
    if (action === 'set_profile_name') {
      const instanceName = body.instance || defaultInst;
      const { name: profileName } = body;
      if (!profileName) return Response.json({ error: 'name é obrigatório' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/user/profileName`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileName }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao definir nome do perfil', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── set_profile_status ────────────────────────────────────────────────────
    // POST /user/profileStatus  body: { status }
    if (action === 'set_profile_status') {
      const instanceName = body.instance || defaultInst;
      const { status: profileStatus } = body;
      if (!profileStatus) return Response.json({ error: 'status é obrigatório' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/user/profileStatus`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: profileStatus }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao definir status do perfil', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MESSAGE — ações adicionais
    // ═══════════════════════════════════════════════════════════════════════════

    // ── download_media ────────────────────────────────────────────────────────
    // POST /message/downloadmedia
    // body: { phone, messageId, instance }
    if (action === 'download_media') {
      const instanceName = body.instance || defaultInst;
      const { phone, messageId } = body;
      if (!phone || !messageId) return Response.json({ error: 'phone e messageId são obrigatórios' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/message/downloadmedia`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: String(phone).replace(/\D/g, ''), id: messageId }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao baixar mídia', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── get_message_status ────────────────────────────────────────────────────
    // POST /message/status
    // body: { phone, messageId, instance }
    if (action === 'get_message_status') {
      const instanceName = body.instance || defaultInst;
      const { phone, messageId } = body;
      if (!phone || !messageId) return Response.json({ error: 'phone e messageId são obrigatórios' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/message/status`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: String(phone).replace(/\D/g, ''), id: messageId }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao verificar status da mensagem', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GROUP
    // ═══════════════════════════════════════════════════════════════════════════

    // ── group_list ────────────────────────────────────────────────────────────
    // GET /group/list
    if (action === 'group_list') {
      const instanceName = body.instance || defaultInst;
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/group/list`, { headers: { apikey: instToken } });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao listar grupos', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, groups: r.data });
    }

    // ── group_myall ───────────────────────────────────────────────────────────
    // GET /group/myall
    if (action === 'group_myall') {
      const instanceName = body.instance || defaultInst;
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/group/myall`, { headers: { apikey: instToken } });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao listar meus grupos', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, groups: r.data });
    }

    // ── group_info ────────────────────────────────────────────────────────────
    // POST /group/info  body: { groupJid }
    if (action === 'group_info') {
      const instanceName = body.instance || defaultInst;
      const { groupJid } = body;
      if (!groupJid) return Response.json({ error: 'groupJid é obrigatório' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/group/info`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupJid }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao buscar info do grupo', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── group_invite_link ─────────────────────────────────────────────────────
    // POST /group/invitelink  body: { groupJid }
    if (action === 'group_invite_link') {
      const instanceName = body.instance || defaultInst;
      const { groupJid } = body;
      if (!groupJid) return Response.json({ error: 'groupJid é obrigatório' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/group/invitelink`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupJid }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao buscar link do grupo', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── group_create ──────────────────────────────────────────────────────────
    // POST /group/create  body: { groupName, participants: string[] }
    if (action === 'group_create') {
      const instanceName = body.instance || defaultInst;
      const { groupName, participants } = body;
      if (!groupName || !Array.isArray(participants)) return Response.json({ error: 'groupName e participants[] são obrigatórios' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/group/create`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName, participants: participants.map((p: string) => String(p).replace(/\D/g, '')) }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao criar grupo', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── group_participant ─────────────────────────────────────────────────────
    // POST /group/participant  body: { groupJid, participants: string[], action: 'add'|'remove'|'promote'|'demote' }
    if (action === 'group_participant') {
      const instanceName = body.instance || defaultInst;
      const { groupJid, participants, action: participantAction } = body;
      if (!groupJid || !Array.isArray(participants) || !participantAction) {
        return Response.json({ error: 'groupJid, participants[] e action são obrigatórios' }, { status: 400 });
      }
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/group/participant`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupJid, participants: participants.map((p: string) => String(p).replace(/\D/g, '')), action: participantAction }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao gerenciar participante', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── group_join ────────────────────────────────────────────────────────────
    // POST /group/join  body: { code }
    if (action === 'group_join') {
      const instanceName = body.instance || defaultInst;
      const { code } = body;
      if (!code) return Response.json({ error: 'code é obrigatório' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/group/join`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao entrar no grupo', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── group_leave ───────────────────────────────────────────────────────────
    // POST /group/leave  body: { groupJid }
    if (action === 'group_leave') {
      const instanceName = body.instance || defaultInst;
      const { groupJid } = body;
      if (!groupJid) return Response.json({ error: 'groupJid é obrigatório' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/group/leave`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupJid }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao sair do grupo', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── group_update_name / group_update_description / group_update_photo ─────
    if (action === 'group_update_name' || action === 'group_update_description' || action === 'group_update_photo') {
      const instanceName = body.instance || defaultInst;
      const { groupJid, name, description, image } = body;
      if (!groupJid) return Response.json({ error: 'groupJid é obrigatório' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      let endpoint = '';
      let payload: Record<string, unknown> = { groupJid };
      if (action === 'group_update_name') { endpoint = 'name'; payload.name = name; }
      if (action === 'group_update_description') { endpoint = 'description'; payload.description = description; }
      if (action === 'group_update_photo') { endpoint = 'photo'; payload.image = image; }
      const r = await evoFetch(`${base}/group/${endpoint}`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) return Response.json({ success: false, error: `Falha ao atualizar grupo (${endpoint})`, details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CALL
    // ═══════════════════════════════════════════════════════════════════════════

    // ── reject_call ───────────────────────────────────────────────────────────
    // POST /call/reject  body: { callCreator, callId }
    if (action === 'reject_call') {
      const instanceName = body.instance || defaultInst;
      const { callCreator, callId } = body;
      if (!callCreator || !callId) return Response.json({ error: 'callCreator e callId são obrigatórios' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/call/reject`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ callCreator, callId }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao rejeitar chamada', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LABEL
    // ═══════════════════════════════════════════════════════════════════════════

    // ── label_list ────────────────────────────────────────────────────────────
    // GET /label/list
    if (action === 'label_list') {
      const instanceName = body.instance || defaultInst;
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/label/list`, { headers: { apikey: instToken } });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao listar etiquetas', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, labels: r.data });
    }

    // ── label_chat / unlabel_chat ─────────────────────────────────────────────
    // POST /label/chat  |  POST /unlabel/chat
    // body: { jid, labelId, instance }
    if (action === 'label_chat' || action === 'unlabel_chat') {
      const instanceName = body.instance || defaultInst;
      const { jid, labelId } = body;
      if (!jid || !labelId) return Response.json({ error: 'jid e labelId são obrigatórios' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const endpoint = action === 'label_chat' ? 'label/chat' : 'unlabel/chat';
      const r = await evoFetch(`${base}/${endpoint}`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid, labelId }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao aplicar/remover etiqueta no chat', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── label_message / unlabel_message ───────────────────────────────────────
    // POST /label/message  |  POST /unlabel/message
    // body: { jid, messageId, labelId, instance }
    if (action === 'label_message' || action === 'unlabel_message') {
      const instanceName = body.instance || defaultInst;
      const { jid, messageId, labelId } = body;
      if (!jid || !labelId) return Response.json({ error: 'jid e labelId são obrigatórios' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const endpoint = action === 'label_message' ? 'label/message' : 'unlabel/message';
      const r = await evoFetch(`${base}/${endpoint}`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid, messageId, labelId }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao aplicar/remover etiqueta na mensagem', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── label_edit ────────────────────────────────────────────────────────────
    // POST /label/edit  body: { labelId, name, color, deleted? }
    if (action === 'label_edit') {
      const instanceName = body.instance || defaultInst;
      const { labelId, name: labelName, color, deleted } = body;
      if (!labelId) return Response.json({ error: 'labelId é obrigatório' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/label/edit`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelId, name: labelName, color, deleted: !!deleted }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao editar etiqueta', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // COMMUNITY
    // ═══════════════════════════════════════════════════════════════════════════

    // ── community_create ──────────────────────────────────────────────────────
    // POST /community/create  body: { communityName }
    if (action === 'community_create') {
      const instanceName = body.instance || defaultInst;
      const { communityName } = body;
      if (!communityName) return Response.json({ error: 'communityName é obrigatório' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/community/create`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ communityName }),
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao criar comunidade', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ── community_add / community_remove ──────────────────────────────────────
    // POST /community/add  |  POST /community/remove
    // body: { communityJid, groupJid: string[], instance }
    if (action === 'community_add' || action === 'community_remove') {
      const instanceName = body.instance || defaultInst;
      const { communityJid, groupJid } = body;
      if (!communityJid || !groupJid) return Response.json({ error: 'communityJid e groupJid são obrigatórios' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const endpoint = action === 'community_add' ? 'add' : 'remove';
      const r = await evoFetch(`${base}/community/${endpoint}`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ communityJid, groupJid: Array.isArray(groupJid) ? groupJid : [groupJid] }),
      });
      if (!r.ok) return Response.json({ success: false, error: `Falha ao ${endpoint} grupo na comunidade`, details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, result: r.data });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // POLLS
    // ═══════════════════════════════════════════════════════════════════════════

    // ── get_poll_results ──────────────────────────────────────────────────────
    // GET /polls/:pollMessageId/results
    if (action === 'get_poll_results') {
      const instanceName = body.instance || defaultInst;
      const { pollMessageId } = body;
      if (!pollMessageId) return Response.json({ error: 'pollMessageId é obrigatório' }, { status: 400 });
      const { token: instToken } = await resolveToken(instanceName);
      const r = await evoFetch(`${base}/polls/${encodeURIComponent(pollMessageId)}/results`, {
        headers: { apikey: instToken },
      });
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao buscar resultados da enquete', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, results: r.data });
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