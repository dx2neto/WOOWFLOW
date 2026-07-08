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

async function fetchQrCode(base: string, instanceToken: string) {
  const r = await evoFetch(`${base}/instance/qr`, { headers: { apikey: instanceToken } });
  if (!r.ok) return { response: r, qrcode: null as { base64: string | null; code: string | null } | null };
  return { response: r, qrcode: normalizeQrPayload(r.data) };
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
    // POST /instance/create   body: { name }
    // Após criar, gera QR code chamando connect.
    if (action === 'create_instance') {
      const { instanceName } = body;
      if (!instanceName?.trim()) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      const name = String(instanceName).trim();

      // Cria instância — Evolution Go aceita { name } (token é gerenciado internamente)
      const r = await evoFetch(`${base}/instance/create`, {
        method: 'POST',
        headers: { apikey: globalKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!r.ok) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'create_instance', status: 'falha',
          details: JSON.stringify(r.data).slice(0, 500),
        });
        return Response.json({ success: false, error: 'Falha ao criar instância', details: r.data }, { status: r.status || 502 });
      }

      const created = asRecord(r.data);
      const createdData = asRecord(created.data);
      let inst = await findInstance(base, globalKey, name);
      const tokenSource = inst ?? (Object.keys(createdData).length ? createdData : created);
      const newToken = extractToken(tokenSource, globalKey);

      let qrcode = normalizeQrPayload(r.data);

      if (!qrcode.base64 && newToken) {
        const connect = await evoFetch(`${base}/instance/connect`, {
          method: 'POST',
          headers: { apikey: newToken, 'Content-Type': 'application/json' },
        });
        if (connect.ok) qrcode = normalizeQrPayload(connect.data);
      }

      if (!qrcode.base64 && newToken) {
        const qrResult = await fetchQrCode(base, newToken);
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
    // POST /instance/connect  (autenticado com o TOKEN da instância) → regenera QR
    // No Evolution Go a instância é identificada pelo token no header, não pela URL.
    if (action === 'connect_instance') {
      const { instanceName } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });

      const found = await findInstance(base, globalKey, instanceName);
      if (!found) return Response.json({ success: false, error: 'Instância não encontrada' }, { status: 404 });
      const instToken = extractToken(found, globalKey);

      const r = await evoFetch(`${base}/instance/connect`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
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
        const qrResult = await fetchQrCode(base, instToken);
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
      const r = await fetchQrCode(base, instToken);
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

    // ── get_messages ─────────────────────────────────────────────────────────
    // POST /chat/findMessages  (autenticado com o TOKEN da instância)
    // Busca o histórico real de mensagens de uma conversa do WhatsApp.
    if (action === 'get_messages') {
      const instanceName = body.instance || defaultInst;
      const { phone } = body;
      if (!phone) return Response.json({ error: 'phone é obrigatório' }, { status: 400 });

      const inst = await findInstance(base, globalKey, instanceName);
      const instanceToken = inst ? extractToken(inst, globalKey) : globalKey;
      const number = String(phone).replace(/\D/g, '');
      const remoteJid = `${number}@s.whatsapp.net`;

      const r = await evoFetch(`${base}/chat/findMessages`, {
        method: 'POST',
        headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ where: { key: { remoteJid } } }),
      });
      if (!r.ok) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'get_messages', status: 'falha',
          details: `phone: ${phone} — ${JSON.stringify(r.data).slice(0, 400)}`,
        });
        return Response.json({ success: false, error: 'Falha ao buscar histórico de mensagens', details: r.data }, { status: r.status || 502 });
      }

      const raw = asRecord(r.data);
      const list = payloadList(raw.messages ?? raw);
      const messages = list.map((item: unknown) => {
        const rec = asRecord(item);
        const key = asRecord(rec.key);
        const fromMe = Boolean(key.fromMe);
        const msg = asRecord(rec.message);
        const content = String(
          msg.conversation ??
          asRecord(msg.extendedTextMessage).text ??
          asRecord(msg.imageMessage).caption ??
          asRecord(msg.videoMessage).caption ??
          '[mídia]'
        );
        const timestamp = rec.messageTimestamp
          ? new Date(Number(rec.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString();
        return { content, direction: fromMe ? 'out' : 'in', timestamp, sender_name: rec.pushName ?? null };
      });

      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'get_messages', status: 'sucesso',
        details: `phone: ${phone} — ${messages.length} mensagem(ns)`,
      });
      return Response.json({ success: true, messages });
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

    return Response.json({ error: `Action inválida: ${action}` }, { status: 400 });

  } catch (error) {
    await b44.asServiceRole.entities.ErrorLog.create({
      function_name: 'evolutionApi',
      error_message: (error as Error).message,
    }).catch(() => {});
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});