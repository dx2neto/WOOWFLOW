// ═══════════════════════════════════════════════════════════════════════════
// Integration Hub — Helper compartilhado para chamadas a APIs externas
// Usado por todas as functions do Integration Hub (zapsign, clicksign, omie, etc.)
//
// Responsabilidades:
// 1. Busca a Integration pelo slug no catálogo
// 2. Verifica se está habilitada (enabled === true)
// 3. Executa a chamada HTTP via fetch
// 4. Grava o resultado em IntegrationLog (sempre — sucesso ou erro)
// 5. Retorna o resultado para quem chamou
// ═══════════════════════════════════════════════════════════════════════════

type AnyRecord = Record<string, unknown>;

interface B44Client {
  asServiceRole: {
    entities: {
      Integration: { filter: (q: AnyRecord) => Promise<AnyRecord[]> };
      IntegrationLog: { create: (d: AnyRecord) => Promise<AnyRecord> };
    };
  };
}

export interface CallOptions {
  slug: string;
  action: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string | FormData | null;
}

export interface CallResult {
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
}

function truncateForLog(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  try {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    return str.length > 2000 ? str.slice(0, 2000) + '...' : value;
  } catch {
    return '[unserializable]';
  }
}

export async function getIntegration(base44: B44Client, slug: string): Promise<AnyRecord | null> {
  try {
    const results = await base44.asServiceRole.entities.Integration.filter({ slug });
    return results && results.length > 0 ? results[0] : null;
  } catch {
    return null;
  }
}

export async function callWithLogging(base44: B44Client, opts: CallOptions): Promise<CallResult> {
  const startTime = Date.now();

  // ── 1. Buscar Integration pelo slug ────────────────────────────────────────
  const integration = await getIntegration(base44, opts.slug);
  if (!integration || integration.enabled !== true) {
    const duration = Date.now() - startTime;
    await base44.asServiceRole.entities.IntegrationLog.create({
      integration_slug: opts.slug,
      action: opts.action,
      method: opts.method,
      status: 'falha',
      error_message: 'Integração desabilitada ou não cadastrada',
      duration_ms: duration,
      details: `Slug: ${opts.slug}`,
    }).catch(() => {});
    return { ok: false, status: 409, data: { error: 'Integração desabilitada ou não cadastrada' }, error: 'Integração desabilitada' };
  }

  // ── 2. Executar fetch ──────────────────────────────────────────────────────
  let response: Response;
  let responseData: unknown;
  let fetchError: string | null = null;

  try {
    response = await fetch(opts.url, {
      method: opts.method,
      headers: opts.headers || {},
      body: opts.body,
    });
    const text = await response.text();
    try {
      responseData = JSON.parse(text);
    } catch {
      responseData = { raw: text };
    }
  } catch (err) {
    fetchError = (err as Error).message;
    const duration = Date.now() - startTime;
    await base44.asServiceRole.entities.IntegrationLog.create({
      integration_slug: opts.slug,
      action: opts.action,
      method: opts.method,
      status: 'falha',
      error_message: fetchError,
      duration_ms: duration,
      details: `${opts.method} ${opts.url}`,
    }).catch(() => {});
    return { ok: false, status: 0, data: { error: fetchError }, error: fetchError };
  }

  // ── 3. Logar resultado ─────────────────────────────────────────────────────
  const duration = Date.now() - startTime;
  await base44.asServiceRole.entities.IntegrationLog.create({
    integration_slug: opts.slug,
    action: opts.action,
    method: opts.method,
    status: response.ok ? 'sucesso' : 'falha',
    response_status: response.status,
    response_payload: truncateForLog(responseData) as AnyRecord,
    error_message: response.ok ? null : String(fetchError || JSON.stringify(responseData)).slice(0, 500),
    duration_ms: duration,
    details: `${opts.method} ${opts.url}`,
  }).catch(() => {});

  return { ok: response.ok, status: response.status, data: responseData };
}

// Helper para auth check compartilhado entre todas as functions
export async function checkAuth(req: Request): Promise<boolean> {
  const internalToken = Deno.env.get('INTERNAL_FUNCTION_TOKEN') || '';
  const internalOk = internalToken !== '' && req.headers.get('x-internal-token') === internalToken;
  return internalOk; // Service role calls pass internal token; user calls are checked separately
}