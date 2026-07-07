import React, { useState, useEffect } from "react";
import { PageContainer, StatCard, Card } from "@/components/ui/app-card";
import { ixcApi } from "@/functions/ixcApi";
import { Search, Wifi, DollarSign, CheckCircle } from "lucide-react";

export default function Plans() {
  const [plans, setPlans]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState("");

  useEffect(() => { loadPlans(); }, []);

  const loadPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ixcApi({ action: "planos" });
      if (res?.data?.success === false) { setError(res.data.error); setPlans([]); return; }
      setPlans(res?.data?.data || []);
    } catch {
      setError("Não foi possível carregar os planos do IXC Provedor.");
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = search
    ? plans.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()))
    : plans;

  const ativos  = plans.filter((p) => p.active);
  const minPrice = plans.length ? Math.min(...plans.map((p) => p.price || 0)) : 0;
  const maxPrice = plans.length ? Math.max(...plans.map((p) => p.price || 0)) : 0;

  const fmtBRL = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <PageContainer>
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-heading">Planos de Internet</h2>
        <p className="text-sm text-muted-foreground">{plans.length} planos cadastrados no IXCSoft</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total de Planos" value={plans.length}  icon={Wifi}        color="primary" />
        <StatCard title="Planos Ativos"   value={ativos.length} icon={CheckCircle} color="accent" />
        <StatCard title="Faixa de Preço"  value={`${fmtBRL(minPrice)} – ${fmtBRL(maxPrice)}`} icon={DollarSign} color="indigo" />
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar plano..."
              className="w-full h-10 pl-9 pr-4 bg-muted/60 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-semibold px-4 py-3">ID</th>
                <th className="text-left font-semibold px-4 py-3">Nome do Plano</th>
                <th className="text-left font-semibold px-4 py-3">Download</th>
                <th className="text-left font-semibold px-4 py-3">Upload</th>
                <th className="text-left font-semibold px-4 py-3">Valor</th>
                <th className="text-left font-semibold px-4 py-3">Tecnologia</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Carregando planos...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum plano encontrado</td></tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground text-xs">#{p.id}</td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">{p.download ? `${p.download} Mbps` : "—"}</td>
                    <td className="px-4 py-3">{p.upload ? `${p.upload} Mbps` : "—"}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">{fmtBRL(p.price)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.type || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${p.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {p.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}
