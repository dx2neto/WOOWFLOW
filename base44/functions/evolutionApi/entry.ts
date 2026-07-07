import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── helpers ─────────────────────────────────────────────────────────────────
const BASE = (url: string) => url.replace(/\/$/, '');

/**
 * Faz uma requisição à Evolution Go e retorna { ok, status, data }.
 * Normaliza erros de parse e loga falhas automaticamente.
 */
async function evoFetch(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

/**
 * Busca todas as instâncias e retorna o objeto da instância pelo nome.
 */
async function findInstance(base: string, globalKey: string, name: string) {
  const r = await evoFetch(`${base}/instance/all`, { headers: { apikey: globalKey } });
  if (!r.ok) return null;
  const list: unknown[] = Array.isArray(r.data) ? r.data as unknown[]
    : ((r.data as Record<string, unknown>)?.data as unknown[] | undefined) ?? [];
  return list.find((i: unknown) => {
    const inst = i as Record<string, unknown>;
    return inst.name === name || (inst.instance as Record<string, unknown>)?.instanceName === name;
  }) as Record<string, unknown> | undefined;
}

/**
 * Extrai o token de autenticação da instância (necessário para enviar mensagens).
 * Evolution Go: cada instância tem token próprio diferente da Global API Key.
 */
function extractToken(inst: Record<string, unknown>, fallback: string): string {
  return String(inst?.token ?? inst?.apitoken ?? fallback);
}

/**
 * Normaliza o estado de conexão de uma instância para um valor canônico.
 */
function normalizeState(inst: Record<string, unknown>): string {
  // Evolution Go expõe o estado de conexão no booleano `connected`.
  if (typeof inst?.connected === 'boolean') {
    return inst.connected ? 'connected' : 'disconnected';
  }
  const raw = String(
    inst?.status ?? inst?.connectionStatus ??
    (inst?.instance as Record<string, unknown>)?.state ?? ''
  ).toLowerCase();
  if (raw.includes('open') || raw.includes('connect') || raw === 'true') return 'connected';
  if (raw.includes('qr') || raw.includes('connecting')) return 'connecting';
  if (raw.includes('close') || raw.includes('disconnect') || raw.includes('logout')) return 'disconnected';
  return raw || 'unknown';
}

// ─── main ────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const b44 = createClientFromRequest(req);

  try {
    const user = await b44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const base        = BASE(Deno.env.get('EVOLUTION_API_URL') || 'https://evolution-go-9b1u.srv1772067.hstgr.cloud');
    const globalKey   = Deno.env.get('EVOLUTION_API_KEY') || '';
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
    // Retorna array normalizado com: name, token, state, qrcode (base64 ou null)
    // Aliases: list_instances | get_instances | (sem action)
    if (action === 'list_instances' || action === 'get_instances' || !body.action) {
      const r = await evoFetch(`${base}/instance/all`, { headers: { apikey: globalKey } });
      if (!r.ok) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'list_instances', status: 'falha',
          details: JSON.stringify(r.data).slice(0, 500),
        });
        return Response.json({ error: 'Falha ao conectar à Evolution Go API', details: r.data }, { status: r.status });
      }

      const rawList: unknown[] = Array.isArray(r.data) ? r.data as unknown[]
        : ((r.data as Record<string, unknown>)?.data as unknown[] | undefined) ?? [];

      const instances = rawList.map((raw) => {
        const i = raw as Record<string, unknown>;
        return {
          name: i.name ?? (i.instance as Record<string, unknown>)?.instanceName ?? '',
          token: i.token ?? i.apitoken ?? '',
          state: normalizeState(i),
          // QR code pode vir embutido no /instance/all quando instância está em estado "connecting"
          qrcode: i.qrcode ?? (i.instance as Record<string, unknown>)?.qrcode ?? null,
          phone: i.phone ?? (i.instance as Record<string, unknown>)?.owner ?? null,
          profileName: i.profileName ?? i.name ?? null,
        };
      });

      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'list_instances', status: 'sucesso',
      });
      return Response.json({ success: true, instances });
    }

    // ── create_instance ──────────────────────────────────────────────────────
    // POST /instance/create   body: { name }
    // Após criar, gera QR code chamando connect.
    if (action === 'create_instance') {
      const { instanceName } = body;
      if (!instanceName?.trim()) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });

      // Cria instância — Evolution Go aceita { name } (token é gerenciado internamente)
      const r = await evoFetch(`${base}/instance/create`, {
        method: 'POST',
        headers: { apikey: globalKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: instanceName.trim() }),
      });

      if (!r.ok) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'create_instance', status: 'falha',
          details: JSON.stringify(r.data).slice(0, 500),
        });
        return Response.json({ error: 'Falha ao criar instância', details: r.data }, { status: r.status });
      }

      const created = r.data as Record<string, unknown>;

      // O token da nova instância vem no retorno (ou aninhado em data).
      const createdData = (created?.data as Record<string, unknown>) ?? created;
      const newToken = extractToken(createdData, globalKey);

      // Após criar, busca QR code imediatamente via /instance/qr (token da instância).
      let qrcode: string | null = null;
      const qrr = await evoFetch(`${base}/instance/qr`, { headers: { apikey: newToken } });
      if (qrr.ok) {
        const qd = (qrr.data as Record<string, unknown>)?.data as Record<string, unknown> | undefined
          ?? (qrr.data as Record<string, unknown>);
        qrcode = String(qd?.Qrcode ?? qd?.qrcode ?? qd?.base64 ?? qd?.code ?? '').split('|')[0] || null;
        if (qrcode && !qrcode.startsWith('data:')) qrcode = `data:image/png;base64,${qrcode}`;
      }

      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'create_instance', status: 'sucesso',
        details: `instance: ${instanceName}`,
      });
      return Response.json({ success: true, result: created, qrcode });
    }

    // ── connect_instance ─────────────────────────────────────────────────────
    // POST /instance/connect  (autenticado com o TOKEN da instância) → regenera QR
    // No Evolution Go a instância é identificada pelo token no header, não pela URL.
    if (action === 'connect_instance') {
      const { instanceName } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });

      const found = await findInstance(base, globalKey, instanceName);
      if (!found) return Response.json({ error: 'Instância não encontrada' }, { status: 404 });
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
        return Response.json({ error: 'Falha ao conectar instância', details: r.data }, { status: r.status });
      }

      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'connect_instance', status: 'sucesso',
        details: `instance: ${instanceName}`,
      });
      return Response.json({ success: true, result: r.data });
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
      const stData = (st.data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
      if (stData?.LoggedIn === true) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'get_qrcode', status: 'falha',
          details: `instance: ${instanceName} — já conectada`,
        });
        return Response.json({
          success: false,
          error: 'A instância já está conectada. Não é necessário escanear o QR code.',
          state: 'connected',
        }, { status: 409 });
      }

      // Busca o QR code.
      const r = await evoFetch(`${base}/instance/qr`, { headers: { apikey: instToken } });
      if (r.ok) {
        const qd = (r.data as Record<string, unknown>)?.data as Record<string, unknown> | undefined
          ?? (r.data as Record<string, unknown>);
        let qrcode = String(qd?.Qrcode ?? qd?.qrcode ?? qd?.base64 ?? qd?.code ?? '').split('|')[0] || null;
        if (qrcode && !qrcode.startsWith('data:')) qrcode = `data:image/png;base64,${qrcode}`;

        if (qrcode) {
          await b44.asServiceRole.entities.IntegrationLog.create({
            integration: 'evolutionApi', action: 'get_qrcode', status: 'sucesso',
            details: `instance: ${instanceName}`,
          });
          return Response.json({ success: true, qrcode: { base64: qrcode } });
        }
      }

      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'get_qrcode', status: 'falha',
        details: `instance: ${instanceName} — QR indisponível: ${JSON.stringify(r.data).slice(0, 300)}`,
      });
      return Response.json({
        success: false,
        error: 'QR code indisponível. Clique em "Reconectar" para gerar um novo.',
      }, { status: 404 });
    }

    // ── logout_instance ──────────────────────────────────────────────────────
    // DELETE /instance/logout  (token da instância)  → desconecta o WhatsApp (mantém instância)
    if (action === 'logout_instance') {
      const { instanceName } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });

      const found = await findInstance(base, globalKey, instanceName);
      if (!found) return Response.json({ error: 'Instância não encontrada' }, { status: 404 });
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
        return Response.json({ error: 'Falha ao desconectar instância', details: r.data }, { status: r.status });
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
      if (!found) return Response.json({ error: 'Instância não encontrada' }, { status: 404 });
      const instanceId = String(found.id ?? '');
      if (!instanceId) return Response.json({ error: 'ID da instância não encontrado' }, { status: 404 });

      const r = await evoFetch(`${base}/instance/delete/${encodeURIComponent(instanceId)}`, {
        method: 'DELETE',
        headers: { apikey: globalKey },
      });
      if (!r.ok) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'evolutionApi', action: 'delete_instance', status: 'falha',
          details: JSON.stringify(r.data).slice(0, 500),
        });
        return Response.json({ error: 'Falha ao excluir instância', details: r.data }, { status: r.status });
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
        return Response.json({ error: 'Falha ao enviar mensagem', details: r.data }, { status: r.status });
      }
      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'evolutionApi', action: 'send_message', status: 'sucesso',
      });
      return Response.json({ success: true, result: r.data });
    }

    // ── get_instance_info ──────��─────────────────────────────────────────────
    // Retorna detalhes de uma instância específica
    if (action === 'get_instance_info') {
      const { instanceName } = body;
      if (!instanceName) return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      const inst = await findInstance(base, globalKey, instanceName);
      if (!inst) return Response.json({ error: 'Instância não encontrada' }, { status: 404 });
      return Response.json({
        success: true,
        instance: {
          name: inst.name ?? (inst.instance as Record<string, unknown>)?.instanceName,
          token: inst.token ?? inst.apitoken,
          state: normalizeState(inst),
          phone: inst.phone ?? null,
          profileName: inst.profileName ?? null,
        },
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
        return Response.json({ error: friendly, status: r.status, details: r.data }, { status: r.status || 500 });
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
