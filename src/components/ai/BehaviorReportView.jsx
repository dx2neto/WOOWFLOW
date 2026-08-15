import React from "react";
import { Wifi, CreditCard, AlertTriangle, TrendingUp, Activity, Signal } from "lucide-react";

const RISK_COLORS = {
  baixo: "bg-green-100 text-green-700",
  medio: "bg-amber-100 text-amber-700",
  alto: "bg-red-100 text-red-700",
  ALTO: "bg-red-100 text-red-700",
  MÉDIO: "bg-amber-100 text-amber-700",
  "MÉDIO": "bg-amber-100 text-amber-700",
  BAIXO: "bg-green-100 text-green-700",
};

function formatBRL(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function signalQuality(dbm) {
  const v = Number(dbm);
  if (!v && v !== 0) return { label: "N/A", color: "text-muted-foreground" };
  if (v >= -25) return { label: "Excelente", color: "text-green-600" };
  if (v >= -28) return { label: "Bom", color: "text-amber-600" };
  return { label: "Ruim", color: "text-red-600" };
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1">
        <Icon className="w-3 h-3" /> {title}
      </p>
      {children}
    </div>
  );
}

export default function BehaviorReportView({ data }) {
  if (!data) return null;

  const pay = data.payment_history || {};
  const pppoe = data.pppoe_disconnections || {};
  const comp = data.complaints || {};
  const tick = data.tickets || {};
  const sig = data.signal || [];
  const summ = data.summary || {};

  return (
    <div className="space-y-4">
      {/* Risco geral */}
      {summ.overall_risk && (
        <div className={`p-3 rounded-lg text-sm font-medium text-center ${RISK_COLORS[summ.overall_risk] || "bg-muted"}`}>
          Risco Geral do Cliente: {summ.overall_risk}
        </div>
      )}

      {/* Pagamentos */}
      <Section icon={CreditCard} title="Histórico de Pagamentos">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-muted/40">
            <p className="text-muted-foreground">Total de faturas</p>
            <p className="font-semibold text-sm">{pay.total_invoices || 0}</p>
          </div>
          <div className="p-2 rounded-lg bg-green-50">
            <p className="text-muted-foreground">Pagas em dia</p>
            <p className="font-semibold text-sm text-green-700">{pay.paid_on_time || 0}</p>
          </div>
          <div className="p-2 rounded-lg bg-amber-50">
            <p className="text-muted-foreground">Pagas com atraso</p>
            <p className="font-semibold text-sm text-amber-700">{pay.paid_late || 0}</p>
          </div>
          <div className="p-2 rounded-lg bg-red-50">
            <p className="text-muted-foreground">Vencidas</p>
            <p className="font-semibold text-sm text-red-700">{pay.overdue || 0}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs mt-1">
          <span className="text-muted-foreground">Atraso médio: <span className="font-medium text-foreground">{pay.avg_days_late || 0} dias</span></span>
          <span className="text-muted-foreground">Maior atraso: <span className="font-medium text-foreground">{pay.max_days_late || 0} dias</span></span>
        </div>
        {pay.payment_score != null && (
          <div className="mt-1">
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="text-muted-foreground">Score de pagamento</span>
              <span className="font-semibold">{pay.payment_score}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${pay.payment_score >= 70 ? "bg-green-500" : pay.payment_score >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${pay.payment_score}%` }}
              />
            </div>
          </div>
        )}
        {pay.behavior && (
          <p className="text-xs text-muted-foreground">Comportamento: <span className="font-medium text-foreground">{pay.behavior}</span></p>
        )}
      </Section>

      {/* Sinal da fibra */}
      {sig.length > 0 && (
        <Section icon={Signal} title="Sinal da Fibra">
          <div className="space-y-1">
            {sig.slice(0, 3).map((s, i) => {
              const sq = s.potencia_rx ? signalQuality(s.potencia_rx) : null;
              return (
                <div key={i} className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-muted/40 text-xs">
                  <span className="font-mono">{s.login || "—"}</span>
                  <span className={`px-1 py-0.5 rounded text-[10px] ${s.status === "online" || s.status === "Ativo" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {s.status || "—"}
                  </span>
                  {s.potencia_rx != null && (
                    <span className={`font-medium ${sq.color}`}>📶 {s.potencia_rx} dBm ({sq.label})</span>
                  )}
                  {s.olt && <span className="text-muted-foreground/70">OLT: {s.olt}</span>}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Estabilidade da conexão */}
      <Section icon={Activity} title="Estabilidade da Conexão">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-muted/40">
            <p className="text-muted-foreground">Total de sessões</p>
            <p className="font-semibold text-sm">{pppoe.total_sessions || 0}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/40">
            <p className="text-muted-foreground">Desconexões</p>
            <p className="font-semibold text-sm">{pppoe.total_disconnections || 0}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs mt-1">
          <span className="text-muted-foreground">Tempo médio: <span className="font-medium text-foreground">{pppoe.avg_session_time_min || 0} min</span></span>
          <span className="text-muted-foreground">Última desconexão: <span className="font-medium text-foreground">{pppoe.last_disconnect || "—"}</span></span>
        </div>
        {summ.pppoe_stability && (
          <p className="text-xs text-muted-foreground">Estabilidade: <span className="font-medium text-foreground">{summ.pppoe_stability}</span></p>
        )}
        {pppoe.top_causes && pppoe.top_causes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {pppoe.top_causes.slice(0, 3).map((c, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {c.cause} ({c.count}x)
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* Tickets e reclamações */}
      <Section icon={AlertTriangle} title="Tickets e Reclamações">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-muted/40">
            <p className="text-muted-foreground">Tickets totais</p>
            <p className="font-semibold text-sm">{tick.total || 0}</p>
          </div>
          <div className="p-2 rounded-lg bg-amber-50">
            <p className="text-muted-foreground">Tickets abertos</p>
            <p className="font-semibold text-sm text-amber-700">{tick.open || 0}</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/40">
            <p className="text-muted-foreground">Reclamações totais</p>
            <p className="font-semibold text-sm">{comp.total || 0}</p>
          </div>
          <div className="p-2 rounded-lg bg-red-50">
            <p className="text-muted-foreground">Reclamações em aberto</p>
            <p className="font-semibold text-sm text-red-700">{comp.open || 0}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs mt-1">
          <span className="text-muted-foreground">Tickets 30d: <span className="font-medium text-foreground">{tick.last_30_days || 0}</span></span>
          <span className="text-muted-foreground">Reclamações 30d: <span className="font-medium text-foreground">{comp.last_30_days || 0}</span></span>
        </div>
        {summ.complaint_risk && (
          <p className="text-xs text-muted-foreground">Risco de reclamação: <span className="font-medium text-foreground">{summ.complaint_risk}</span></p>
        )}
      </Section>
    </div>
  );
}