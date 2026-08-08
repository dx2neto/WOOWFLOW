import React, { useState, useEffect, useCallback } from "react";
import { Plus, RefreshCw, Activity, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import SaleKanban from "@/components/sales/SaleKanban";
import SaleDetailPanel from "@/components/sales/SaleDetailPanel";
import NewSaleModal from "@/components/sales/NewSaleModal";
import { salesPipelineApi } from "@/functions/salesPipelineApi";

export default function SalesPipeline() {
  const { toast } = useToast();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showNewSale, setShowNewSale] = useState(false);
  const [resellers, setResellers] = useState([]);
  const [search, setSearch] = useState("");
  const [healthStatus, setHealthStatus] = useState(null);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Sale.list("-created_date", 200);
      setSales(data);
    } catch {
      toast({ title: "Erro ao carregar vendas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadResellers = useCallback(async () => {
    try {
      const data = await base44.entities.Reseller.list("-created_date", 100);
      setResellers(data);
    } catch { /* silent */ }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const resp = await salesPipelineApi({ action: "health_check" });
      if (resp?.data?.success) setHealthStatus(resp.data.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadSales();
    loadResellers();
    loadHealth();
  }, [loadSales, loadResellers, loadHealth]);

  const filteredSales = search.trim()
    ? sales.filter(s =>
        [s.customer_name, s.phone, s.cpf_cnpj, s.correlation_id]
          .filter(Boolean)
          .some(v => v.toLowerCase().includes(search.toLowerCase()))
      )
    : sales;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold font-heading">Esteira de Vendas</h1>
          <p className="text-sm text-muted-foreground">{sales.length} venda(s) em andamento</p>
        </div>
        <div className="flex items-center gap-2">
          {healthStatus && (
            <div className="flex items-center gap-2 mr-2">
              {Object.entries(healthStatus).map(([key, val]) => (
                <span key={key} className={`text-xs px-2 py-1 rounded-full font-medium ${val.status === "ONLINE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {key.toUpperCase()}: {val.status}
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background w-56"
              placeholder="Buscar venda..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => { loadSales(); loadHealth(); }}>
            <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
          </Button>
          <Button size="sm" onClick={() => setShowNewSale(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nova Venda
          </Button>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 p-4 overflow-hidden">
        <SaleKanban
          sales={filteredSales}
          onSelect={(sale) => setSelectedSale(sale)}
          selectedId={selectedSale?.id}
          loading={loading}
        />
      </div>

      {/* Detail Panel */}
      {selectedSale && (
        <SaleDetailPanel
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
          onRefresh={async () => {
            await loadSales();
            const updated = await base44.entities.Sale.get(selectedSale.id);
            setSelectedSale(updated);
          }}
        />
      )}

      {/* New Sale Modal */}
      <NewSaleModal
        show={showNewSale}
        onClose={() => setShowNewSale(false)}
        onCreated={() => { setShowNewSale(false); loadSales(); }}
        resellers={resellers}
      />
    </div>
  );
}