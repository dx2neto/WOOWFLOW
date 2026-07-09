import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── helpers ─────────────────────────────────────────────────────────────────
const BASE = (url: string) => url.replace(/\/$/, '');
type AnyRecord = Record<string, unknown>;

/**
 * Faz uma requisição à Evolution Go e retorna { ok, status, data }.
 * Normaliza erros de parse e loga falhas automaticamente.
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
    root.instances,
    root.instance,
    root.result,
    root.response,
    root.data,
    nested.instances,
    nested.instance,
    nested.result,
    nested.response,
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
  return String(
    inst.name ??
    inst.instanceName ??
    nested.name ??
    nested.instanceName ??
    inst.id ??
    ''
  );
}

/**
 * Busca todas as instâncias e retorna o objeto da instância pelo nome.
 */
async function findInstance(base: string, globalKey: string, name: string) {
  const r = await evoFetch(`${base}/instance/all`, { headers: { apikey: globalKey } });
  if (!r.ok) return null;
  const list = payloadList(r.data);
  return list.find((i: unknown) => {
    const inst = asRecord(i);
    return instanceNameOf(inst) === name;
  }) as AnyRecord | undefined;
}

/**
 * Extrai o token de autenticação da instância (necessário para enviar mensagens).
 * Evolution Go: cada instância tem token próprio diferente da Global API Key.
 */
function extractToken(inst: AnyRecord, fallback: string): string {
  const nested = nestedInstance(inst);
  return String(
    inst.token ??
    inst.apitoken ??
    inst.apiToken ??
    inst.instanceToken ??
    nested.token ??
    nested.apitoken ??
    nested.apiToken ??
    nested.instanceToken ??
    fallback
  );
}

/**
 * Normaliza o estado de conexão de uma instância para um valor canônico.
 */
function normalizeState(inst: AnyRecord): string {
  const nested = nestedInstance(inst);

  if (asRecord(inst.data).LoggedIn === true || inst.LoggedIn === true || nested.LoggedIn === true) {
    return 'connected';
  }
  // Evolution Go expõe o estado de conexão no booleano `connected`.
  if (typeof inst?.connected === 'boolean') {
    return inst.connected ? 'connected' : 'disconnected';
  }
  if (typeof nested?.connected === 'boolean') {
    return nested.connected ? 'connected' : 'disconnected';
  }
  const raw = String(
    inst?.status ?? inst?.connectionStatus ??
    inst?.state ??
    nested?.status ??
    nested?.connectionStatus ??
    nested?.state ??
    ''
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
    const dataUrl = firstPart.startsWith('data:')
      ? firstPart
      : `data:image/png;base64,${firstPart.split('base64,').pop()}`;
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

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

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

/**
 * Busca QR code tentando múltiplos endpoints/autenticações da Evolution Go.
 * Prioridade: GET /instance/{name}/qrcode → GET /instance/qr (legado)
 */
async function fetchQrCode(
  base: string,
  instanceName: string,
  instanceToken: string,
  globalKey: string,
  instanceId: string,
) {
  type QrResult = { base64: string | null; code: string | null };
  const fallback = { response: { ok: false, status: 404, data: {} }, qrcode: null as QrResult | null };

  // GET /instance/qr  (Postman: auth = instance token)
  const r1 = await evoFetch(`${base}/instance/qr`, { headers: { apikey: instanceToken } });
  if (r1.ok) return { response: r1, qrcode: normalizeQrPayload(r1.data) };

  // Fallback: globalKey + instanceId header
  if (instanceId) {
    const r2 = await evoFetch(`${base}/instance/qr`, {
      headers: { apikey: globalKey, instanceId },
    });
    if (r2.ok) return { response: r2, qrcode: normalizeQrPayload(r2.data) };
  }

  return fallback;
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
    const globalKey   = Deno.env.get('EVOLUTION_API_KEY') || Deno.env.get('GLOBAL_API_KEY') || '';
    const defaultInst = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'CONNECT';

    if (!globalKey) {
      return Response.json({
        success: false,
        error: { code: 'EVOLUTION_NOT_CONFIGURED', message: 'EVOLUTION_API_KEY não configurada nas variáveis de ambiente.' },
      }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'list_instances';

    // ── list_instances (default) ─────────────────────────────────────────────
    // GET /instance/all  →  apikey: globalKey
    // Retorna array normalizado com: name, state, qrcode (base64 ou null)
    // Aliases: list_instances | get_instances | (sem action)
    if (action === 'list_instances' || action === 'get_instances' || action === 'test_connection' || !body.action) {
      const r = await evoFetch(`${base}/instance/all`, { headers: { apikey: globalKey } });
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
    // POST /instance/create  body: { name, instanceName } — Evolution Go aceita ambos
    // Após criar, dispara connect para registrar webhook e obter QR.
    if (action === 'create_instance') {
      const { instanceName, webhookUrl } = body;
      if (!instanceName?.trim()) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      const name = String(instanceName).trim();

      const r = await evoFetch(`${base}/instance/create`, {
        method: 'POST',
        headers: { apikey: globalKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, instanceName: name }),
      });

      if (!r.ok) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'create_instance', status: 'falha',
          details: JSON.stringify(r.data).slice(0, 500),
        });
        return Response.json({ success: false, error: 'Falha ao criar instância', details: r.data }, { status: r.status || 502 });
      }

      const created     = asRecord(r.data);
      const createdData = asRecord(created.data);
      let inst          = await findInstance(base, globalKey, name);
      const tokenSource = inst ?? (Object.keys(createdData).length ? createdData : created);
      const newToken    = extractToken(tokenSource, globalKey);
      const newId       = String((inst ?? asRecord(createdData)).id ?? '');

      let qrcode = normalizeQrPayload(r.data);

      // Dispara connect para registrar webhook + HISTORY_SYNC e obter QR
      if (!qrcode.base64) {
        const appWebhookUrl = webhookUrl || Deno.env.get('WOOWFLOW_WEBHOOK_URL') || '';
        const connectBody: Record<string, unknown> = {
          subscribe: ['MESSAGE', 'READ_RECEIPT', 'HISTORY_SYNC', 'CONNECTION', 'QRCODE', 'CONTACT'],
          webhookUrl: appWebhookUrl || undefined,
        };

        // Usa token da instância recém-criada (Postman pattern)
        const connect = await evoFetch(`${base}/instance/connect`, {
          method: 'POST',
          headers: { apikey: newToken, 'Content-Type': 'application/json' },
          body: JSON.stringify(connectBody),
        });
        if (connect.ok) qrcode = normalizeQrPayload(connect.data);
      }

      if (!qrcode.base64) {
        const qrResult = await fetchQrCode(base, name, newToken, globalKey, newId);
        if (qrResult.qrcode) qrcode = qrResult.qrcode;
      }

      inst = inst ?? (await findInstance(base, globalKey, name));

      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'create_instance', status: 'sucesso',
        details: `instance: ${name}`,
      });
      return Response.json({
        success: true,
        instance: normalizeInstance(inst ?? created),
        qrcode: qrcode.base64,
        qrCode: qrcode,
      });
    }

    // ── connect_instance ─────────────────────────────────────────────────────
    // POST /instance/connect  header: apikey=globalKey + instanceId=<uuid>
    // body: { webhookUrl, subscribe: ["ALL"], immediate: true }
    if (action === 'connect_instance') {
      const { instanceName, webhookUrl } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });

      const found      = await findInstance(base, globalKey, instanceName);
      if (!found) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      const instanceId = String(found.id ?? nestedInstance(found).id ?? '');
      const instToken  = extractToken(found, globalKey);

      const appWebhookUrl = webhookUrl || Deno.env.get('WOOWFLOW_WEBHOOK_URL') || '';
      // HISTORY_SYNC garante que o histórico de mensagens chegue via webhook
      const connectBody: Record<string, unknown> = {
        subscribe: ['MESSAGE', 'READ_RECEIPT', 'HISTORY_SYNC', 'CONNECTION', 'QRCODE', 'CONTACT'],
        webhookUrl: appWebhookUrl || undefined,
      };

      // Postman: connect usa token da própria instância como apikey
      let r = await evoFetch(`${base}/instance/connect`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(connectBody),
      });

      // Fallback: globalKey com instanceId header
      if (!r.ok) {
        r = await evoFetch(`${base}/instance/connect`, {
          method: 'POST',
          headers: {
            apikey: globalKey,
            'Content-Type': 'application/json',
            ...(instanceId ? { instanceId } : {}),
          },
          body: JSON.stringify(connectBody),
        });
      }

      if (!r.ok) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'connect_instance', status: 'falha',
          details: JSON.stringify(r.data).slice(0, 500),
        });
        return Response.json({ success: false, error: 'Falha ao conectar instância', details: r.data }, { status: r.status || 502 });
      }

      let qrcode = normalizeQrPayload(r.data);
      if (!qrcode.base64) {
        const qrResult = await fetchQrCode(base, instanceName, instToken, globalKey, instanceId);
        if (qrResult.qrcode) qrcode = qrResult.qrcode;
      }

      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'connect_instance', status: 'sucesso',
        details: `instance: ${instanceName}`,
      });
      return Response.json({ success: true, result: r.data, qrcode: qrcode.base64, qrCode: qrcode, state: 'connecting' });
    }

    // ── get_qrcode ───────────────────────────────────────────────────────────
    // GET /instance/qr  (autenticado com o TOKEN da instância)
    //   → { data: { Qrcode: "data:image/png;base64,..." }, message: "success" }
    // Antes verifica /instance/status para não gerar QR de instância já logada.
    if (action === 'get_qrcode') {
      const { instanceName } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });

      const inst = await findInstance(base, globalKey, instanceName);
      if (!inst) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'get_qrcode', status: 'falha',
          details: `instance: ${instanceName} — não encontrada`,
        });
        return Response.json({ error: 'Instância não encontrada' }, { status: 404 });
      }
      const instToken = extractToken(inst, globalKey);

      // Se já está logada (pareada), não há QR a gerar.
      const st = await evoFetch(`${base}/instance/status`, { headers: { apikey: instToken } });
      const statusState = st.ok ? normalizeState(asRecord(st.data)) : normalizeState(inst);
      if (statusState === 'connected') {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'get_qrcode', status: 'sucesso',
          details: `instance: ${instanceName} — já conectada`,
        });
        return Response.json({
          success: true,
          qrcode: null,
          state: 'connected',
          message: 'A instância já está conectada.',
        });
      }

      // Busca o QR code.
      const instanceId = String(inst.id ?? nestedInstance(inst).id ?? '');
      const r = await fetchQrCode(base, instanceName, instToken, globalKey, instanceId);
      if (r.qrcode?.base64 || r.qrcode?.code) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'get_qrcode', status: 'sucesso',
          details: `instance: ${instanceName}`,
        });
        return Response.json({ success: true, qrcode: r.qrcode, state: 'connecting' });
      }

      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'get_qrcode', status: 'falha',
        details: `instance: ${instanceName} — QR indisponível: ${JSON.stringify(r.response.data).slice(0, 300)}`,
      });
      return Response.json({
        success: false,
        error: 'QR code indisponível. Clique em "Reconectar" para gerar um novo.',
        details: r.response.data,
      }, { status: r.response.status || 404 });
    }

    // ── logout_instance ──────────────────────────────────────────────────────
    // DELETE /instance/logout  (token da instância)  → desconecta o WhatsApp (mantém instância)
    if (action === 'logout_instance') {
      const { instanceName } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });

      const found = await findInstance(base, globalKey, instanceName);
      if (!found) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      const instToken = extractToken(found, globalKey);

      const r = await evoFetch(`${base}/instance/logout`, {
        method: 'DELETE',
        headers: { apikey: instToken },
      });
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
    // DELETE /instance/delete/{id}  (global key; usa o id interno da instância)
    if (action === 'delete_instance') {
      const { instanceName } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });

      const found = await findInstance(base, globalKey, instanceName);
      if (!found) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      const instanceId = String(found.id ?? nestedInstance(found).id ?? '');
      const instToken = extractToken(found, globalKey);
      const deleteTargets = instanceId
        ? [
            { url: `${base}/instance/delete/${encodeURIComponent(instanceId)}`, key: globalKey },
            { url: `${base}/instance/delete`, key: instToken },
          ]
        : [{ url: `${base}/instance/delete`, key: instToken }];

      let r = await evoFetch(deleteTargets[0].url, {
        method: 'DELETE',
        headers: { apikey: deleteTargets[0].key },
      });
      if (!r.ok && deleteTargets[1]) {
        r = await evoFetch(deleteTargets[1].url, {
          method: 'DELETE',
          headers: { apikey: deleteTargets[1].key },
        });
      }
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
    // POST /send/text   body: { number, text }   header: apikey: instanceToken
    if (action === 'send_message') {
      const instanceName = body.instance || defaultInst;
      const { phone, message } = body;
      if (!phone || !message) return Response.json({ error: 'phone e message são obrigatórios' }, { status: 400 });

      // Descobre o token da instância (necessário para autenticar o envio)
      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;

      const number = phone.replace(/\D/g, '');
      const r = await evoFetch(`${base}/send/text`, {
        method: 'POST',
        headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, text: message }),
      });
      if (!r.ok) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'send_message', status: 'falha',
          details: JSON.stringify(r.data).slice(0, 500),
        });
        return Response.json({ success: false, error: 'Falha ao enviar mensagem', details: r.data }, { status: r.status || 502 });
      }
      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'send_message', status: 'sucesso',
      });
      return Response.json({ success: true, result: r.data });
    }

    // ── get_instance_info ────────────────────────────────────────────────────
    // Retorna detalhes de uma instância específica
    if (action === 'get_instance_info') {
      const { instanceName } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      const inst = await findInstance(base, globalKey, instanceName);
      if (!inst) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      return Response.json({
        success: true,
        instance: normalizeInstance(inst),
      });
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
    // Dispara POST /chat/history-sync para solicitar histórico ao WhatsApp.
    // As mensagens chegam de forma ASSÍNCRONA via webhook HistorySync — não há resposta imediata.
    // Ref Postman: POST /chat/history-sync
    //   body: { messageInfo: { Chat, ID, IsFromMe, IsGroup, Timestamp }, count }
    if (action === 'sync_history') {
      const instanceName = body.instance || defaultInst;
      const phone = String(body.phone || '').replace(/\D/g, '');
      const conversationId = String(body.conversation_id || '');
      if (!phone) return Response.json({ error: 'phone é obrigatório' }, { status: 400 });

      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;

      const jid = `${phone}@s.whatsapp.net`;
      const count = Number(body.limit ?? 50);

      // Dispara o pedido de sync ao WhatsApp — resposta vem no webhook HistorySync
      const r = await evoFetch(`${base}/chat/history-sync`, {
        method: 'POST',
        headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageInfo: {
            Chat: jid,
            ID: '0',
            IsFromMe: false,
            IsGroup: false,
            Timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias atrás
          },
          count,
        }),
      });

      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'sync_history', status: r.ok ? 'sucesso' : 'falha',
        details: `phone: ${phone}, status: ${r.status}${conversationId ? `, conv: ${conversationId}` : ''}`,
      });

      // Conta mensagens já salvas localmente
      const existing = conversationId
        ? await b44.asServiceRole.entities.Message.filter({ conversation_id: conversationId })
        : [];

      return Response.json({
        success: true,
        created: 0,
        local_count: (existing as AnyRecord[]).length,
        sync_requested: r.ok,
        note: r.ok
          ? 'Histórico solicitado ao WhatsApp. Mensagens chegarão via webhook HistorySync em instantes.'
          : 'Falha ao solicitar sync. Verifique se a instância está conectada e com HISTORY_SYNC subscrito.',
      });
    }

    // ── get_chats ─────────────────────────────────────────────────────────────
    // Evolution GO não tem endpoint de listar chats. Usa /user/contacts como proxy.
    // Ref Postman: GET /user/contacts
    if (action === 'get_chats') {
      const instanceName = body.instance || defaultInst;
      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;

      const r = await evoFetch(`${base}/user/contacts`, {
        headers: { apikey: instanceToken },
      });

      if (!r.ok) {
        return Response.json({ success: false, error: 'Não foi possível listar contatos', chats: [] });
      }

      const raw = asRecord(r.data);
      const list = payloadList(raw.data ?? raw);

      const chats = list.map((item: unknown) => {
        const rec = asRecord(item);
        const jid = String(rec.JID ?? rec.jid ?? rec.id ?? '');
        const phone = jid.split('@')[0];
        const isGroup = jid.includes('@g.us');
        const name = String(rec.FullName ?? rec.Name ?? rec.PushName ?? rec.BusinessName ?? phone);
        return { jid, phone, name, isGroup };
      }).filter((c: { isGroup: boolean; phone: string }) => !c.isGroup && c.phone);

      return Response.json({ success: true, chats });
    }

    // ── get_contacts ─────────────────────────────────────────────────────────
    if (action === 'get_contacts') {
      const instanceName = body.instance || defaultInst;
      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;

      const r = await evoFetch(`${base}/user/contacts`, {
        headers: { apikey: instanceToken },
      });
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

      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;
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

      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;
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

      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;
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
      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;

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
      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;

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
      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;
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
      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;
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
      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;
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
      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;
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
      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;
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
      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;
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
      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;
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
      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;
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
      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;
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

      const found = await findInstance(base, globalKey, instanceName);
      if (!found) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      const instToken = extractToken(found, globalKey);

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

      const found = await findInstance(base, globalKey, instanceName);
      if (!found) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      const instToken = extractToken(found, globalKey);

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

      const found = await findInstance(base, globalKey, instanceName);
      if (!found) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      const instanceId = String(found.id ?? nestedInstance(found).id ?? instanceName);

      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate)   params.set('end_date', endDate);
      if (level)     params.set('level', level);
      if (limit)     params.set('limit', String(limit));

      const url = `${base}/instance/logs/${encodeURIComponent(instanceId)}?${params}`;
      const r = await evoFetch(url, { headers: { apikey: globalKey } });
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