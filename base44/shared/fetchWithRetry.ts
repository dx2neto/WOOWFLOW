// ═══════════════════════════════════════════════════════════════════════════
// Shared fetch with exponential backoff retry.
// Used by ixcApi, zapsignApi, and other backend functions that call external
// APIs and need resilience against transient network errors and 5xx responses.
//
// Retries on:
//   - Network errors (fetch throws — DNS, connection refused, timeout)
//   - HTTP 5xx (server errors)
//   - HTTP 429 (rate limited)
//
// Does NOT retry on 4xx (except 429) — those are client errors (bad request,
// unauthorized, not found) that won't succeed on retry.
//
// Backoff: baseDelay * 2^attempt (1s, 2s, 4s by default)
// Max retries: 3 (4 total attempts)
// Timeout: 30s per attempt (overridable)
// ═══════════════════════════════════════════════════════════════════════════

interface RetryOptions {
  maxRetries?: number;  // default 3
  baseDelay?: number;  // default 1000ms
  timeout?: number;    // default 30000ms
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: RetryOptions = {},
): Promise<Response> {
  const { maxRetries = 3, baseDelay = 1000, timeout = 30_000 } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeout),
      });

      // Retry on 5xx or 429 (if we have retries left)
      if ((res.status >= 500 || res.status === 429) && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return res;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}