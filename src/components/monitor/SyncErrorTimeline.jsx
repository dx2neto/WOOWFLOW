import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/app-card";
import { AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronRight } from "lucide-react";

const SEVERITY_STYLE = {
  critica: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", badge: "bg-red-200 text-red-800" },
  alta:    { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-800", badge: "bg-orange-200 text-orange-800" },
  media:   { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", badge: "bg-amber-200 text-amber-800" },
  baixa:   { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-800", badge: "bg-slate-200 text-slate-800" },
};

export default function SyncErrorTimeline({ syncLogs = [], errorLogs = [], loading }) {
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState("all"); // all | failures | errors

  const failures = useMemo(
    () => syncLogs.filter((l) => l.status === "falha"),
    [syncLogs]
  );

  const filtered = useMemo(() => {
    if (filter === "failures") return failures;
    if (filter === "errors") return errorLogs;
    return [...failures, ...errorLogs].sort(
      (a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime()
    );
  }, [failures, errorLogs, filter]);

  if (loading) {
    return (
      <Card title="Erros de Sincronização" className="p-4">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
        </div>
      </Card>
    );
  }

  const filters = [
    { key: "all", label: "Todos", count: failures.length + errorLogs.length },
    { key: "failures", label: "Falhas de Sync", count: failures.length },
    { key: "errors", label: "Erros de Sistema", count: errorLogs.length },
  ];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold font-heading">Erros de Sincronização</h3>
        </div>
        <div className="flex gap-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {f.label} <span className="opacity-70">({f.count})</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-60" />
          Nenhum erro de sincronização registrado. Tudo funcionando perfeitamente!
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
          {filtered.slice(0, 50).map((item) => {
            const isExpanded = expanded === item.id;
            const severity = item.severity || "alta";
            const sevStyle = SEVERITY_STYLE[severity] || SEVERITY_STYLE.alta;
            const isSyncLog = "integration" in item;
            const title = isSyncLog
              ? `Falha: ${item.integration}`
              : item.error_message || "Erro no sistema";
            const detail = isSyncLog
              ? `${item.action || ""} — ${item.details || ""}`
              : `${item.function_name || "Sistema"} → ${item.action || ""}`;

            return (
              <div
                key={item.id}
                className={`rounded-lg border ${sevStyle.border} ${sevStyle.bg} px-3 py-2.5`}
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : item.id)}
                  className="w-full flex items-start gap-3 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${sevStyle.badge}`}>
                        {severity}
                      </span>
                      <p className={`text-sm font-semibold truncate ${sevStyle.text}`}>{title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{detail}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {new Date(item.created_date).toLocaleString("pt-BR")}
                  </span>
                </button>

                {isExpanded && (
                  <div className="mt-2 ml-7 space-y-2 text-xs">
                    {item.error_message && !isSyncLog && (
                      <div className="rounded bg-white/60 p-2">
                        <p className="font-semibold text-red-700 mb-1">Mensagem:</p>
                        <p className="text-red-600 break-words">{item.error_message}</p>
                      </div>
                    )}
                    {item.details && (
                      <div className="rounded bg-white/60 p-2">
                        <p className="font-semibold text-muted-foreground mb-1">Detalhes:</p>
                        <p className="text-muted-foreground break-words">{item.details}</p>
                      </div>
                    )}
                    {item.stack_trace && (
                      <div className="rounded bg-white/60 p-2">
                        <p className="font-semibold text-muted-foreground mb-1">Stack Trace:</p>
                        <pre className="text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                          {item.stack_trace.slice(0, 500)}
                        </pre>
                      </div>
                    )}
                    {item.error_context && (
                      <div className="rounded bg-white/60 p-2">
                        <p className="font-semibold text-muted-foreground mb-1">Contexto:</p>
                        <pre className="text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                          {item.error_context.slice(0, 500)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}