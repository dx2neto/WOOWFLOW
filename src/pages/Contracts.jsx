import React, { useState, useEffect } from "react";
import { PageContainer, StatCard, Card } from "@/components/ui/app-card";
import { ixcApi } from "@/functions/ixcApi";
import { Search, Filter, FileText, CheckCircle, XCircle, Download } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";

const STATUS_MAP = {
  ativo:     { label: "Ativo",     color: "bg-green-100 text-green-700" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700" },
  A:         { label: "Ativo",     color: "bg-green-100 text-green-700" },
  CA:        { label: "Cancelado", color: "bg-red-100 text-red-700" },
};

const INTERNET_MAP = {
  A: { label: "Online",   color: "bg-blue-100 text-blue-700" },
  S: { label: "Suspenso", color: "bg-amber-100 text-amber-700" },
  I: { label: "Inativo",  color: "bg-gray-100 text-gray-700" },
};

export default function Contracts() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState("all");

  useEffect(() => {
    const t = setTimeout(() => loadContracts(), 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadContracts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ixcApi({ action: "contratos" });
      if (res?.data?.error) { setError(res.data.error); setContracts([]); return; }
      setContracts(res?.data?.result?.registros || []);
    } catch {
      setError("Não foi possível carregar os contratos do IXC Provedor.");
      setContracts([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = contracts.filter((c) => {
    const matchFilter = filter === "all" || c.status === filter || (filter === "ativo" && c.status === "A") || (filter === "cancelado" && c.status === "CA");
    const q = search.toLowerCase();
    const matchSearch = !q || c.customer_name?.toLowerCase().includes(q) || c.plan_name?.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const ativos     = contracts.filter((c) => c.status === "A" || c.status === "ativo");
  const cancelados = contracts.filter((c) => c.status === "CA" || c.status === "cancelado");

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Contratos</h2>
          <p className="text-sm text-muted-foreground">{contracts.length} contratos carregados</p>
        </div>
        <button
          onClick={() => exportToCsv("contratos.csv", filtered.map((c) => ({
            id: c.id, cliente: c.customer_name, plano: c.plan_name, cidade: c.city,
            status: c.status, internet: c.internet_status, ativacao: c.renewal_date,
          })))}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Download className="w-4 h-4" /> Exportar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total de Contratos" value={contracts.length} icon={FileText} color="primary" />
        <StatCard title="Ativos"             value={ativos.length}    icon={CheckCircle} color="accent" />
        <StatCard title="Cancelados"         value={cancelados.length} icon={XCircle}   color="danger" />
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, plano ou cidade..."
              className="w-full h-10 pl-9 pr-4 bg-muted/60 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex gap-1.5">
            {[["all", "Todos"], ["ativo", "Ativos"], ["cancelado", "Cancelados"]].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
            <Filter className="w-4 h-4" /> Filtros
          </button>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-semibold px-4 py-3">ID</th>
                <th className="text-left font-semibold px-4 py-3">Cliente</th>
                <th className="text-left font-semibold px-4 py-3">Plano</th>
                <th className="text-left font-semibold px-4 py-3">Cidade</th>
                <th className="text-left font-semibold px-4 py-3">Vendedor</th>
                <th className="text-left font-semibold px-4 py-3">Internet</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-left font-semibold px-4 py-3">Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Carregando contratos...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum contrato encontrado</td></tr>
              ) : (
                filtered.map((c) => {
                  const st = STATUS_MAP[c.status] || { label: c.status || "—", color: "bg-muted text-muted-foreground" };
                  const inet = INTERNET_MAP[c.internet_status] || null;
                  return (
                    <tr key={c.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground text-xs">#{c.id}</td>
                      <td className="px-4 py-3 font-medium">{c.customer_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.plan_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.city || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.phone || "—"}</td>
                      <td className="px-4 py-3">
                        {inet && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${inet.color}`}>{inet.label}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.renewal_date ? new Date(c.renewal_date).toLocaleDateString("pt-BR") : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}
