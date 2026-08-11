/**
 * Módulo compartilhado de validação de origem para webhooks.
 *
 * Garante que apenas comunicações legítimas sejam processadas:
 * 1. Validação de API key/secret (fail-closed)
 * 2. Validação de origem (Origin/Referer host vs host configurado)
 * 3. Rate limiting por IP (janela deslizante)
 * 4. Allowlist de IPs opcional
 *
 * Uso:
 *   const result = await validateWebhookRequest(req, {
 *     apiKeyEnv: 'EVOLUTION_API_KEY',
 *     allowedOriginEnv: 'EVOLUTION_API_URL',
 *   });
 *   if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
 */

export interface WebhookSecurityConfig {
  /** Nome da variável de ambiente que contém o secret/API key do webhook */
  apiKeyEnv: string;
  /** Nome da variável de ambiente com a URL base permitida do provedor (para validar Origin/Referer) */
  allowedOriginEnv?: string;
  /** Máximo de requisições por minuto por IP (default: 120) */
  rateLimitMax?: number;
  /** Janela de rate limiting em ms (default: 60_000) */
  rateLimitWindowMs?: number;
  /** Allowlist estática de IPs (opcional) */
  allowedIps?: string[];
}

export interface WebhookValidationResult {
  ok: boolean;
  status?: number;
  error?: string;
  clientIp: string;
}

// ── Rate limiting em memória (janela deslizante) ─────────────────────────────
const ipHits = new Map<string, number[]>();

function rateLimitOk(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) return false;
  hits.push(now);
  ipHits.set(ip, hits);
  // Limpa entradas expiradas periodicamente
  if (ipHits.size > 1000) {
    for (const [k, v] of ipHits) {
      const fresh = v.filter((t) => now - t < windowMs);
      if (fresh.length === 0) ipHits.delete(k);
      else ipHits.set(k, fresh);
    }
  }
  return true;
}

/**
 * Extrai o IP do cliente de forma segura.
 */
function extractClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

/**
 * Valida a origem de um webhook. Fail-closed: se o secret não estiver configurado,
 * rejeita; se a origem não bater com a esperada, rejeita.
 */
export function validateWebhookRequest(
  req: Request,
  config: WebhookSecurityConfig,
): WebhookValidationResult {
  const clientIp = extractClientIp(req);

  // 1. Rate limiting por IP
  const max = config.rateLimitMax ?? 120;
  const windowMs = config.rateLimitWindowMs ?? 60_000;
  if (!rateLimitOk(clientIp, max, windowMs)) {
    return { ok: false, status: 429, error: 'Rate limit exceeded — too many webhook calls', clientIp };
  }

  // 2. API key / secret validation (fail-closed)
  const apiKey = Deno.env.get(config.apiKeyEnv) || '';
  if (!apiKey) {
    return { ok: false, status: 500, error: 'Webhook secret not configured', clientIp };
  }
  const providedKey = new URL(req.url).searchParams.get('key')
    || req.headers.get('x-webhook-secret')
    || req.headers.get('apikey')
    || req.headers.get('x-api-key');
  if (providedKey !== apiKey) {
    return { ok: false, status: 401, error: 'Unauthorized — invalid webhook secret', clientIp };
  }

  // 3. Origin / Referer validation (fail-closed quando Origin está presente)
  if (config.allowedOriginEnv) {
    const allowedUrl = Deno.env.get(config.allowedOriginEnv) || '';
    const origin = req.headers.get('origin') || req.headers.get('referer') || '';
    if (allowedUrl && origin) {
      try {
        const allowedHost = new URL(allowedUrl).hostname;
        const reqHost = new URL(origin).hostname;
        if (reqHost !== allowedHost) {
          return { ok: false, status: 403, error: `Forbidden — origin ${reqHost} not allowed`, clientIp };
        }
      } catch {
        // Origin malformado — rejeita (fail-closed)
        return { ok: false, status: 403, error: 'Forbidden — invalid origin header', clientIp };
      }
    }
  }

  // 4. IP allowlist (opcional)
  if (config.allowedIps && config.allowedIps.length > 0) {
    if (!config.allowedIps.includes(clientIp)) {
      return { ok: false, status: 403, error: `Forbidden — IP ${clientIp} not in allowlist`, clientIp };
    }
  }

  return { ok: true, clientIp };
}