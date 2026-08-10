import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { PageContainer, StatCard, Card } from "@/components/ui/app-card";
import { collectionsApi } from "@/functions/collectionsApi";
import { useToast } from "@/components/ui/use-toast";
import { exportToCsv } from "@/lib/exportCsv";
import {
  DollarSign, AlertTriangle, Handshake, CalendarClock,
  Search, RefreshCw, Download, Loader2, Eye,
  CheckCircle, Clock, PhoneCall, XCircle, TrendingDown,
} from "lucide-react";

const STATUS_CONFIG = {
  aberto:              { label: "Aberto",             color: "bg-gray-100 text-gray-600",     icon: Clock },
  em_contato:          { label: "Em Contato",         color: "bg-blue-100 text-blue-700",     icon: PhoneCall },
  promessa_pagamento:  { label: "Promessa de Pgto.",  color: "bg-amber-100 text-amber-700",   icon: CalendarClock },
  negociando:          { label: "Negociando",         color: "bg-purple-100 text-purple-700", icon: Handshake },
  pago:                { label: "Pago",               color: "bg-green-100 text-green-700",   icon: CheckCircle },
  perdido:             { label: "Perdido",            color: "bg-red-100 text-red-700",       icon: XCircle },
};

const fmtBRL  = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export default function CollectionsCenter() {
  const [cases, setCases]         = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, dashRes] = await Promise.all([
        collectionsApi({ action: "list_cases" }),
        collectionsApi({ action: "dashboard" }),
      ]);
      setCases(listRes?.data?.data || []);
      setDashboard(dashRes?.data?.data || null);
    } catch {
      toast({ title: "Erro ao carregar central de cobrança", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await collectionsApi({ action: "sync_from_ixc" });
      if (res?.data?.success) {
        const { created, updated } = res.data.data;
        toast({ title: `Sincronizado: ${created} novo(s), ${updated} atualizado(s)` });
        load();
      } else {
        toast({ title: res?.data?.error?.message || "Falha ao sincronizar", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao sincronizar com o IXC", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const filtered = cases.filter((c) => {
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      c.customer_name?.toLowerCase().includes(q) ||
      c.customer_phone?.includes(search) ||
      c.customer_cpf_cnpj?.includes(search);
    return matchStatus && matchSearch;
  });

  const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.aberto;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
        <Icon className="w-3 h-3" /> {cfg.label}
      </span>
    );
  };

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">Central de Cobrança</h1>
          <p className="text-sm text-muted-foreground mt-1">Casos de cobrança, tentativas e follow-ups</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
            Sincronizar com IXC
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Em Aberto" value={fmtBRL(dashboard?.total_open_amount)} subtitle={`${dashboard?.open ?? "—"} casos`} icon={DollarSign} color="warning" />
        <StatCard title="Vencido" value={fmtBRL(dashboard?.total_overdue_amount)} icon={TrendingDown} color="danger" />
        <StatCard title="Promessas de Pagamento" value={dashboard?.promises ?? "—"} icon={CalendarClock} color="purple" />
        <StatCard title="Follow-ups Hoje" value={dashboard?.follow_ups_today ?? "—"} icon={AlertTriangle} color="primary" />
      </div>

      <Card className="mb-4">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, telefone, CPF/CNPJ..."
              className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button
            onClick={() => exportToCsv("central-cobranca.csv", filtered.map((c) => ({
              cliente: c.customer_name, telefone: c.customer_phone, valor: c.current_amount,
              vencimento: c.due_date, dias_atraso: c.days_late, status: STATUS_CONFIG[c.status]?.label || c.status,
              proxima_acao: c.next_action_date, tentativas: c.attempts_count,
            })))}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <DollarSign className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">Nenhum caso de cobrança encontrado</p>
            <p className="text-xs mt-1">Clique em "Sincronizar com IXC" para importar faturas vencidas</p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Telefone</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Valor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Dias Atraso</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tentativas</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Próxima Ação</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{c.customer_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.customer_phone || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{fmtBRL(c.current_amount)}</td>
                    <td className="px-4 py-3">{c.days_late > 0 ? <span className="text-red-600 font-medium">{c.days_late} dias</span> : "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{c.attempts_count || 0}</td>
                    <td className="px-4 py-3">{fmtDate(c.next_action_date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <Link
                          to={`/central-cobranca/${c.id}`}
                          className="p-2 rounded-lg text-muted-foreground hover:bg-accent transition-colors"
                          title="Ver histórico"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
