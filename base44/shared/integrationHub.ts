// ═══════════════════════════════════════════════════════════════════════════
// Integration Hub — Helper compartilhado para chamadas a APIs externas
// Usado por todas as functions do Integration Hub (zapsign, clicksign, omie, etc.)
//
// Responsabilidades:
// 1. getIntegration: busca a Integration pelo slug no catálogo
// 2. callWithLogging: executa fetch + grava resultado em IntegrationLog (sempre)
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

export async function getIntegration(base44: B44Client, slug: string): Promise<AnyRecord | null> {
  try {
    const results = await base44.asServiceRole.entities.Integration.filter({ slug });
    return results && results.length > 0 ? results[0] : null;
  } catch {
    return null;
  }
}

function safeObject(value: unknown): AnyRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as AnyRecord;
  if (Array.isArray(value)) return { array: value };
  return { value: String(value || '') };
}

export async function callWithLogging(base44: B44Client, opts: CallOptions): Promise<CallResult> {
  const startTime = Date.now();
  let requestPayload: AnyRecord | null = null;
  if (typeof opts.body === 'string') {
    try { requestPayload = JSON.parse(opts.body); } catch { requestPayload = { raw: opts.body.slice(0, 500) }; }
  }

  let response: Response;
  let responseData: AnyRecord;
  let fetchError: string | null = null;

  try {
    response = await fetch(opts.url, { method: opts.method, headers: opts.headers || {}, body: opts.body });
    const text = await response.text();
    try {
      const parsed = JSON.parse(text);
      responseData = safeObject(parsed);
    } catch {
      responseData = { raw: text.slice(0, 2000) };
    }
  } catch (err) {
    fetchError = (err as Error).message;
    const duration = Date.now() - startTime;
    await base44.asServiceRole.entities.IntegrationLog.create({
      integration_slug: opts.slug, action: opts.action, method: opts.method,
      status: 'falha', error_message: fetchError, duration_ms: duration,
      details: `${opts.method} ${opts.url}`, request_payload: requestPayload,
    }).catch(() => {});
    return { ok: false, status: 0, data: { error: fetchError }, error: fetchError };
  }

  const duration = Date.now() - startTime;
  await base44.asServiceRole.entities.IntegrationLog.create({
    integration_slug: opts.slug, action: opts.action, method: opts.method,
    status: response.ok ? 'sucesso' : 'falha', response_status: response.status,
    response_payload: responseData,
    error_message: response.ok ? null : String(fetchError || JSON.stringify(responseData)).slice(0, 500),
    duration_ms: duration, details: `${opts.method} ${opts.url}`, request_payload: requestPayload,
  }).catch(() => {});

  return { ok: response.ok, status: response.status, data: responseData };
}