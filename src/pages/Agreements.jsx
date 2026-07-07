import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { PageContainer, StatCard, Card } from "@/components/ui/app-card";
import { agreementApi } from "@/functions/agreementApi";
import { useToast } from "@/components/ui/use-toast";
import {
  FileText, AlertTriangle, CheckCircle, Clock, XCircle,
  Search, Filter, RefreshCw, Plus, Eye, Loader2,
  DollarSign, TrendingDown, Shield, PenLine
} from "lucide-react";

const STATUS_CONFIG = {
  active:            { label: "Ativo",              color: "bg-green-100 text-green-700",   icon: CheckCircle },
  overdue:           { label: "Vencido",             color: "bg-amber-100 text-amber-700",   icon: Clock },
  broken:            { label: "Quebrado",            color: "bg-red-100 text-red-700",       icon: XCircle },
  paid:              { label: "Quitado",             color: "bg-blue-100 text-blue-700",     icon: CheckCircle },
  pending_signature: { label: "Aguard. Assinatura",  color: "bg-purple-100 text-purple-700", icon: PenLine },
  none:              { label: "Sem acordo",           color: "bg-gray-100 text-gray-600",     icon: FileText },
};

const fmtBRL  = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export default function Agreements() {
  const [agreements, setAgreements] = useState([]);
  const [dashboard, setDashboard]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, dashRes] = await Promise.all([
        agreementApi({ action: "list_agreements" }),
        agreementApi({ action: "dashboard" }),
      ]);
      setAgreements(listRes?.data?.data || []);
      setDashboard(dashRes?.data?.data || null);
    } catch {
      toast({ title: "Erro ao carregar acordos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = agreements.filter((a) => {
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      a.customer_name?.toLowerCase().includes(q) ||
      a.customer_phone?.includes(search) ||
      a.customer_cpf_cnpj?.includes(search) ||
      a.customer_city?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.none;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
        <Icon className="w-3 h-3" /> {cfg.label}
      </span>
    );
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Verificação de Acordo</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie acordos, renegociações e parcelamentos</p>
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
          <Link
            to="/agreements/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo Acordo
          </Link>
        </div>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Acordos Ativos"
          value={dashboard?.active ?? "—"}
          icon={<CheckCircle className="w-5 h-5 text-green-500" />}
          color="green"
        />
        <StatCard
          title="Vencidos"
          value={dashboard?.overdue ?? "—"}
          icon={<Clock className="w-5 h-5 text-amber-500" />}
          color="amber"
        />
        <StatCard
          title="Quebrados"
          value={dashboard?.broken ?? "—"}
          icon={<XCircle className="w-5 h-5 text-red-500" />}
          color="red"
        />
        <StatCard
          title="Quitados"
          value={dashboard?.paid ?? "—"}
          icon={<Shield className="w-5 h-5 text-blue-500" />}
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Total Negociado"
          value={fmtBRL(dashboard?.total_negotiated)}
          icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
        />
        <StatCard
          title="Em Atraso"
          value={fmtBRL(dashboard?.total_overdue_amount)}
          icon={<TrendingDown className="w-5 h-5 text-red-500" />}
          color="red"
        />
        <StatCard
          title="Valor Recuperado"
          value={fmtBRL(dashboard?.total_recovered)}
          icon={<CheckCircle className="w-5 h-5 text-blue-500" />}
          color="blue"
        />
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, telefone, CPF/CNPJ, cidade..."
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
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileText className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">Nenhum acordo encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Valor Original</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Valor Negociado</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Restante</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Parcelas</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Próx. Venc.</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{a.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{a.customer_phone || a.customer_cpf_cnpj || "—"}</p>
                      {a.customer_city && <p className="text-xs text-muted-foreground">{a.customer_city}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{fmtBRL(a.original_amount)}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{fmtBRL(a.negotiated_amount)}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={a.remaining_amount > 0 ? "text-red-600 font-semibold" : "text-green-600"}>
                        {fmtBRL(a.remaining_amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {a.paid_installments}/{a.installments}
                      {a.overdue_installments > 0 && (
                        <span className="ml-1 text-red-500 text-xs">({a.overdue_installments} atras.)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {fmtDate(a.next_due_date)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        to={`/agreements/${a.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> Detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t text-xs text-muted-foreground">
              {filtered.length} acordo(s) exibido(s) de {agreements.length} total
            </div>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
