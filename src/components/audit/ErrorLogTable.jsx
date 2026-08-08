import React, { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, Bug, AlertCircle, CheckCircle } from "lucide-react";

const severityConfig = {
  critica: { label: "Crítica", icon: AlertCircle,    color: "text-red-700 bg-red-50 border-red-200" },
  alta:    { label: "Alta",    icon: AlertTriangle,  color: "text-orange-700 bg-orange-50 border-orange-200" },
  media:   { label: "Média",   icon: AlertTriangle,   color: "text-amber-700 bg-amber-50 border-amber-200" },
  baixa:   { label: "Baixa",   icon: Bug,            color: "text-blue-700 bg-blue-50 border-blue-200" },
};

export default function ErrorLogTable({ errors = [], loading }) {
  const [expanded, setExpanded] = useState(null);

  if (loading) {
    return <div className="text-center py-6 text-sm text-muted-foreground">Carregando erros...</div>;
  }

  if (errors.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
        Nenhum erro registrado no sistema
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {errors.map((err) => {
        const cfg = severityConfig[err.severity] || severityConfig.media;
        const Icon = cfg.icon;
        const isOpen = expanded === err.id;
        return (
          <div key={err.id} className={`rounded-lg border ${cfg.color} overflow-hidden`}>
            <button
              onClick={() => setExpanded(isOpen ? null : err.id)}
              className="w-full flex items-center gap-3 p-3 text-left"
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{err.error_message}</p>
                <p className="text-xs opacity-70">
                  {err.function_name}{err.action ? ` · ${err.action}` : ""} · {new Date(err.created_date).toLocaleString("pt-BR")}
                </p>
              </div>
              <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-white/40 flex-shrink-0">{cfg.label}</span>
              {isOpen ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
            </button>
            {isOpen && (
              <div className="px-4 pb-3 pt-1 space-y-2 bg-white/30">
                {err.stack_trace && (
                  <div>
                    <p className="text-xs font-bold uppercase opacity-60 mb-1">Stack Trace</p>
                    <pre className="text-[11px] font-mono bg-black/5 rounded p-2 overflow-x-auto scrollbar-thin max-h-48">
                      {err.stack_trace}
                    </pre>
                  </div>
                )}
                {err.error_context && (
                  <div>
                    <p className="text-xs font-bold uppercase opacity-60 mb-1">Contexto</p>
                    <pre className="text-[11px] font-mono bg-black/5 rounded p-2 overflow-x-auto scrollbar-thin max-h-32">
                      {err.error_context}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}