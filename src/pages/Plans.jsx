import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageContainer, StatCard, Card } from "@/components/ui/app-card";
import { base44 } from "@/api/base44Client";
import { ixcApi } from "@/functions/ixcApi";
import { Search, Wifi, DollarSign, CheckCircle, RefreshCw, Loader2, CloudDownload, AlertCircle } from "lucide-react";

const fmtBRL = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Plans() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const { data: plans = [], isLoading, error, refetch } = useQuery({
    queryKey: ["ixcPlans"],
    queryFn: async () => {
      const data = await base44.entities.IxcPlan.list("name", 500);
      return data || [];
    },
    staleTime: 60_000,
  });

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await ixcApi({ action: "sync_plans" });
      const result = res?.data?.data || res?.data;
      setSyncResult(result);
      queryClient.invalidateQueries({ queryKey: ["ixcPlans"] });
      refetch();
    } catch (e) {
      setSyncResult({ error: e?.message || "Falha ao sincronizar planos" });
    } finally {
      setSyncing(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search) return plans;
    const q = search.toLowerCase();
    return plans.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      String(p.ixc_plan_id).includes(q) ||
      p.type?.toLowerCase().includes(q)
    );
  }, [plans, search]);

  const ativos = plans.filter((p) => p.active);
  const minPrice = plans.length ? Math.min(...plans.map((p) => p.price || 0)) : 0;
  const maxPrice = plans.length ? Math.max(...plans.map((p) => p.price || 0)) : 0;
  const lastSync = plans.length ? plans.reduce((latest, p) => {
    return p.last_synced_at && (!latest || new Date(p.last_synced_at) > new Date(latest)) ? p.last_synced_at : latest;
  }, null) : null;

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Planos de Internet</h2>
          <p className="text-sm text-muted-foreground">
            {plans.length} planos sincronizados do IXCSoft
            {lastSync && (
              <span className="ml-2 text-xs text-muted-foreground/60">
                · Última sincronização: {new Date(lastSync).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
          {syncing ? "Sincronizando..." : "Sincronizar Planos"}
        </button>
      </div>

      {syncResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${syncResult.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {syncResult.error ? (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {syncResult.error
            ? syncResult.error
            : `Sincronização concluída: ${syncResult.created || 0} novos planos, ${syncResult.updated || 0} atualizados de ${syncResult.total || 0} total.`}
        </div>
      )}

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
              placeholder="Buscar plano por nome, ID ou tecnologia..."
              className="w-full h-10 pl-9 pr-4 bg-muted/60 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-semibold px-4 py-3">ID IXC</th>
                <th className="text-left font-semibold px-4 py-3">Nome do Plano</th>
                <th className="text-left font-semibold px-4 py-3">Download</th>
                <th className="text-left font-semibold px-4 py-3">Upload</th>
                <th className="text-left font-semibold px-4 py-3">Valor</th>
                <th className="text-left font-semibold px-4 py-3">Tecnologia</th>
                <th className="text-left font-semibold px-4 py-3">Fidelidade</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando planos...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">
                  Nenhum plano encontrado. {plans.length === 0 && "Clique em \"Sincronizar Planos\" para importar do IXCSoft."}
                </td></tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono">#{p.ixc_plan_id}</td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">{p.download ? `${p.download} Mbps` : "—"}</td>
                    <td className="px-4 py-3">{p.upload ? `${p.upload} Mbps` : "—"}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">{fmtBRL(p.price)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.type || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.fidelity || "—"}</td>
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