import React from "react";
import { FileText, Wifi, Package, AlertCircle } from "lucide-react";

/**
 * Exibe os dados REAIS trazidos do IXC pelo orquestrador,
 * formatados conforme o especialista que atendeu a mensagem.
 */
export default function SpecialistDataView({ specialist, data }) {
  if (!data) return null;

  // ── FINANCE: faturas e débitos ──────────────────────────────────────────
  if (specialist === "finance") {
    const fat = data.faturas || {};
    const cliente = data.cliente || {};
    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="w-3.5 h-3.5" /> Cliente: <span className="text-foreground font-medium">{cliente.name || "—"}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Em aberto</p>
            <p className="font-semibold">{fat.abertas ?? 0}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Vencidas</p>
            <p className="font-semibold text-red-600">{fat.vencidas ?? 0}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Total devido</p>
            <p className="font-semibold">R$ {(fat.total_devido || 0).toFixed(2)}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Risco</p>
            <p className={`font-semibold capitalize ${fat.risk === "alto" ? "text-red-600" : fat.risk === "medio" ? "text-amber-600" : "text-green-600"}`}>
              {fat.risk || "—"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── TECH: contratos e equipamentos ───────────────────────────────────────
  if (specialist === "tech") {
    const contratos = data.contratos || [];
    const pppoe = data.pppoe || [];
    const cliente = data.cliente || {};
    return (
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Wifi className="w-3.5 h-3.5" /> {cliente.name || "—"}
        </div>
        {contratos.map((c, i) => (
          <div key={i} className="p-2 rounded-lg bg-muted/50 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs">{c.plan_name || `Contrato #${i + 1}`}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${c.status === "ativo" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {c.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              <span>Internet: {c.internet_status || "—"}</span>
              <span>IP: {c.ip || "—"}</span>
              <span>OLT: {c.olt || "—"}</span>
              <span>CTO: {c.cto || "—"}</span>
            </div>
          </div>
        ))}
        {pppoe.length > 0 && (
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-xs font-semibold text-muted-foreground mb-1">PPPoE</p>
            {pppoe.map((p, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                {p.login} | {p.status} | {p.ip || "sem IP"}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── SALES: planos disponíveis ────────────────────────────────────────────
  if (specialist === "sales") {
    const planos = data.planos || [];
    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Package className="w-3.5 h-3.5" /> {planos.length} planos disponíveis
        </div>
        {planos.slice(0, 5).map((p, i) => (
          <div key={i} className="p-2 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs">{p.name}</span>
              <span className="text-xs font-semibold text-primary">R$ {(p.price || 0).toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {p.download || "?"} ↓ / {p.upload || "?"} ↑ · {p.type || "—"}
            </p>
          </div>
        ))}
        {planos.length > 5 && (
          <p className="text-xs text-muted-foreground text-center">+{planos.length - 5} planos</p>
        )}
      </div>
    );
  }

  // ── RETENTION: análise de churn ─────────────────────────────────────────
  if (specialist === "retention") {
    const summary = data.summary || {};
    const fat = data.faturas || {};
    const contratos = data.contratos || [];
    const cliente = data.cliente || {};
    const churnRisk = data.churn_risk || "—";
    const isHigh = churnRisk.includes("ALTO");
    return (
      <div className="space-y-2 text-sm">
        <div className={`flex items-center gap-2 p-2 rounded-lg ${isHigh ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
          <AlertCircle className="w-4 h-4" />
          <span className="font-semibold text-xs">Risco de Churn: {churnRisk}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="font-semibold text-xs">{cliente.is_active ? "Ativo" : "Inativo"}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Contratos ativos</p>
            <p className="font-semibold">{summary.active_contracts || 0}/{summary.contracts_count || 0}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Vencidas</p>
            <p className="font-semibold text-red-600">{summary.overdue_count || 0}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Devido</p>
            <p className="font-semibold">R$ {(fat.total_devido || 0).toFixed(2)}</p>
          </div>
        </div>
        {contratos.length > 0 && (
          <div className="p-2 rounded-lg bg-muted/50">
            {contratos.map((c, i) => (
              <p key={i} className="text-xs text-muted-foreground">{c.plan_name} · {c.status}</p>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}