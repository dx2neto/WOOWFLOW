import React, { useState, useEffect, useCallback } from "react";
import { Plus, RefreshCw, Search, Phone, Mail, MapPin, TrendingUp, DollarSign } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { RESELLER_STATUS } from "@/components/sales/saleConstants";
import ResellerFormModal from "@/components/sales/ResellerFormModal";

export default function Resellers() {
  const { toast } = useToast();
  const [resellers, setResellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingReseller, setEditingReseller] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Reseller.list("-created_date", 200);
      setResellers(data);
    } catch {
      toast({ title: "Erro ao carregar revendedores", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? resellers.filter(r =>
        [r.name, r.cpf_cnpj, r.phone, r.city]
          .filter(Boolean)
          .some(v => v.toLowerCase().includes(search.toLowerCase()))
      )
    : resellers;

  const getStatusBadge = (status) => {
    const s = RESELLER_STATUS.find(r => r.key === status) || RESELLER_STATUS[2];
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.label}</span>;
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-thin bg-background">
      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold font-heading">Revendedores</h1>
            <p className="text-sm text-muted-foreground">{resellers.length} revendedor(es) cadastrado(s)</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background w-56"
                placeholder="Buscar revendedor..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Atualizar</Button>
            <Button size="sm" onClick={() => { setEditingReseller(null); setShowForm(true); }}><Plus className="w-4 h-4 mr-1" /> Novo Revendedor</Button>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p>Nenhum revendedor encontrado.</p>
            <Button className="mt-4" size="sm" onClick={() => { setEditingReseller(null); setShowForm(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Cadastrar Revendedor
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(reseller => (
              <div
                key={reseller.id}
                className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => { setEditingReseller(reseller); setShowForm(true); }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{reseller.name}</h3>
                    <p className="text-xs text-muted-foreground">{reseller.person_type === "pessoa_juridica" ? "PJ" : "PF"} {reseller.cpf_cnpj ? `· ${reseller.cpf_cnpj}` : ""}</p>
                  </div>
                  {getStatusBadge(reseller.status)}
                </div>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  {reseller.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {reseller.phone}</div>}
                  {reseller.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {reseller.email}</div>}
                  {reseller.city && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {reseller.city}</div>}
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-sm">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" />
                    <span className="font-semibold text-foreground">{reseller.total_sales || 0}</span>
                    <span className="text-muted-foreground text-xs">vendas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-green-600" />
                    <span className="font-semibold text-foreground">R$ {(reseller.total_commission || 0).toFixed(2)}</span>
                  </div>
                  {reseller.commission_rate > 0 && (
                    <span className="text-xs text-muted-foreground ml-auto">{reseller.commission_rate}% comissão</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ResellerFormModal
        show={showForm}
        reseller={editingReseller}
        onClose={() => { setShowForm(false); setEditingReseller(null); }}
        onSaved={() => { setShowForm(false); setEditingReseller(null); load(); }}
      />
    </div>
  );
}