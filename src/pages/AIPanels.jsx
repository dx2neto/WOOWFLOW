import React, { useState, useMemo } from "react";
import { PageContainer, Card } from "@/components/ui/app-card";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Zap, ShoppingBag, Bot, AlertTriangle, RefreshCw, Search, User, Phone, Clock, CheckCircle2, XCircle, HeartCrack } from "lucide-react";
import SpecialistDataView from "@/components/ai/SpecialistDataView";

const SPECIALISTS = [
  { key: "finance",   label: "Financeiro",     icon: TrendingUp,   color: "green",   headerBg: "from-green-500 to-emerald-600" },
  { key: "tech",      label: "Suporte Técnico", icon: Zap,          color: "purple",  headerBg: "from-purple-500 to-violet-600" },
  { key: "sales",     label: "Vendas",         icon: ShoppingBag,  color: "orange",  headerBg: "from-orange-500 to-amber-600" },
  { key: "retention", label: "Retenção",       icon: HeartCrack,   color: "red",     headerBg: "from-rose-500 to-red-600" },
  { key: "general",   label: "Geral",           icon: Bot,          color: "blue",    headerBg: "from-blue-500 to-indigo-600" },
];

const SENTIMENT_COLORS = {
  positivo: "bg-green-100 text-green-700",
  neutro: "bg-slate-100 text-slate-700",
  irritado: "bg-amber-100 text-amber-700",
  muito_irritado: "bg-red-100 text-red-700",
};

const URGENCY_COLORS = {
  baixa: "bg-slate-100 text-slate-600",
  media: "bg-blue-100 text-blue-700",
  alta: "bg-orange-100 text-orange-700",
  urgente: "bg-red-100 text-red-700",
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function InteractionCard({ interaction }) {
  const [expanded, setExpanded] = useState(false);
  const actionsTaken = (() => { try { return JSON.parse(interaction.actions_taken || "[]"); } catch { return []; } })();
  const actionsAvailable = (() => { try { return JSON.parse(interaction.actions_available || "[]"); } catch { return []; } })();

  return (
    <div className="border border-border rounded-lg p-3 hover:shadow-sm transition-shadow bg-card">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{interaction.customer_name || interaction.phone || "Cliente não identificado"}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> {timeAgo(interaction.created_date)}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SENTIMENT_COLORS[interaction.sentiment] || SENTIMENT_COLORS.neutro}`}>
            {interaction.sentiment}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${URGENCY_COLORS[interaction.urgency] || URGENCY_COLORS.media}`}>
            {interaction.urgency}
          </span>
        </div>
      </div>

      <div className="bg-muted/50 rounded-md p-2 mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Cliente</p>
        <p className="text-sm">{interaction.message}</p>
      </div>

      <div className="bg-primary/5 rounded-md p-2 mb-2 border-l-2 border-primary">
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">IA</p>
        <p className="text-sm">{interaction.reply}</p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${interaction.routing_method === "keyword" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
            {interaction.routing_method === "keyword" ? "Palavra-chave" : "LLM"}
          </span>
          {interaction.specialist_data_fetched && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Dados IXC</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {interaction.needs_human ? (
            <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
              <AlertTriangle className="w-3 h-3" /> Humano
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Resolvido
            </span>
          )}
        </div>
      </div>

      {(actionsTaken.length > 0 || actionsAvailable.length > 0 || interaction.protocol) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-primary hover:underline"
        >
          {expanded ? "Ocultar detalhes" : "Ver detalhes"}
        </button>
      )}

      {expanded && (
        <div className="mt-2 pt-2 border-t border-border space-y-2">
          {interaction.intent && (
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Intenção</p>
              <p className="text-sm">{interaction.intent}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Confiança</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${(interaction.confidence || 0) >= 0.8 ? "bg-green-500" : (interaction.confidence || 0) >= 0.6 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${Math.round((interaction.confidence || 0) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium">{Math.round((interaction.confidence || 0) * 100)}%</span>
            </div>
          </div>
          {actionsTaken.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Ações executadas</p>
              {actionsTaken.map((a, i) => <p key={i} className="text-xs text-muted-foreground">• {a}</p>)}
            </div>
          )}
          {actionsAvailable.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Ações disponíveis</p>
              {actionsAvailable.map((a, i) => <p key={i} className="text-xs text-muted-foreground">• {a}</p>)}
            </div>
          )}
          {interaction.protocol && (
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Protocolo</p>
              <p className="text-xs font-mono">{interaction.protocol}</p>
            </div>
          )}
          {interaction.human_reason && (
            <div className="p-2 rounded-lg bg-red-50 text-red-700 text-xs">
              <p className="font-semibold">Motivo do escalonamento</p>
              <p>{interaction.human_reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpecialistPanel({ specialist, interactions, isLoading }) {
  const Icon = specialist.icon;
  const stats = useMemo(() => {
    const total = interactions.length;
    const resolved = interactions.filter(i => !i.needs_human).length;
    const escalated = interactions.filter(i => i.needs_human).length;
    const avgConfidence = total > 0 ? (interactions.reduce((s, i) => s + (i.confidence || 0), 0) / total) : 0;
    const withData = interactions.filter(i => i.specialist_data_fetched).length;
    return { total, resolved, escalated, avgConfidence, withData };
  }, [interactions]);

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className={`px-4 py-3 bg-gradient-to-r ${specialist.headerBg} text-white`}>
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" />
          <h3 className="font-semibold font-heading">{specialist.label}</h3>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs">
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {stats.resolved} resolvidos</span>
          <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {stats.escalated} escalados</span>
          <span>{stats.total} total</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-border">
        <div className="bg-card p-2 text-center">
          <p className="text-xs text-muted-foreground">Confiança média</p>
          <p className="text-sm font-bold">{Math.round(stats.avgConfidence * 100)}%</p>
        </div>
        <div className="bg-card p-2 text-center">
          <p className="text-xs text-muted-foreground">Com dados IXC</p>
          <p className="text-sm font-bold">{stats.withData}</p>
        </div>
        <div className="bg-card p-2 text-center">
          <p className="text-xs text-muted-foreground">Taxa resolução</p>
          <p className="text-sm font-bold">{stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0}%</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3 min-h-[400px]">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
        ) : interactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Icon className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Nenhuma interação ainda
          </div>
        ) : (
          interactions.map((i) => <InteractionCard key={i.id} interaction={i} />)
        )}
      </div>
    </Card>
  );
}

export default function AIPanels() {
  const [search, setSearch] = useState("");

  const { data: allInteractions = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["AIInteraction", "panels"],
    queryFn: () => base44.entities.AIInteraction.list("-created_date", 150),
    refetchInterval: 15_000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return allInteractions;
    const q = search.toLowerCase();
    return allInteractions.filter(i =>
      (i.message || "").toLowerCase().includes(q) ||
      (i.reply || "").toLowerCase().includes(q) ||
      (i.customer_name || "").toLowerCase().includes(q) ||
      (i.phone || "").includes(q) ||
      (i.intent || "").toLowerCase().includes(q)
    );
  }, [allInteractions, search]);

  const bySpecialist = useMemo(() => {
    const map = {};
    for (const s of SPECIALISTS) {
      map[s.key] = filtered.filter(i => i.specialist === s.key);
    }
    return map;
  }, [filtered]);

  const totals = useMemo(() => ({
    total: filtered.length,
    resolved: filtered.filter(i => !i.needs_human).length,
    escalated: filtered.filter(i => i.needs_human).length,
  }), [filtered]);

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Painéis de Especialistas IA</h2>
          <p className="text-sm text-muted-foreground">
            {totals.total} interações · {totals.resolved} resolvidas · {totals.escalated} escalonadas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar interações..."
              className="w-56 h-10 pl-9 pr-4 bg-muted/60 rounded-lg text-sm focus:outline-none focus:bg-card focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2.5 border border-border rounded-lg text-sm hover:bg-muted disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {SPECIALISTS.map((s) => (
          <SpecialistPanel
            key={s.key}
            specialist={s}
            interactions={bySpecialist[s.key] || []}
            isLoading={isLoading}
          />
        ))}
      </div>
    </PageContainer>
  );
}