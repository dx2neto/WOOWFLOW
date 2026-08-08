import React, { useState, useMemo } from "react";
import {
  Database, FileSignature, MessageCircle, CheckCircle, XCircle,
  AlertTriangle, RefreshCw, Activity, Clock, TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/app-card";

const INTEGRATIONS = [
  {
    key: "ixc",
    label: "IXCSoft",
    icon: Database,
    color: "blue",
    services: ["ixc_provedor", "erp_provider"],
    logKeys: ["ixcApi", "erpApi"],
    errorMatch: "ixc",
    description: "ERP do provedor — clientes, contratos, planos, financeiro, OS",
  },
  {
    key: "zapsign",
    label: "ZapSign",
    icon: FileSignature,
    color: "purple",
    services: ["zapsign", "digital_signature"],
    logKeys: ["zapsignApi", "signatureApi"],
    errorMatch: "zapsign",
    description: "Assinatura digital — contratos, termos de adesão e comodato",
  },
  {
    key: "evolution",
    label: "Evolution API",
    icon: MessageCircle,
    color: "emerald",
    services: ["evolution_api", "evolution_go"],
    logKeys: ["evolutionApi", "evolutionWebhook"],
    errorMatch: "evolution",
    description: "WhatsApp — envio e recebimento de mensagens, webhooks",
  },
];

const colorMap = {
  blue:    { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: "text-blue-500", chip: "bg-blue-100 text-blue-700" },
  purple:  { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", icon: "text-purple-500", chip: "bg-purple-100 text-purple-700" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: "text-emerald-500", chip: "bg-emerald-100 text-emerald-700" },
};

const statusConfig = {
  connected:    { label: "Conectado",   icon: CheckCircle,    tone: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  disconnected: { label: "Desconectado", icon: XCircle,        tone: "text-red-600 bg-red-50 border-red-200" },
  error:        { label: "Com Erro",    icon: AlertTriangle,  tone: "text-red-600 bg-red-50 border-red-200" },
  pending:      { label: "Pendente",    icon: RefreshCw,      tone: "text-amber-600 bg-amber-50 border-amber-200" },
};

function StatPill({ label, value, icon: Icon, tone }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <Icon className={`h-4 w-4 ${tone || "text-muted-foreground"}`} />
      <div>
        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}

function IntegrationPanel({ integration, configs, logs, errors }) {
  const cfg = configs.find((c) => integration.services.includes(c.service));
  const status = cfg?.status || "disconnected";
  const statusCfg = statusConfig[status] || statusConfig.disconnected;
  const StatusIcon = statusCfg.icon;
  const colors = colorMap[integration.color];
  const Icon = integration.icon;

  const intLogs = logs.filter((l) => integration.logKeys.includes(l.integration));
  const intErrors = errors.filter((e) => (e.function_name || "").toLowerCase().includes(integration.errorMatch));
  const successCount = intLogs.filter((l) => l.status === "sucesso").length;
  const failCount = intLogs.filter((l) => l.status === "falha").length;
  const successRate = intLogs.length > 0 ? Math.round((successCount / intLogs.length) * 100) : 100;
  const lastLog = intLogs[0];
  const lastError = intErrors[0];

  return (
    <div className="space-y-4">
      {/* Status header */}
      <div className={`rounded-xl border ${colors.border} ${colors.bg} p-5`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm`}>
              <Icon className={`h-6 w-6 ${colors.icon}`} />
            </div>
            <div>
              <h3 className="text-lg font-bold">{integration.label}</h3>
              <p className="text-sm text-muted-foreground">{integration.description}</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${statusCfg.tone}`}>
            <StatusIcon className="h-4 w-4" />
            <span className="text-sm font-bold">{statusCfg.label}</span>
          </div>
        </div>
        {cfg?.error_message && (
          <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <p className="text-xs font-semibold text-red-700">{cfg.error_message}</p>
          </div>
        )}
        {cfg?.last_sync && (
          <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Última sincronização: {new Date(cfg.last_sync).toLocaleString("pt-BR")}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatPill label="Total de Chamadas" value={intLogs.length} icon={Activity} />
        <StatPill label="Sucessos" value={successCount} icon={CheckCircle} tone="text-emerald-500" />
        <StatPill label="Falhas" value={failCount} icon={XCircle} tone={failCount > 0 ? "text-red-500" : "text-muted-foreground"} />
        <StatPill label="Taxa de Sucesso" value={`${successRate}%`} icon={TrendingUp} tone={successRate >= 95 ? "text-emerald-500" : successRate >= 80 ? "text-amber-500" : "text-red-500"} />
      </div>

      {/* Recent errors */}
      {intErrors.length > 0 && (
        <Card title={`Erros Recentes (${intErrors.length})`} className="p-4">
          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
            {intErrors.slice(0, 10).map((err) => (
              <div key={err.id} className="flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-red-800 truncate">{err.error_message}</p>
                  <p className="text-xs text-red-600 mt-0.5">{err.action} · {new Date(err.created_date).toLocaleString("pt-BR")}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0 ${
                  err.severity === "critica" ? "bg-red-200 text-red-800" :
                  err.severity === "alta" ? "bg-orange-200 text-orange-800" :
                  "bg-amber-200 text-amber-800"
                }`}>{err.severity}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent logs */}
      <Card title="Histórico de Operações" className="p-4">
        {intLogs.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Nenhuma operação registrada para {integration.label}
          </div>
        ) : (
          <div className="space-y-1.5 max-h-96 overflow-y-auto scrollbar-thin">
            {intLogs.slice(0, 30).map((log) => (
              <div key={log.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card text-sm">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${log.status === "sucesso" ? "bg-emerald-500" : "bg-red-500"}`} />
                <span className="font-medium flex-shrink-0 text-xs">{log.action || "—"}</span>
                <span className="text-muted-foreground truncate flex-1 text-xs">{log.details || ""}</span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{new Date(log.created_date).toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Last activity summary */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {lastLog && (
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" /> Última operação: {new Date(lastLog.created_date).toLocaleString("pt-BR")}
          </span>
        )}
        {lastError && (
          <span className="flex items-center gap-1 text-red-500">
            <AlertTriangle className="h-3 w-3" /> Último erro: {new Date(lastError.created_date).toLocaleString("pt-BR")}
          </span>
        )}
      </div>
    </div>
  );
}

export default function IntegrationTabPanel({ configs = [], logs = [], errors = [], loading }) {
  const [activeTab, setActiveTab] = useState("ixc");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const current = INTEGRATIONS.find((i) => i.key === activeTab);

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto scrollbar-thin">
        {INTEGRATIONS.map((int) => {
          const Icon = int.icon;
          const colors = colorMap[int.color];
          const intErrors = errors.filter((e) => (e.function_name || "").toLowerCase().includes(int.errorMatch));
          const intFailLogs = logs.filter((l) => int.logKeys.includes(l.integration) && l.status === "falha");
          const hasIssues = intErrors.length > 0 || intFailLogs.length > 0;
          return (
            <button
              key={int.key}
              onClick={() => setActiveTab(int.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                activeTab === int.key
                  ? `border-primary text-primary`
                  : `border-transparent text-muted-foreground hover:text-foreground`
              }`}
            >
              <Icon className="h-4 w-4" />
              {int.label}
              {hasIssues && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${colors.chip}`}>
                  {intErrors.length + intFailLogs.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      <IntegrationPanel
        integration={current}
        configs={configs}
        logs={logs}
        errors={errors}
      />
    </div>
  );
}