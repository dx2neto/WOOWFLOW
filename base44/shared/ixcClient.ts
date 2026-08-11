// ═══════════════════════════════════════════════════════════════════════════
// CAMADA CENTRALIZADA DE INTEGRAÇÃO IXCSoft
// ═══════════════════════════════════════════════════════════════════════════
// Toda comunicação com a API do IXCSoft passa por este módulo.
// Centraliza: autenticação, timeout, retry, paginação, logs, normalização.
//
// Uso em backend functions (Deno):
//   import { IXCClient } from '../../shared/ixcClient.ts';
//   const ixc = IXCClient.fromEnv();
//   const clientes = await ixc.list('cliente', { qtype: 'cliente.id', query: '1', oper: '>=' });
// ═══════════════════════════════════════════════════════════════════════════

import { fetchWithRetry } from './fetchWithRetry.ts';

export interface IXCConfig {
  baseUrl: string;
  token: string;
  timeout?: number;
  maxRetries?: number;
}

export interface IXCQuery {
  qtype: string;
  query: string;
  oper?: string;
  sortname?: string;
  sortorder?: string;
  page?: number;
  rp?: number;
}

export interface IXCListResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  registros: T[];
  total: number;
  raw?: unknown;
  error?: string;
}

// ── Cache em memória para tabelas de referência (cidades, planos) ────────────
// Evita buscar a tabela inteira de cidades a cada requisição.
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos
const cache = new Map<string, { data: unknown; expiresAt: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data as T;
}

function setCached(key: string, data: unknown): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Cliente IXC ──────────────────────────────────────────────────────────────

export class IXCClient {
  private baseUrl: string;
  private token: string;
  private timeout: number;
  private maxRetries: number;

  constructor(config: IXCConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.token = config.token;
    this.timeout = config.timeout ?? 30_000;
    this.maxRetries = config.maxRetries ?? 3;
  }

  static fromEnv(): IXCClient {
    const baseUrl = Deno.env.get('IXC_API_URL') || '';
    const token = Deno.env.get('IXC_API_TOKEN') || '';
    if (!baseUrl || !token) {
      throw new Error('IXC_API_URL e IXC_API_TOKEN devem estar configurados.');
    }
    return new IXCClient({ baseUrl, token });
  }

  static isConfigured(): boolean {
    return !!(Deno.env.get('IXC_API_URL') && Deno.env.get('IXC_API_TOKEN'));
  }

  private get authHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Basic ${this.token}`,
      ixcsoft: 'listar',
    };
  }

  private get writeHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Basic ${this.token}`,
    };
  }

  // ── Requisição POST list (paginada, uma página) ──────────────────────────
  async list<T = Record<string, unknown>>(
    endpoint: string,
    query: IXCQuery,
  ): Promise<IXCListResult<T>> {
    const url = `${this.baseUrl}/${endpoint.replace(/^\//, '')}`;
    const body = {
      qtype: query.qtype,
      query: query.query,
      oper: query.oper || '=',
      sortname: query.sortname || 'id',
      sortorder: query.sortorder || 'asc',
      page: String(query.page || 1),
      rp: String(query.rp || 60),
    };

    try {
      const res = await fetchWithRetry(url, {
        method: 'POST',
        headers: this.authHeaders,
        body: JSON.stringify(body),
      }, { timeout: this.timeout, maxRetries: this.maxRetries });

      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      if (!res.ok) {
        return { ok: false, status: res.status, registros: [], total: 0, raw: data, error: `HTTP ${res.status}` };
      }

      const registros = (data.registros || []) as T[];
      const total = parseInt(data.total || '0', 10) || registros.length;
      return { ok: true, status: res.status, registros, total, raw: data };
    } catch (error) {
      return { ok: false, status: 0, registros: [], total: 0, error: (error as Error).message };
    }
  }

  // ── Requisição POST list (todas as páginas, até maxRecords) ──────────────
  async listAll<T = Record<string, unknown>>(
    endpoint: string,
    query: Omit<IXCQuery, 'page' | 'rp'>,
    maxRecords = 2000,
  ): Promise<IXCListResult<T>> {
    const url = `${this.baseUrl}/${endpoint.replace(/^\//, '')}`;
    const rp = 200;
    let page = 1;
    let all: T[] = [];
    let total = Infinity;
    let lastError: string | undefined;

    while (all.length < total && all.length < maxRecords) {
      try {
        const res = await fetchWithRetry(url, {
          method: 'POST',
          headers: this.authHeaders,
          body: JSON.stringify({
            qtype: query.qtype,
            query: query.query,
            oper: query.oper || '>=',
            sortname: query.sortname || 'id',
            sortorder: query.sortorder || 'asc',
            page: String(page),
            rp: String(rp),
          }),
        }, { timeout: this.timeout, maxRetries: this.maxRetries });

        const text = await res.text();
        let data: any;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }

        if (!res.ok) {
          return { ok: false, status: res.status, registros: all, total: all.length, raw: data, error: `HTTP ${res.status}` };
        }

        const registros = (data.registros || []) as T[];
        all = all.concat(registros);
        total = parseInt(data.total || '0', 10) || all.length;
        if (registros.length === 0) break;
        page += 1;
      } catch (error) {
        lastError = (error as Error).message;
        break;
      }
    }

    return { ok: !lastError, status: lastError ? 0 : 200, registros: all, total: all.length, error: lastError };
  }

  // ── Requisição POST para criar (sem header ixcsoft:listar) ───────────────
  async create<T = Record<string, unknown>>(endpoint: string, data: Record<string, unknown>): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
    const url = `${this.baseUrl}/${endpoint.replace(/^\//, '')}`;
    try {
      const res = await fetchWithRetry(url, {
        method: 'POST',
        headers: this.writeHeaders,
        body: JSON.stringify(data),
      }, { timeout: this.timeout, maxRetries: this.maxRetries });

      const text = await res.text();
      let body: any;
      try { body = JSON.parse(text); } catch { body = { raw: text }; }

      return { ok: res.ok, status: res.status, data: body };
    } catch (error) {
      return { ok: false, status: 0, error: (error as Error).message };
    }
  }

  // ── Requisição PUT para atualizar ─────────────────────────────────────────
  async update<T = Record<string, unknown>>(endpoint: string, id: string, data: Record<string, unknown>): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
    const url = `${this.baseUrl}/${endpoint.replace(/^\//, '')}/${id}`;
    try {
      const res = await fetchWithRetry(url, {
        method: 'PUT',
        headers: this.writeHeaders,
        body: JSON.stringify(data),
      }, { timeout: this.timeout, maxRetries: this.maxRetries });

      const text = await res.text();
      let body: any;
      try { body = JSON.parse(text); } catch { body = { raw: text }; }

      return { ok: res.ok, status: res.status, data: body };
    } catch (error) {
      return { ok: false, status: 0, error: (error as Error).message };
    }
  }

  // ── Busca em lote por IDs (operador IN) ───────────────────────────────────
  async listByIds<T = Record<string, unknown>>(
    endpoint: string,
    idField: string,
    ids: string[],
    extraQuery?: Partial<IXCQuery>,
  ): Promise<IXCListResult<T>> {
    if (ids.length === 0) return { ok: true, status: 200, registros: [], total: 0 };
    return this.list<T>(endpoint, {
      qtype: idField,
      query: ids.join(','),
      oper: 'IN',
      sortname: extraQuery?.sortname || idField,
      sortorder: extraQuery?.sortorder || 'asc',
      page: 1,
      rp: Math.min(ids.length, 500),
    });
  }

  // ── Mapa de cidades (com cache de 10 min) ────────────────────────────────
  async getCidadeMap(): Promise<Record<string, string>> {
    const cacheKey = 'ixc_cidades_map';
    const cached = getCached<Record<string, string>>(cacheKey);
    if (cached) return cached;

    const result = await this.listAll<any>('cidade', {
      qtype: 'cidade.id',
      query: '1',
      oper: '>=',
      sortname: 'cidade.id',
      sortorder: 'asc',
    }, 20000);

    const mapa: Record<string, string> = {};
    if (result.ok) {
      for (const c of result.registros) {
        const nome = c.nome || c.cidade || c.descricao || '';
        const uf = c.uf_sigla || c.sigla_uf || c.uf || '';
        mapa[String(c.id)] = uf ? `${nome} - ${uf}` : nome;
      }
    }
    setCached(cacheKey, mapa);
    return mapa;
  }

  // ── Teste de conectividade ────────────────────────────────────────────────
  async testConnection(): Promise<{ ok: boolean; responseMs: number; totalClientes?: number; error?: string }> {
    const t0 = Date.now();
    const result = await this.list('cliente', {
      qtype: 'cliente.id', query: '1', oper: '>=', page: 1, rp: 1,
    });
    const ms = Date.now() - t0;
    return {
      ok: result.ok,
      responseMs: ms,
      totalClientes: result.total,
      error: result.error,
    };
  }
}

// ── Normalização de dados IXC ───────────────────────────────────────────────

export function normalizeIXCStatus(status: string): 'ativo' | 'cancelado' | 'suspenso' | 'outro' {
  const s = String(status || '').toUpperCase();
  if (s === 'A') return 'ativo';
  if (s === 'CA') return 'cancelado';
  if (s === 'S') return 'suspenso';
  if (s === 'I') return 'cancelado';
  return 'outro';
}

export function normalizeIXCInternetStatus(status: string): 'online' | 'suspenso' | 'inativo' | 'outro' {
  const s = String(status || '').toUpperCase();
  if (s === 'A') return 'online';
  if (s === 'S') return 'suspenso';
  if (s === 'I') return 'inativo';
  return 'outro';
}

export function normalizeIXCPhone(phone: string): string {
  return String(phone || '').replace(/\D/g, '');
}

export function parseIXCValue(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  return parseFloat(String(value || '0')) || 0;
}