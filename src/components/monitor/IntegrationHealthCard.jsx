import React from "react";
import {
  Database, MessageCircle, FileSignature, CreditCard,
  CheckCircle, XCircle, AlertTriangle, Clock, Wifi, WifiOff,
} from "lucide-react";

const INTEGRATION_META = {
  ixc: {
    label: "IXCSoft",
    description: "ERP — clientes, contratos, planos, financeiro, OS",
    icon: Database,
    color: "blue",
  },
  evolution: {
    label: "Evolution API",
    description: "WhatsApp — envio e recebimento de mensagens",
    icon: MessageCircle,
    color: "emerald",
  },
  zapsign: {
    label: "ZapSign",
    description: "Assinatura digital — contratos e termos",
    icon: FileSignature,
    color: "purple",
  },
  credit_provider: {
    label: "Consulta de Crédito",
    description: "ValidaCadastro — análise cadastral",
    icon: CreditCard,
    color: "amber",
  },
};

const COLOR_MAP = {
  blue:    { iconBg: "bg-blue-50", iconText: "text-blue-600", ring: "ring-blue-200" },
  emerald: { iconBg: "bg-emerald-50", iconText: "text-emerald-600", ring: "ring-emerald-200" },
  purple:  { iconBg: "bg-purple-50", iconText: "text-purple-600", ring: "ring-purple-200" },
  amber:   { iconBg: "bg-amber-50", iconText: "text-amber-600", ring: "ring-amber-200" },
};

const STATUS_CFG = {
  ONLINE: {
    label: "Online",
    icon: CheckCircle,
    tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
    dot: "bg-emerald-500",
  },
  CONFIGURED: {
    label: "Configurado",
    icon: CheckCircle,
    tone: "text-blue-700 bg-blue-50 border-blue-200",
    dot: "bg-blue-500",
  },
  OFFLINE: {
    label: "Offline",
    icon: XCircle,
    tone: "text-red-700 bg-red-50 border-red-200",
    dot: "bg-red-500",
  },
};

export default function IntegrationHealthCard({ integration }) {
  const meta = INTEGRATION_META[integration.key] || {
    label: integration.key,
    description: "",
    icon: AlertTriangle,
    color: "blue",
  };
  const colors = COLOR_MAP[meta.color] || COLOR_MAP.blue;
  const statusKey = integration.status || "OFFLINE";
  const statusCfg = STATUS_CFG[statusKey] || STATUS_CFG.OFFLINE;
  const StatusIcon = statusCfg.icon;
  const Icon = meta.icon;
  const isOffline = statusKey === "OFFLINE";

  return (
    <div className={`rounded-xl border p-4 bg-card transition-shadow hover:shadow-md ${isOffline ? "border-red-200 ring-1 ring-red-100" : "border-border"}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors.iconBg}`}>
          <Icon className={`w-5 h-5 ${colors.iconText}`} />
        </div>
        <div className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-bold ${statusCfg.tone}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot} ${!isOffline ? "animate-pulse" : ""}`} />
          {statusCfg.label}
        </div>
      </div>

      {/* Name + description */}
      <h4 className="font-bold text-sm">{meta.label}</h4>
      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{meta.description}</p>

      {/* Details */}
      <div className="mt-3 space-y-1 text-xs">
        {integration.response_ms != null && integration.status !== "OFFLINE" && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Latência
            </span>
            <span className={`font-semibold ${integration.response_ms < 1000 ? "text-emerald-600" : "text-amber-600"}`}>
              {integration.response_ms}ms
            </span>
          </div>
        )}
        {integration.instance && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Instância</span>
            <span className="font-mono text-[11px]">{integration.instance}</span>
          </div>
        )}
        {integration.url && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              {isOffline ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />} URL
            </span>
            <span className="font-mono text-[11px] truncate max-w-[120px]">{integration.url}</span>
          </div>
        )}
        {integration.product && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Produto</span>
            <span className="font-mono text-[11px]">{integration.product}</span>
          </div>
        )}
        {integration.http_status != null && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">HTTP</span>
            <span className={`font-mono text-[11px] ${integration.http_status < 400 ? "text-emerald-600" : "text-red-600"}`}>
              {integration.http_status}
            </span>
          </div>
        )}
      </div>

      {/* Error message */}
      {integration.error && (
        <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-2 py-1.5">
          <p className="text-xs text-red-700 line-clamp-2">{integration.error}</p>
        </div>
      )}
      {integration.message && !integration.error && integration.status !== "ONLINE" && (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5">
          <p className="text-xs text-amber-700 line-clamp-2">{integration.message}</p>
        </div>
      )}
    </div>
  );
}