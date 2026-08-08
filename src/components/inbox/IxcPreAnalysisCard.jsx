import React from "react";
import {
  Wifi, WifiOff, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  FileText, DollarSign, Clock, MapPin, Hash, CreditCard, Activity, ShieldAlert,
} from "lucide-react";

const riskConfig = {
  baixo: { label: "Baixo Risco", color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  medio: { label: "Médio Risco", color: "text-amber-700 bg-amber-50 border-amber-200", icon: AlertTriangle },
  alto: { label: "Alto Risco", color: "text-red-700 bg-red-50 border-red-200", icon: ShieldAlert },
};

function formatCurrency(v) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function formatDate(v) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR");
}

export default function IxcPreAnalysisCard({ data, loading, onRefetch }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-background p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-4 w-4 rounded bg-muted" />
          <div className="h-3 w-32 rounded bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-8 rounded bg-muted" />
          <div className="h-8 rounded bg-muted" />
          <div className="h-8 rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!data || !data.found) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center">
        <XCircle className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
        <p className="text-xs font-semibold text-muted-foreground">Cliente não encontrado no IXC</p>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">Sem pré-análise disponível</p>
      </div>
    );
  }

  const { cliente, contratos = [], faturas = {}, pppoe = [], tickets = [], summary = {} } = data;
  const risk = riskConfig[faturas.risk || summary.financial_risk] || riskConfig.baixo;
  const RiskIcon = risk.icon;

  return (
    <div className="space-y-3">
      {/* Header: status do cliente */}
      <div className={`rounded-xl border p-3 ${cliente.is_active ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
        <div className="flex items-center gap-2 mb-2">
          {cliente.is_active ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
          <span className="text-sm font-bold">Cliente IXC #{cliente.id}</span>
          <button onClick={onRefetch} className="ml-auto rounded p-1 hover:bg-black/5" title="Atualizar">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">CPF/CNPJ</span><span className="font-mono font-semibold">{cliente.cpf_cnpj || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Cidade</span><span className="font-medium text-right">{cliente.city || "—"}</span></div>
          {cliente.address && <div className="flex items-start gap-1"><MapPin className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" /><span className="text-right">{cliente.address}</span></div>}
        </div>
      </div>

      {/* Resumo financeiro */}
      <div className={`rounded-xl border p-3 ${risk.color}`}>
        <div className="flex items-center gap-2 mb-2">
          <RiskIcon className="h-4 w-4" />
          <span className="text-sm font-bold">Situação Financeira</span>
          <span className="ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/60">{risk.label}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold">{faturas.abertas ?? 0}</p>
            <p className="text-[10px] uppercase opacity-70">Em aberto</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-600">{faturas.vencidas ?? 0}</p>
            <p className="text-[10px] uppercase opacity-70">Vencidas</p>
          </div>
          <div>
            <p className="text-sm font-bold">{formatCurrency(faturas.total_devido ?? 0)}</p>
            <p className="text-[10px] uppercase opacity-70">Devendo</p>
          </div>
        </div>
      </div>

      {/* Contratos */}
      {contratos.length > 0 && (
        <div className="rounded-xl border border-border bg-background p-3">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase text-muted-foreground">Contratos ({contratos.length})</span>
          </div>
          <div className="space-y-2">
            {contratos.slice(0, 3).map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg bg-muted/30 p-2">
                <div className={`h-2 w-2 rounded-full flex-shrink-0 ${c.status === "ativo" ? "bg-emerald-500" : "bg-red-500"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{c.plan_name || "Plano —"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.download && `${c.download}↓`} {c.upload && `${c.upload}↑`} {c.ip && `· ${c.ip}`}
                  </p>
                </div>
                {c.internet_status && (
                  <span className={`text-[10px] font-bold uppercase ${c.internet_status === "A" ? "text-emerald-600" : "text-red-600"}`}>
                    {c.internet_status === "A" ? "Online" : "Offline"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PPPoE / Conexão */}
      {pppoe.length > 0 && (
        <div className="rounded-xl border border-border bg-background p-3">
          <div className="flex items-center gap-2 mb-2">
            {pppoe[0].status === "online" ? <Wifi className="h-4 w-4 text-emerald-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
            <span className="text-xs font-bold uppercase text-muted-foreground">Conexão PPPoE</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Login</span><span className="font-mono font-semibold">{pppoe[0].login || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">IP</span><span className="font-mono">{pppoe[0].ip || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
              <span className={`font-bold ${pppoe[0].status === "online" ? "text-emerald-600" : "text-red-600"}`}>{pppoe[0].status === "online" ? "● Online" : "● Offline"}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tickets recentes */}
      {tickets.length > 0 && (
        <div className="rounded-xl border border-border bg-background p-3">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase text-muted-foreground">Atendimentos IXC ({tickets.length})</span>
          </div>
          <div className="space-y-1.5">
            {tickets.slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate flex-1">{t.subject || `Ticket #${t.id}`}</span>
                <span className="text-muted-foreground">{formatDate(t.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}