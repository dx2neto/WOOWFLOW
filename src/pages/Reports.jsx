import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, Card, StatCard } from "@/components/ui/app-card";
import { Download, TrendingUp, Clock, Star, Trophy, FileBarChart, Loader2, RefreshCw, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, Legend, ComposedChart } from "recharts";
import { exportToCsv } from "@/lib/exportCsv";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PERIOD_DAYS = {
  "Hoje": 0, "Ontem": 1, "Esta semana": 7, "Este mês": 30, "Últimos 90 dias": 90,
};

function getDateCutoff(period) {
  const days = PERIOD_DAYS[period] ?? 30;
  if (days === 0) {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }
  const d = new Date(); d.setDate(d.getDate() - days); return d;
}


// ─── Hook de dados ────────────────────────────────────────────────────────────
function useReportsData(period) {
  const [conversations, setConversations] = useState([]);
  const [leads, setLeads]                 = useState([]);
  const [loading, setLoading]             = useState(true);
  const [lastUpdated, setLastUpdated]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [convData, leadData] = await Promise.all([
        base44.entities.Conversation.list("-last_message_time", 500),
        base44.entities.Lead.list("-created_date", 300),
      ]);
      setConversations(convData || []);
      setLeads(leadData || []);
      setLastUpdated(new Date());
    } catch {
      setConversations([]); setLeads([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cutoff = useMemo(() => getDateCutoff(period), [period]);

  const filtered = useMemo(() =>
    conversations.filter((c) => {
      const t = c.last_message_time || c.created_date;
      return t && new Date(t) >= cutoff;
    }), [conversations, cutoff]);

  const filteredLeads = useMemo(() =>
    leads.filter((l) => {
      const t = l.created_date;
      return t && new Date(t) >= cutoff;
    }), [leads, cutoff]);

  // ── Ranking de atendentes ────────────────────────────────────────────────
  const attendantData = useMemo(() => {
    const map = {};
    filtered.forEach((c) => {
      const name = c.attendant_name;
      if (!name) return;
      if (!map[name]) map[name] = { name, atendimentos: 0, resolvidos: 0, scores: [], firstRespSecs: [] };
      map[name].atendimentos++;
      if (["resolvido","finalizado"].includes(c.status)) map[name].resolvidos++;
      if (c.satisfaction_score) map[name].scores.push(Number(c.satisfaction_score));
      if (c.first_response_at && c.created_date) {
        map[name].firstRespSecs.push((+new Date(c.first_response_at) - +new Date(c.created_date)) / 1000);
      }
    });
    return Object.values(map)
      .map((a) => ({
        name: a.name,
        atendimentos: a.atendimentos,
        resolucao: a.atendimentos ? Math.round((a.resolvidos / a.atendimentos) * 100) : 0,
        satisfaction: a.scores.length ? +(a.scores.reduce((s, v) => s + v, 0) / a.scores.length).toFixed(1) : null,
        tempoMedio: a.firstRespSecs.length ? +(a.firstRespSecs.reduce((s, v) => s + v, 0) / a.firstRespSecs.length / 60).toFixed(1) : null,
        protocolos: a.resolvidos,
      }))
      .sort((a, b) => b.atendimentos - a.atendimentos)
      .slice(0, 10);
  }, [filtered]);

  // ── Conversão de leads por mês ────────────────────────────────────────────
  const conversionData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      months.push({ month: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), key: d.toISOString().slice(0, 7) });
    }
    return months.map(({ month, key }) => {
      const monthLeads = leads.filter((l) => (l.created_date || "").slice(0, 7) === key);
      return {
        month,
        leads: monthLeads.length,
        vendas: monthLeads.filter((l) => l.stage === "venda_fechada").length,
      };
    });
  }, [leads]);

  // ── Desempenho do suporte (por atendente) ─────────────────────────────────
  const supportPerformanceData = useMemo(() =>
    attendantData.filter((a) => a.tempoMedio !== null).slice(0, 5),
  [attendantData]);

  // ── Por cidade (dos leads) ────────────────────────────────────────────────
  const cityData = useMemo(() => {
    const map = {};
    leads.forEach((l) => {
      if (!l.city) return;
      if (!map[l.city]) map[l.city] = { city: l.city, leads: 0, vendas: 0 };
      map[l.city].leads++;
      if (l.stage === "venda_fechada") map[l.city].vendas++;
    });
    return Object.values(map).sort((a, b) => b.leads - a.leads).slice(0, 8);
  }, [leads]);

  // ── Stats globais ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalLeads  = filteredLeads.length;
    const totalVendas = filteredLeads.filter((l) => l.stage === "venda_fechada").length;
    const conversion  = totalLeads > 0 ? ((totalVendas / totalLeads) * 100).toFixed(1) : null;

    const withResp = filtered.filter((c) => c.first_response_at && c.created_date);
    const avgFirst = withResp.length
      ? withResp.reduce((s, c) => s + (+new Date(c.first_response_at) - +new Date(c.created_date)) / 1000, 0) / withResp.length
      : null;

    const scores  = filtered.map((c) => Number(c.satisfaction_score)).filter(Boolean);
    const avgNps  = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 20) : null;

    const withSla = filtered.filter((c) => c.first_response_at && c.created_date);
    const cumpridos = withSla.filter((c) => (+new Date(c.first_response_at) - +new Date(c.created_date)) / 1000 <= 900).length;
    const slaPct    = withSla.length ? Math.round((cumpridos / withSla.length) * 100) : null;

    return { conversion, avgFirst, avgNps, slaPct };
  }, [filtered, filteredLeads]);

  return { loading, load, lastUpdated, filtered, filteredLeads, attendantData, conversionData, supportPerformanceData, cityData, stats };
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Reports() {
  const [period, setPeriod] = useState("Este mês");
  const { loading, load, lastUpdated, filtered, filteredLeads, attendantData, conversionData, supportPerformanceData, cityData, stats } = useReportsData(period);

  const exportAttendants = () => exportToCsv("relatorio-atendentes.csv", attendantData.map((a) => ({
    atendente: a.name, atendimentos: a.atendimentos, resolucao_pct: a.resolucao,
    satisfacao: a.satisfaction ?? "—", tempo_medio_min: a.tempoMedio ?? "—",
  })));

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Relatórios Gerenciais</h2>
          <p className="text-sm text-muted-foreground">
            Indicadores reais de atendimento, vendas e performance
            {lastUpdated && <span className="ml-2 text-xs text-muted-foreground/60">· {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value)}
            className="h-10 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:border-primary">
            {Object.keys(PERIOD_DAYS).map((p) => <option key={p}>{p}</option>)}
          </select>
          <button onClick={load} disabled={loading}
            className="h-10 w-10 flex items-center justify-center border border-border rounded-lg hover:bg-muted disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={exportAttendants}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </div>

      {/* Stats KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Taxa de Conversão"   value={stats.conversion !== null ? `${stats.conversion}%` : "—"} icon={TrendingUp} color="accent"  />
        <StatCard title="1ª Resposta Média"   value={stats.avgFirst   !== null ? (() => { const m = Math.floor(stats.avgFirst/60); const s = Math.round(stats.avgFirst%60); return `${m}m ${s}s`; })() : "—"} icon={Clock} color="primary" />
        <StatCard title="NPS Médio"           value={stats.avgNps     !== null ? String(stats.avgNps)  : "—"} icon={Star}       color="purple" />
        <StatCard title="SLA Cumprido"        value={stats.slaPct     !== null ? `${stats.slaPct}%`   : "—"} icon={Trophy}     color="indigo" />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando dados reais...
        </div>
      )}

      {!loading && (
        <>
          {/* Gráficos de conversão e cidade */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-4">Conversão de Leads por Mês</h3>
              {conversionData.every((d) => d.leads === 0) ? (
                <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                  Nenhum lead cadastrado no período
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={conversionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="leads"  fill="#3b82f6" name="Leads"  radius={[4,4,0,0]} />
                    <Bar dataKey="vendas" fill="#22c55e" name="Vendas" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-4">Leads por Cidade</h3>
              {cityData.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                  Nenhum lead com cidade cadastrada
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={cityData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                    <YAxis dataKey="city" type="category" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip contentStyle={{ borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="leads"  fill="#3b82f6" name="Leads"  radius={[0,4,4,0]} />
                    <Bar dataKey="vendas" fill="#22c55e" name="Vendas" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          {/* Ranking de atendentes */}
          <Card className="overflow-hidden mb-6">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-sm">Ranking de Atendentes — {period}</h3>
              <span className="text-xs text-muted-foreground">{filtered.length} conversa(s) no período</span>
            </div>
            {attendantData.length === 0 ? (
              <div className="p-10 text-center">
                <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum atendimento com atendente atribuído no período</p>
                <p className="text-xs text-muted-foreground mt-1">Atribua atendentes nas conversas para visualizar o ranking</p>
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left font-semibold px-4 py-3">#</th>
                      <th className="text-left font-semibold px-4 py-3">Atendente</th>
                      <th className="text-left font-semibold px-4 py-3">Atendimentos</th>
                      <th className="text-left font-semibold px-4 py-3">Taxa Resolução</th>
                      <th className="text-left font-semibold px-4 py-3">Satisfação</th>
                      <th className="text-left font-semibold px-4 py-3">Tempo Médio 1ª Resp.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendantData.map((att, i) => (
                      <tr key={att.name} className="border-b border-border hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                            i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-gray-200 text-gray-700" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"
                          }`}>{i + 1}</div>
                        </td>
                        <td className="px-4 py-3 font-medium">{att.name}</td>
                        <td className="px-4 py-3">{att.atendimentos}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: `${att.resolucao}%` }} />
                            </div>
                            <span className="text-xs font-medium">{att.resolucao}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {att.satisfaction !== null ? (
                            <span className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-amber-400" fill="currentColor" /> {att.satisfaction}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {att.tempoMedio !== null ? `${att.tempoMedio}m` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Gráfico de desempenho do suporte */}
          {supportPerformanceData.length > 0 && (
            <Card className="p-5 mb-6">
              <h3 className="font-semibold text-sm mb-4">Desempenho do Suporte — Protocolos vs Tempo Médio</h3>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={supportPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 12 }} label={{ value: "Resolvidos", angle: -90, position: "insideLeft", fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} label={{ value: "Min", angle: 90, position: "insideRight", fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="protocolos" fill="#3b82f6" name="Protocolos Resolvidos" radius={[4,4,0,0]} />
                  <Line yAxisId="right" type="monotone" dataKey="tempoMedio" stroke="#f97316" strokeWidth={2} name="Tempo Médio 1ª Resp. (min)" dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Cards de resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <FileBarChart className="w-4 h-4 text-primary" /> Exportar Relatórios
              </h3>
              <div className="space-y-2">
                <button onClick={exportAttendants}
                  className="w-full flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 text-sm font-medium">
                  <FileBarChart className="w-4 h-4 text-primary" /> Ranking Atendentes — CSV
                  <Download className="w-4 h-4 text-muted-foreground ml-auto" />
                </button>
                <button onClick={() => exportToCsv("leads.csv", filteredLeads.map((l) => ({
                  nome: l.name, telefone: l.phone, cidade: l.city, origem: l.origin,
                  estagio: l.stage, vendedor: l.vendor, data: l.created_date,
                })))}
                  className="w-full flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 text-sm font-medium">
                  <FileBarChart className="w-4 h-4 text-primary" /> Leads do Período — CSV
                  <Download className="w-4 h-4 text-muted-foreground ml-auto" />
                </button>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-4">Resumo do Período</h3>
              <div className="space-y-3 text-sm">
                {[
                  ["Conversas no período",  filtered.length],
                  ["Leads no período",      filteredLeads.length],
                  ["Vendas fechadas",       filteredLeads.filter((l) => l.stage === "venda_fechada").length],
                  ["Leads perdidos",        filteredLeads.filter((l) => l.stage === "venda_perdida").length],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold text-sm mb-4">Motivos de Perda de Leads</h3>
              {(() => {
                const map = {};
                filteredLeads.filter((l) => l.stage === "venda_perdida" && l.loss_reason).forEach((l) => { map[l.loss_reason] = (map[l.loss_reason] || 0) + 1; });
                const entries = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
                const total = entries.reduce((s, [, v]) => s + v, 0);
                if (entries.length === 0) return (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum motivo de perda registrado</p>
                );
                return (
                  <div className="space-y-2 text-sm">
                    {entries.map(([reason, count]) => (
                      <div key={reason}>
                        <div className="flex justify-between mb-1">
                          <span className="truncate">{reason}</span>
                          <span className="text-muted-foreground ml-2">{count}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 rounded-full" style={{ width: `${(count / total) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </Card>
          </div>
        </>
      )}
    </PageContainer>
  );
}
