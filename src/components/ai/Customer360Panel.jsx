import React, { useState } from "react";
import { ixcApi } from "@/functions/ixcApi";
import { Search, User, FileText, Wifi, CreditCard, AlertTriangle, Loader2, Phone, Mail, MapPin, Wrench, Headset } from "lucide-react";

const RISK_COLORS = {
  baixo: "bg-green-100 text-green-700 border-green-200",
  medio: "bg-amber-100 text-amber-700 border-amber-200",
  alto: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_COLORS = {
  ativo: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-700",
  online: "bg-green-100 text-green-700",
  offline: "bg-red-100 text-red-700",
  aberto: "bg-amber-100 text-amber-700",
  fechado: "bg-green-100 text-green-700",
  paga: "bg-green-100 text-green-700",
  pendente: "bg-amber-100 text-amber-700",
  vencida: "bg-red-100 text-red-700",
};

const TICKET_STATUS_COLORS = {
  A: "bg-amber-100 text-amber-700",
  AB: "bg-amber-100 text-amber-700",
  F: "bg-green-100 text-green-700",
  C: "bg-red-100 text-red-700",
};

function formatBRL(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
}

function signalQuality(dbm) {
  const v = Number(dbm);
  if (!v && v !== 0) return { label: "N/A", color: "text-muted-foreground" };
  if (v >= -25) return { label: "Excelente", color: "text-green-600" };
  if (v >= -28) return { label: "Bom", color: "text-amber-600" };
  return { label: "Ruim", color: "text-red-600" };
}

export default function Customer360Panel({ onCustomerFound }) {
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const formatCPF = (v) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    if (d.length <= 11) {
      return d
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return d
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  };

  const search = async () => {
    const doc = cpf.replace(/\D/g, "");
    if (doc.length < 11) { setError("CPF/CNPJ inválido"); return; }
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await ixcApi({ action: "customer_360", cpfCnpj: doc });
      const payload = res.data?.data || res.data;
      if (!payload) throw new Error("Resposta inválida");
      if (payload.found === false) {
        setError("Cliente não encontrado no IXCSoft");
        setData(null);
        onCustomerFound?.(null);
      } else {
        setData(payload);
        onCustomerFound?.({
          id: payload.cliente?.id,
          name: payload.cliente?.name,
          cpf_cnpj: payload.cliente?.cpf_cnpj,
          phone: payload.cliente?.phone,
          city: payload.cliente?.city,
          is_active: payload.cliente?.is_active,
          financial_risk: payload.summary?.financial_risk,
          overdue_count: payload.summary?.overdue_count,
        });
      }
    } catch (e) {
      setError(e.message || "Erro ao consultar cliente");
    } finally {
      setLoading(false);
    }
  };

  // Null-safe accessors
  const cliente = data?.cliente || {};
  const contratos = data?.contratos || [];
  const pppoe = data?.pppoe || [];
  const tickets = data?.tickets || [];
  const faturas = data?.faturas || {};
  const summary = data?.summary || {};
  const hasData = data && data.found !== false;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <input
          value={cpf}
          onChange={(e) => setCpf(formatCPF(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="000.000.000-00"
          disabled={loading}
          className="flex-1 h-10 px-3 bg-muted/60 rounded-lg text-sm focus:outline-none focus:bg-card focus:ring-1 focus:ring-primary disabled:opacity-50"
        />
        <button
          onClick={search}
          disabled={loading || cpf.replace(/\D/g, "").length < 11}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Buscar
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {hasData && (
        <>
          {/* Customer Card */}
          <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{cliente.name || "Cliente sem nome"}</p>
                  <p className="text-xs text-muted-foreground">ID #{cliente.id || "—"}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-md text-xs font-medium ${cliente.is_active === true ? "bg-green-100 text-green-700" : cliente.is_active === false ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}`}>
                {cliente.is_active === true ? "Ativo" : cliente.is_active === false ? "Inativo" : "—"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="font-medium text-foreground">CPF/CNPJ:</span> {cliente.cpf_cnpj || "—"}</span>
              <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {cliente.phone || "—"}</span>
              <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> {cliente.email || "—"}</span>
              <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {cliente.city || "—"}</span>
              {cliente.address && <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {cliente.address}</span>}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-lg border border-border text-center">
              <p className="text-lg font-bold">{summary.active_contracts ?? 0}/{summary.contracts_count ?? 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Contratos</p>
            </div>
            <div className="p-3 rounded-lg border border-border text-center">
              <p className="text-lg font-bold text-red-600">{summary.overdue_count ?? 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Vencidas</p>
            </div>
            <div className="p-3 rounded-lg border border-border text-center">
              <p className="text-lg font-bold">{summary.tickets_count ?? 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Tickets</p>
            </div>
          </div>

          {/* Último técnico e atendente */}
          {(data.last_technician || data.last_attendant) && (
            <div className="grid grid-cols-2 gap-2">
              {data.last_technician && (
                <div className="p-2.5 rounded-lg border border-border bg-muted/30 text-xs">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-0.5 flex items-center gap-1"><Wrench className="w-2.5 h-2.5" /> Último Técnico</p>
                  <p className="font-medium truncate">{data.last_technician}</p>
                </div>
              )}
              {data.last_attendant && (
                <div className="p-2.5 rounded-lg border border-border bg-muted/30 text-xs">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-0.5 flex items-center gap-1"><Headset className="w-2.5 h-2.5" /> Último Atendente</p>
                  <p className="font-medium truncate">{data.last_attendant}</p>
                </div>
              )}
            </div>
          )}

          {/* Financial Risk */}
          {summary.financial_risk && (
            <div className={`p-3 rounded-lg border text-sm ${RISK_COLORS[summary.financial_risk] || "bg-muted"}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Risco Financeiro</span>
                <span className="font-bold uppercase">{summary.financial_risk}</span>
              </div>
              {summary.total_devido > 0 && (
                <p className="text-xs mt-1 opacity-80">Débito em atraso: {formatBRL(summary.total_devido)}</p>
              )}
            </div>
          )}

          {/* Contracts — detalhado com sinal, velocidade, plano, valor e atendimentos */}
          {contratos.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold mb-2 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Contratos ({contratos.length})
              </p>
              <div className="space-y-2">
                {contratos.map((c) => {
                  const openTickets = (c.tickets || []).filter((t) => t.status === "A" || t.status === "AB");
                  return (
                    <div key={c.id} className="p-2.5 rounded-lg bg-muted/40 text-xs space-y-2 border border-border/50">
                      {/* Header: plano + status */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate flex-1">{c.plan_name || `Contrato #${c.id}`}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[c.status] || "bg-muted"}`}>{c.status}</span>
                      </div>

                      {/* Velocidade contratada + valor mensal + status internet */}
                      <div className="flex flex-wrap gap-2 items-center">
                        {c.download && <span className="text-blue-600 font-medium">↓ {c.download} Mbps</span>}
                        {c.upload && <span className="text-green-600 font-medium">↑ {c.upload} Mbps</span>}
                        {c.monthly_fee > 0 && <span className="text-foreground font-semibold bg-muted px-1.5 py-0.5 rounded">{formatBRL(c.monthly_fee)}/mês</span>}
                        {c.internet_status && (
                          <span className={c.internet_status === "A" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                            {c.internet_status === "A" ? "● Internet ativa" : "● Internet offline"}
                          </span>
                        )}
                      </div>

                      {/* Cidade / Endereço / Vendedor */}
                      {(c.city || c.address || c.vendor_name) && (
                        <div className="flex flex-wrap gap-2 text-muted-foreground/70">
                          {c.city && <span>📍 {c.city}</span>}
                          {c.vendor_name && <span>👤 Vendedor: {c.vendor_name}</span>}
                          {c.address && <span>🏠 {c.address}</span>}
                        </div>
                      )}

                      {/* OLT / CTO / IP */}
                      {(c.olt || c.cto || c.ip || c.mac) && (
                        <div className="flex flex-wrap gap-2 text-muted-foreground/70">
                          {c.olt && <span>OLT: {c.olt}</span>}
                          {c.cto && <span>CTO: {c.cto}</span>}
                          {c.ip && <span>IP: {c.ip}</span>}
                          {c.mac && <span>MAC: {c.mac}</span>}
                        </div>
                      )}

                      {/* PPPoE do contrato com sinal de fibra */}
                      {c.pppoe && c.pppoe.length > 0 && (
                        <div className="mt-1 space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
                            <Wifi className="w-2.5 h-2.5" /> PPPoE / Sinal de Fibra
                          </p>
                          {c.pppoe.map((p, i) => {
                            const sig = p.potencia_rx ? signalQuality(p.potencia_rx) : null;
                            return (
                              <div key={i} className="flex flex-wrap items-center gap-2 p-1.5 rounded bg-background/60 border border-border/30">
                                <span className="font-mono text-[11px]">{p.login}</span>
                                <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${STATUS_COLORS[p.status] || "bg-muted"}`}>{p.status}</span>
                                {p.potencia_rx != null && (
                                  <span className={`text-[10px] font-medium ${sig.color}`}>
                                    📶 {p.potencia_rx} dBm ({sig.label})
                                  </span>
                                )}
                                {p.ip && <span className="text-[10px] text-muted-foreground/60">IP: {p.ip}</span>}
                                {p.olt && <span className="text-[10px] text-muted-foreground/60">OLT: {p.olt}</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Histórico de atendimentos abertos por contrato */}
                      {openTickets.length > 0 && (
                        <div className="mt-1 space-y-1">
                          <p className="text-[10px] text-amber-600 uppercase font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> {openTickets.length} Atendimento(s) Aberto(s)
                          </p>
                          {openTickets.map((t) => (
                            <div key={t.id} className="flex flex-wrap items-center gap-2 p-1.5 rounded bg-amber-50/50 border border-amber-200/50">
                              <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${TICKET_STATUS_COLORS[t.status] || "bg-muted"}`}>
                                #{t.id}
                              </span>
                              <span className="truncate flex-1 text-[11px]">{t.subject || "Sem assunto"}</span>
                              {t.priority && <span className="text-[10px] text-muted-foreground">P: {t.priority}</span>}
                              {t.tech_name && <span className="text-[10px] text-blue-600">🔧 {t.tech_name}</span>}
                              {t.attendant_name && <span className="text-[10px] text-purple-600">🎧 {t.attendant_name}</span>}
                              <span className="text-[10px] text-muted-foreground/60">{formatDate(t.date)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Total de atendimentos do contrato (incluindo fechados) */}
                      {c.tickets && c.tickets.length > openTickets.length && (
                        <p className="text-[10px] text-muted-foreground/60">
                          {c.tickets.length} atendimento(s) no total neste contrato
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Invoices */}
          {faturas.recentes && faturas.recentes.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold mb-2 flex items-center gap-1">
                <CreditCard className="w-3 h-3" /> Faturas Recentes
              </p>
              <div className="space-y-1">
                {faturas.recentes.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs">
                    <span>{formatDate(f.due_date)}</span>
                    <span className="font-medium">{formatBRL(f.value)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[f.status === "A" ? "pendente" : "paga"] || "bg-muted"}`}>
                      {f.status === "A" ? "Aberta" : "Paga"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Tickets */}
          {tickets.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Todos os Atendimentos ({tickets.length})
              </p>
              <div className="space-y-1">
                {tickets.slice(0, 10).map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs">
                    <span className="truncate flex-1">{t.subject || `#${t.id}`}</span>
                    {t.tech_name && <span className="text-[10px] text-blue-600 ml-1">🔧 {t.tech_name}</span>}
                    <span className="text-muted-foreground ml-2">{formatDate(t.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}