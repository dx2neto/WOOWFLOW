import React, { useState } from "react";
import { AlertCircle, AlertTriangle, Bug, Plug, Shield, User, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";

const severityConfig = {
  critica: { label: "Crítica", icon: AlertCircle, color: "text-red-700 bg-red-50 border-red-200", dot: "bg-red-500" },
  alta:    { label: "Alta",    icon: AlertTriangle, color: "text-orange-700 bg-orange-50 border-orange-200", dot: "bg-orange-500" },
  media:   { label: "Média",   icon: AlertTriangle, color: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500" },
  baixa:   { label: "Baixa",   icon: Bug, color: "text-blue-700 bg-blue-50 border-blue-200", dot: "bg-blue-500" },
};

const typeConfig = {
  error:       { icon: AlertTriangle, label: "Sistema" },
  integration: { icon: Plug,          label: "Integração" },
  config:      { icon: Plug,          label: "Config" },
  audit:       { icon: User,          label: "Auditoria" },
};

export default function AlertFeed({ alerts = [], loading }) {
  const [expanded, setExpanded] = useState(null);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 rounded-lg border border-border bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-12 rounded-xl border border-emerald-200 bg-emerald-50">
        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
        <p className="text-sm font-semibold text-emerald-800">Nenhum alerta pendente</p>
        <p className="text-xs text-emerald-600 mt-1">O sistema está operando sem pendências críticas</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {alerts.map((alert) => {
        const sev = severityConfig[alert.severity] || severityConfig.media;
        const typ = typeConfig[alert.type] || typeConfig.error;
        const SevIcon = sev.icon;
        const TypeIcon = typ.icon;
        const isOpen = expanded === alert.id;
        return (
          <div key={alert.id} className={`rounded-lg border ${sev.color} overflow-hidden`}>
            <button
              onClick={() => setExpanded(isOpen ? null : alert.id)}
              className="w-full flex items-center gap-3 p-3 text-left"
            >
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sev.dot} ${alert.severity === "critica" ? "animate-pulse" : ""}`} />
              <SevIcon className="h-4 w-4 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{alert.title}</p>
                <p className="text-xs opacity-70 flex items-center gap-1.5">
                  <TypeIcon className="h-3 w-3" />
                  {alert.source}{alert.detail ? ` · ${alert.detail}` : ""}
                </p>
              </div>
              <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-white/40 flex-shrink-0">{sev.label}</span>
              <span className="text-xs opacity-60 flex-shrink-0 hidden sm:block">
                {alert.timestamp ? new Date(alert.timestamp).toLocaleString("pt-BR") : ""}
              </span>
              {isOpen ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
            </button>
            {isOpen && (alert.context || alert.stack) && (
              <div className="px-4 pb-3 pt-1 space-y-2 bg-white/30">
                {alert.context && (
                  <div>
                    <p className="text-xs font-bold uppercase opacity-60 mb-1 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Contexto
                    </p>
                    <pre className="text-[11px] font-mono bg-black/5 rounded p-2 overflow-x-auto scrollbar-thin max-h-32">
                      {alert.context}
                    </pre>
                  </div>
                )}
                {alert.stack && (
                  <div>
                    <p className="text-xs font-bold uppercase opacity-60 mb-1 flex items-center gap-1">
                      <Bug className="h-3 w-3" /> Stack Trace
                    </p>
                    <pre className="text-[11px] font-mono bg-black/5 rounded p-2 overflow-x-auto scrollbar-thin max-h-48">
                      {alert.stack}
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