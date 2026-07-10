import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, StatCard, Card } from "@/components/ui/app-card";
import FinancialPanel from "@/components/dashboard/FinancialPanel";
import { ixcApi } from "@/functions/ixcApi";
import { agreementApi } from "@/functions/agreementApi";
import { Link } from "react-router-dom";
import {
  Inbox, DollarSign, Clock, CheckCircle, TrendingUp,
  Star, AlertCircle, MessageSquare, Users, FileText, Wrench,
  TrendingDown, Shield, XCircle, Calendar, ArrowRight, RefreshCw,
  Loader2
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PERIOD_DAYS = {
  "Hoje": 0,
  "Ontem": 1,
  "Esta semana": 7,
  "Este mês": 30,
  "Últimos 30 dias": 30,
  "Últimos 60 dias": 60,
  "Últimos 90 dias": 90,
};

const PERIODS = Object.keys(PERIOD_DAYS);

const CHANNEL_LABELS = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Messenger",
  telegram: "Telegram",
  webchat: "WebChat",
  chat_externo: "Chat Ext.",
  chat_interno: "Chat Int.",
  telefone: "Telefone",
  email: "E-mail",
  sms: "SMS",
};

const CHANNEL_COLORS = {
  whatsapp: "#22c55e", instagram: "#e1306c", facebook: "#1877f2",
  telegram: "#0088cc", webchat: "#8b5cf6", chat_externo: "#f97316",
  chat_interno: "#f59e0b", telefone: "#6366f1", email: "#f43f5e", sms: "#14b8a6",
};

const SECTOR_COLORS_CHART = ["#3b82f6","#22c55e","#f59e0b","#ef4444","#a855f7","#14b8a6","#6366f1","#f97316","#0ea5e9","#f43f5e"];

// Gera os 7 dias da semana (domingo = 0) para o gráfico de tendência
function buildWeekDays() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
    });
  }
  return days;
}

// Formata segundos em "Xm Ys"
function fmtSeconds(s) {
  if (!s || s < 0) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}


// ─── Painel de Verificação de Acordo ──────────────────────────────────────────
function AgreementPanel() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    agreementApi({ action: "dashboard" })
      .then((res) => { if (res?.data?.success) setData(res.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Card className="p-5 mb-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando acordos...
      </div>
    </Card>
  );
  if (!data) return null;

  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-base flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" /> Verificação de Acordo — Resumo
        </h3>
        <Link to="/agreements" className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
          Ver todos <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard title="Acordos Ativos"   value={data.active  ?? "—"} icon={CheckCircle} color="accent"   />
        <StatCard title="Acordos Vencidos" value={data.overdue ?? "—"} icon={Clock}       color="warning"  />
        <StatCard title="Acordos Quebrados"value={data.broken  ?? "—"} icon={XCircle}     color="danger"   />
        <StatCard title="Acordos Quitados" value={data.paid    ?? "—"} icon={Shield}      color="primary"  />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-emerald-600 mb-1">Total Negociado</p>
          <p className="text-lg font-bold text-emerald-700 font-mono">{fmtBRL(data.total_negotiated)}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-600 mb-1">Em Atraso</p>
          <p className="text-lg font-bold text-red-700 font-mono">{fmtBRL(data.total_overdue_amount)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-600 mb-1">Valor Recuperado</p>
          <p className="text-lg font-bold text-blue-700 font-mono">{fmtBRL(data.total_recovered)}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-600 mb-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Venc. em 7 dias
          </p>
          <p className="text-lg font-bold text-amber-700">{data.next_due_7_days ?? "—"} acordo{data.next_due_7_days === 1 ? "" : "s"}</p>
        </div>
      </div>
      {((data.overdue || 0) + (data.broken || 0)) > 0 && (
        <div className="mt-4 flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700 font-medium">
              {(data.overdue || 0) + (data.broken || 0)} acordo(s) precisam de atenção imediata
              {data.pending_signature > 0 && ` · ${data.pending_signature} aguardando assinatura`}
            </p>
          </div>
          <Link to="/agreements" className="text-xs font-semibold text-red-700 hover:underline whitespace-nowrap ml-3">
            Resolver →
          </Link>
        </div>
      )}
    </Card>
  );
}

// ─── Painel IXCSoft ────────────────────────────────────────────────────────────
function IxcPanel() {
  const [ixc, setIxc]         = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ixcApi({ action: "dashboard" })
      .then((res) => { if (res?.data?.success) setIxc(res.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Card className="p-5 mb-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando dados do IXCSoft...
      </div>
    </Card>
  );
  if (!ixc) return null;

  return (
    <Card className="p-5 mb-6">
      <h3 className="font-bold text-base mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" /> IXCSoft — Dados em Tempo Real
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Clientes Ativos"    value={ixc.clientes_ativos?.toLocaleString("pt-BR")     ?? "—"} icon={Users}        color="primary"  />
        <StatCard title="Contratos Ativos"   value={ixc.contratos_ativos?.toLocaleString("pt-BR")    ?? "—"} icon={FileText}     color="accent"   />
        <StatCard title="Títulos em Aberto"  value={ixc.titulos_abertos?.toLocaleString("pt-BR")     ?? "—"} icon={DollarSign}   color="warning"  />
        <StatCard title="Valor Vencido"      value={fmtBRL(ixc.valor_vencido)}                               icon={TrendingDown}  color="danger"   />
        <StatCard title="Inadimplentes"      value={ixc.inadimplentes?.toLocaleString("pt-BR")       ?? "—"} icon={AlertCircle}  color="danger"   />
        <StatCard title="Taxa Inadimplência" value={`${ixc.taxa_inadimplencia ?? "—"}%`}                     icon={TrendingDown}  color="warning"  />
        <StatCard title="OS Abertas"         value={ixc.os_abertas?.toLocaleString("pt-BR")          ?? "—"} icon={Wrench}        color="indigo"   />
        <StatCard title="Novos Clientes/Mês" value={ixc.novos_clientes_mes?.toLocaleString("pt-BR")  ?? "—"} icon={Users}         color="accent"   />
      </div>
      {ixc.clientes_offline === null && (
        <p className="text-xs text-muted-foreground mt-3 italic">
          * Clientes offline dependem de integração OLT/RADIUS — pendente.
        </p>
      )}
    </Card>
  );
}


// ─── Hook: carrega conversas do período e retorna métricas calculadas ──────────
function useInboxMetrics(period) {
  const [conversations, setConversations] = useState([]);
  const [leads, setLeads]                 = useState([]);
  const [loading, setLoading]             = useState(true);
  const [lastUpdated, setLastUpdated]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Busca mais conversas para ter dados históricos suficientes
      const [convData, leadData] = await Promise.all([
        base44.entities.Conversation.list("-last_message_time", 500),
        base44.entities.Lead.list("-created_date", 200),
      ]);
      setConversations(convData || []);
      setLeads(leadData || []);
      setLastUpdated(new Date());
    } catch {
      setConversations([]);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filtra pelo período selecionado ──────────────────────────────────────────
  const filtered = useMemo(() => {
    const days = PERIOD_DAYS[period] ?? 30;
    if (days === 0) {
      // Hoje: mesmo dia
      const todayStr = new Date().toISOString().slice(0, 10);
      return conversations.filter((c) => (c.last_message_time || c.created_date || "").slice(0, 10) === todayStr);
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return conversations.filter((c) => {
      const t = c.last_message_time || c.created_date;
      return t && new Date(t) >= cutoff;
    });
  }, [conversations, period]);

  const filteredLeads = useMemo(() => {
    const days = PERIOD_DAYS[period] ?? 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (days === 0 ? 1 : days));
    return leads.filter((l) => {
      const t = l.created_date;
      return t && new Date(t) >= cutoff;
    });
  }, [leads, period]);

  // ── Stats principais ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const open       = filtered.filter((c) => ["novo", "aguardando_atendimento", "aguardando_setor"].includes(c.status)).length;
    const inProgress = filtered.filter((c) => c.status === "em_atendimento").length;
    const resolved   = filtered.filter((c) => ["resolvido", "finalizado"].includes(c.status)).length;
    const leadsActive = filteredLeads.filter((l) => !["venda_fechada", "venda_perdida"].includes(l.stage)).length;
    const unread     = conversations.filter((c) => c.unread).length;

    return { open, inProgress, resolved, leadsActive, unread, total: filtered.length };
  }, [filtered, filteredLeads, conversations]);

  // ── Gráfico: atendimentos por dia (últimos 7 dias usando conversations) ───────
  const trendData = useMemo(() => {
    const weekDays = buildWeekDays();
    const byDate = {};
    conversations.forEach((c) => {
      const date = (c.last_message_time || c.created_date || "").slice(0, 10);
      if (!byDate[date]) byDate[date] = { atendimentos: 0, resolvidos: 0 };
      byDate[date].atendimentos++;
      if (["resolvido", "finalizado"].includes(c.status)) byDate[date].resolvidos++;
    });
    return weekDays.map((d) => ({
      day: d.label,
      atendimentos: byDate[d.date]?.atendimentos || 0,
      resolvidos:   byDate[d.date]?.resolvidos   || 0,
    }));
  }, [conversations]);

  // ── Gráfico: por canal ────────────────────────────────────────────────────────
  const channelData = useMemo(() => {
    const counts = {};
    filtered.forEach((c) => {
      const ch = c.channel || "whatsapp";
      counts[ch] = (counts[ch] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([channel, total]) => ({ channel: CHANNEL_LABELS[channel] || channel, total, color: CHANNEL_COLORS[channel] || "#94a3b8" }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [filtered]);

  // ── Gráfico: por setor ────────────────────────────────────────────────────────
  const sectorData = useMemo(() => {
    const counts = {};
    filtered.forEach((c) => {
      const s = c.sector || "Atendimento";
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value], i) => ({ name, value, color: SECTOR_COLORS_CHART[i % SECTOR_COLORS_CHART.length] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filtered]);

  // ── Ranking de atendentes ─────────────────────────────────────────────────────
  const attendantRanking = useMemo(() => {
    const map = {};
    filtered.forEach((c) => {
      const name = c.attendant_name;
      if (!name) return;
      if (!map[name]) map[name] = { name, atendimentos: 0, scores: [] };
      map[name].atendimentos++;
      if (c.satisfaction_score) map[name].scores.push(Number(c.satisfaction_score));
    });
    return Object.values(map)
      .map((a) => ({
        ...a,
        satisfaction: a.scores.length
          ? (a.scores.reduce((s, v) => s + v, 0) / a.scores.length).toFixed(1)
          : null,
      }))
      .sort((a, b) => b.atendimentos - a.atendimentos)
      .slice(0, 5);
  }, [filtered]);

  // ── SLA ───────────────────────────────────────────────────────────────────────
  const sla = useMemo(() => {
    const withResponse = filtered.filter((c) => c.first_response_at && c.created_date);
    const SLA_LIMIT_SEC = 15 * 60; // 15 minutos
    let cumpridos = 0, avgFirstResponse = 0, avgResolution = 0;

    withResponse.forEach((c) => {
      const diff = (+new Date(c.first_response_at) - +new Date(c.created_date)) / 1000;
      if (diff <= SLA_LIMIT_SEC) cumpridos++;
      avgFirstResponse += diff;
    });

    const resolved = filtered.filter((c) => c.resolved_at && c.created_date);
    resolved.forEach((c) => {
      avgResolution += (+new Date(c.resolved_at) - +new Date(c.created_date)) / 1000;
    });

    const slaPct = withResponse.length ? Math.round((cumpridos / withResponse.length) * 100) : null;
    const avgFirst = withResponse.length ? avgFirstResponse / withResponse.length : null;
    const avgRes   = resolved.length ? avgResolution / resolved.length : null;

    return { slaPct, avgFirst, avgRes };
  }, [filtered]);

  // ── NPS mensal (últimos 6 meses) ──────────────────────────────────────────────
  const npsData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({
        month: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        key:   d.toISOString().slice(0, 7),
      });
    }
    return months.map(({ month, key }) => {
      const monthConvs = conversations.filter(
        (c) => (c.last_message_time || c.created_date || "").slice(0, 7) === key && c.satisfaction_score
      );
      const avg = monthConvs.length
        ? monthConvs.reduce((s, c) => s + Number(c.satisfaction_score), 0) / monthConvs.length
        : null;
      return { month, nps: avg !== null ? Math.round(avg * 20) : null }; // escala 1-5 → 0-100
    });
  }, [conversations]);

  return {
    loading, load, lastUpdated,
    stats, trendData, channelData, sectorData,
    attendantRanking, sla, npsData,
    conversations, filtered,
  };
}


// ─── Dashboard principal ───────────────────────────────────────────────────────
export default function Dashboard() {
  const [period, setPeriod] = useState("Este mês");

  const {
    loading, load, lastUpdated,
    stats, trendData, channelData, sectorData,
    attendantRanking, sla, npsData,
  } = useInboxMetrics(period);

  return (
    <PageContainer>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Visão Geral</h2>
          <p className="text-sm text-muted-foreground">
            Indicadores em tempo real
            {lastUpdated && (
              <span className="ml-2 text-xs text-muted-foreground/60">
                · Atualizado {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-10 px-4 rounded-lg border border-border bg-card text-sm font-medium focus:outline-none focus:border-primary"
          >
            {PERIODS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <button
            onClick={load}
            disabled={loading}
            title="Atualizar dados"
            className="h-10 w-10 flex items-center justify-center border border-border rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Painéis IXC e Acordos (já buscam seus próprios dados) ─────────────── */}
      <AgreementPanel />
      <IxcPanel />
      <FinancialPanel />

      {/* ── Stats do Inbox ────────────────────────────────────────────────────── */}
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Atendimento — {period}</h3>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Abertos / Na Fila"    value={stats.open}        icon={Inbox}        color="primary" />
        <StatCard title="Em Atendimento"        value={stats.inProgress}  icon={MessageSquare}color="indigo"  />
        <StatCard title="Finalizados"           value={stats.resolved}    icon={CheckCircle}  color="accent"  />
        <StatCard title="Leads Ativos"          value={stats.leadsActive} icon={TrendingUp}   color="purple"  />
        <StatCard title="Total no Período"      value={stats.total}       icon={Inbox}        color="primary" />
        <StatCard title="Não Lidos Agora"       value={stats.unread}      icon={AlertCircle}  color="warning" />
        <StatCard title="SLA Cumprido"          value={sla.slaPct !== null ? `${sla.slaPct}%` : "—"} icon={CheckCircle} color="accent"  />
        <StatCard title="1ª Resposta Média"     value={fmtSeconds(sla.avgFirst)} icon={Clock} color="indigo"  />
      </div>

      {/* ── Gráficos principais ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Tendência 7 dias */}
        <Card className="lg:col-span-2 p-5">
          <h3 className="font-semibold text-sm mb-4">Atendimentos — Últimos 7 dias</h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : trendData.every((d) => d.atendimentos === 0) ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
              Nenhuma conversa nos últimos 7 dias
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="colorRes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="atendimentos" stroke="#3b82f6" strokeWidth={2} fill="url(#colorAtt)" name="Conversas" />
                <Area type="monotone" dataKey="resolvidos"   stroke="#22c55e" strokeWidth={2} fill="url(#colorRes)" name="Resolvidas" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Por setor */}
        <Card className="p-5">
          <h3 className="font-semibold text-sm mb-4">Atendimentos por Setor</h3>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : sectorData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
              Sem dados no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={sectorData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={48}>
                  {sectorData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8 }} formatter={(v) => [v, "conversas"]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Por canal */}
        <Card className="p-5">
          <h3 className="font-semibold text-sm mb-4">Conversas por Canal</h3>
          {loading ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : channelData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
              Sem dados no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={channelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis dataKey="channel" type="category" tick={{ fontSize: 11 }} width={72} />
                <Tooltip contentStyle={{ borderRadius: 8 }} formatter={(v) => [v, "conversas"]} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {channelData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* NPS mensal */}
        <Card className="p-5">
          <h3 className="font-semibold text-sm mb-4">
            Satisfação (NPS Estimado) — Últimos 6 meses
            <span className="ml-1 text-xs font-normal text-muted-foreground">(baseado em notas das conversas)</span>
          </h3>
          {loading ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : npsData.every((d) => d.nps === null) ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
              Nenhuma nota de satisfação registrada ainda
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={npsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8 }} formatter={(v) => [`${v}`, "NPS"]} />
                <Line
                  type="monotone" dataKey="nps" stroke="#a855f7" strokeWidth={3}
                  dot={{ r: 5 }} connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Ranking atendentes */}
        <Card className="p-5">
          <h3 className="font-semibold text-sm mb-4">Ranking de Atendentes</h3>
          {loading ? (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : attendantRanking.length === 0 ? (
            <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground text-center px-4">
              Nenhuma conversa com atendente atribuído no período
            </div>
          ) : (
            <div className="space-y-3">
              {attendantRanking.map((att, i) => (
                <div key={att.name} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                    i === 0 ? "bg-amber-100 text-amber-700"
                    : i === 1 ? "bg-gray-200 text-gray-700"
                    : i === 2 ? "bg-orange-100 text-orange-700"
                    : "bg-muted text-muted-foreground"
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{att.name}</p>
                    <p className="text-xs text-muted-foreground">{att.atendimentos} atendimento{att.atendimentos !== 1 ? "s" : ""}</p>
                  </div>
                  {att.satisfaction !== null && (
                    <div className="flex items-center gap-1 text-sm flex-shrink-0">
                      <Star className="w-4 h-4 text-amber-400" fill="currentColor" />
                      <span className="font-semibold">{att.satisfaction}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Tempos e SLA ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold text-sm mb-4">Tempos Médios de Atendimento</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-muted/40 rounded-xl">
              <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{loading ? "…" : fmtSeconds(sla.avgFirst)}</p>
              <p className="text-xs text-muted-foreground mt-1">1ª resposta</p>
            </div>
            <div className="text-center p-4 bg-muted/40 rounded-xl">
              <CheckCircle className="w-6 h-6 text-accent mx-auto mb-2" />
              <p className="text-2xl font-bold">{loading ? "…" : fmtSeconds(sla.avgRes)}</p>
              <p className="text-xs text-muted-foreground mt-1">Resolução média</p>
            </div>
          </div>
          {sla.avgFirst === null && !loading && (
            <p className="text-xs text-muted-foreground mt-3 text-center italic">
              Tempo médio calculado quando <code className="bg-muted px-1 rounded">first_response_at</code> for preenchido
            </p>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-sm mb-4">SLA de Atendimento</h3>
          {loading ? (
            <div className="flex items-center justify-center h-20 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : sla.slaPct === null ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              SLA calculado quando <code className="bg-muted px-1 rounded">first_response_at</code> for preenchido
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: "SLA cumprido (≤ 15 min)", pct: sla.slaPct, color: "bg-green-500", textColor: "text-green-600" },
                { label: "SLA vencido (> 15 min)",  pct: 100 - sla.slaPct, color: "bg-red-500",   textColor: "text-red-600"   },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{item.label}</span>
                    <span className={`font-semibold ${item.textColor}`}>{item.pct}%</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-700`}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
