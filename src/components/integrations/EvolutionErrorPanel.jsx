import React, { useState } from "react";
import { useEntityFilter, useEntityList } from "@/hooks/useEntityQueries";
import { MessageCircle, AlertTriangle, RefreshCw, ChevronDown, ChevronRight, CheckCircle } from "lucide-react";

const failureColors = {
  critica: "border-red-300 bg-red-50 text-red-800",
  alta:    "border-orange-300 bg-orange-50 text-orange-800",
  media:   "border-amber-300 bg-amber-50 text-amber-800",
  baixa:   "border-blue-300 bg-blue-50 text-blue-800",
};

export default function EvolutionErrorPanel() {
  const [expanded, setExpanded] = useState(null);
  const { data: evoFailures = [], isLoading } = useEntityFilter(
    "IntegrationLog",
    { integration: "evolutionApi", status: "falha" },
    "-created_date",
    50
  );
  const { data: errorLogs = [] } = useEntityFilter(
    "ErrorLog",
    { function_name: "evolutionApi" },
    "-created_date",
    30
  );

  const allErrors = [
    ...evoFailures.map((f) => ({ ...f, _type: "integration" })),
    ...errorLogs.map((e) => ({ ...e, _type: "error", details: e.error_message })),
  ].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 20);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold font-heading">Erros da Evolution API</h3>
            <p className="text-xs text-muted-foreground">Falhas de envio e conexão com WhatsApp</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${allErrors.length > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
          {allErrors.length} erro(s)
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Carregando erros...
        </div>
      ) : allErrors.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
          <p className="text-sm text-muted-foreground">Nenhuma falha registrada na Evolution API</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto scrollbar-thin">
          {allErrors.map((err) => {
            const isOpen = expanded === err.id;
            const severity = err.severity || "alta";
            const colorClass = failureColors[severity] || failureColors.alta;
            return (
              <div key={err.id} className={`rounded-lg border ${colorClass} overflow-hidden`}>
                <button
                  onClick={() => setExpanded(isOpen ? null : err.id)}
                  className="w-full flex items-center gap-2 p-3 text-left"
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{err.action || err.error_message || "Falha no envio"}</p>
                    <p className="text-xs opacity-70 truncate">{err.details || err.error_message || "Sem detalhes"}</p>
                  </div>
                  <span className="text-[10px] opacity-60 flex-shrink-0">{new Date(err.created_date).toLocaleString("pt-BR")}</span>
                  {isOpen ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                </button>
                {isOpen && (err.stack_trace || err.error_context) && (
                  <div className="px-4 pb-3 pt-1 bg-white/30">
                    {err.stack_trace && (
                      <pre className="text-[11px] font-mono bg-black/5 rounded p-2 overflow-x-auto scrollbar-thin max-h-32">
                        {err.stack_trace}
                      </pre>
                    )}
                    {err.error_context && (
                      <pre className="text-[11px] font-mono bg-black/5 rounded p-2 overflow-x-auto scrollbar-thin max-h-24 mt-1">
                        {err.error_context}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}