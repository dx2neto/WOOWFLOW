import React, { useState, useMemo } from "react";
import { useEntityFilter } from "@/hooks/useEntityQueries";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronRight, Server, Filter } from "lucide-react";

const SLUG_LABELS = {
  zapsign: "ZapSign",
  clicksign: "Clicksign",
  omie: "Omie",
  ixcsoft: "IXCsoft",
  "evolution-api": "Evolution API",
  openai: "OpenAI",
  claude: "Claude",
  pagcard: "PagCard",
};

const SLUG_COLORS = {
  zapsign: "from-purple-600 to-fuchsia-600",
  clicksign: "from-orange-500 to-amber-600",
  omie: "from-blue-600 to-cyan-600",
  ixcsoft: "from-blue-700 to-sky-600",
  "evolution-api": "from-emerald-500 to-green-700",
  openai: "from-teal-600 to-emerald-600",
  claude: "from-amber-600 to-orange-700",
  pagcard: "from-cyan-700 to-blue-600",
};

export default function IntegrationHubErrors() {
  const [expanded, setExpanded] = useState(null);
  const [filterSlug, setFilterSlug] = useState("all");

  const { data: failures = [], isLoading } = useEntityFilter(
    "IntegrationLog",
    { status: "falha" },
    "-created_date",
    100
  );

  const grouped = useMemo(() => {
    const filtered = filterSlug === "all"
      ? failures
      : failures.filter((f) => f.integration_slug === filterSlug);
    const map = new Map();
    for (const f of filtered) {
      const slug = f.integration_slug || f.integration || "unknown";
      if (!map.has(slug)) map.set(slug, []);
      map.get(slug).push(f);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [failures, filterSlug]);

  const slugs = useMemo(() => {
    const set = new Set(failures.map((f) => f.integration_slug || f.integration || "unknown"));
    return Array.from(set).sort();
  }, [failures]);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold font-heading">Erros de Conexão — Integration Hub</h3>
            <p className="text-xs text-muted-foreground">Falhas de API registradas pelas funções do Integration Hub</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <select
            value={filterSlug}
            onChange={(e) => setFilterSlug(e.target.value)}
            className="h-8 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Todas as integrações</option>
            {slugs.map((s) => (
              <option key={s} value={s}>{SLUG_LABELS[s] || s}</option>
            ))}
          </select>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${failures.length > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
            {failures.length} erro(s)
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Carregando erros...
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-8">
          <Server className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
          <p className="text-sm text-muted-foreground">Nenhuma falha registrada nas integrações do Hub</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([slug, errors]) => {
            const label = SLUG_LABELS[slug] || slug;
            const color = SLUG_COLORS[slug] || "from-gray-500 to-gray-700";
            return (
              <div key={slug} className="rounded-lg border border-border overflow-hidden">
                <div className={`flex items-center justify-between px-4 py-2.5 bg-gradient-to-r ${color}`}>
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-white" />
                    <span className="text-sm font-bold text-white">{label}</span>
                    <code className="text-[10px] text-white/70 bg-white/10 px-1.5 py-0.5 rounded">{slug}</code>
                  </div>
                  <span className="text-xs font-bold text-white bg-white/20 px-2 py-0.5 rounded-full">
                    {errors.length} falha(s)
                  </span>
                </div>
                <div className="divide-y">
                  {errors.slice(0, 15).map((err) => {
                    const isOpen = expanded === err.id;
                    return (
                      <div key={err.id} className="hover:bg-muted/30">
                        <button
                          onClick={() => setExpanded(isOpen ? null : err.id)}
                          className="w-full flex items-center gap-2 p-3 text-left"
                        >
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold truncate">{err.action || "—"}</span>
                              {err.response_status && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                                  HTTP {err.response_status}
                                </span>
                              )}
                              {err.method && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {err.method}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {err.error_message || err.details || "Sem detalhes"}
                            </p>
                          </div>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0 whitespace-nowrap">
                            {new Date(err.created_date).toLocaleString("pt-BR")}
                          </span>
                          {err.duration_ms != null && (
                            <span className="text-[10px] text-muted-foreground flex-shrink-0 whitespace-nowrap">
                              {err.duration_ms}ms
                            </span>
                          )}
                        </button>
                        {isOpen && (err.response_payload || err.request_payload) && (
                          <div className="px-4 pb-3 pt-1 space-y-2">
                            {err.request_payload && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Request</p>
                                <pre className="text-[11px] font-mono bg-muted/50 rounded p-2 overflow-x-auto scrollbar-thin max-h-32">
                                  {JSON.stringify(err.request_payload, null, 2)}
                                </pre>
                              </div>
                            )}
                            {err.response_payload && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Response</p>
                                <pre className="text-[11px] font-mono bg-muted/50 rounded p-2 overflow-x-auto scrollbar-thin max-h-32">
                                  {JSON.stringify(err.response_payload, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {errors.length > 15 && (
                    <p className="px-4 py-2 text-xs text-muted-foreground">+{errors.length - 15} erro(s) anteriores não exibidos</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}