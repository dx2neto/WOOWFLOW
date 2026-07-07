import React, { useState, useEffect } from "react";
import { PageContainer, StatCard, Card } from "@/components/ui/app-card";
import { ixcApi } from "@/functions/ixcApi";
import { Search, Users, CheckCircle } from "lucide-react";

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState("");

  useEffect(() => { loadVendors(); }, []);

  const loadVendors = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ixcApi({ action: "vendedores" });
      if (res?.data?.success === false) { setError(res.data.error); setVendors([]); return; }
      setVendors(res?.data?.data || []);
    } catch {
      setError("Não foi possível carregar os vendedores do IXC Provedor.");
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = search
    ? vendors.filter((v) => v.name?.toLowerCase().includes(search.toLowerCase()) || v.email?.toLowerCase().includes(search.toLowerCase()))
    : vendors;

  const ativos = vendors.filter((v) => v.active);

  return (
    <PageContainer>
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-heading">Vendedores</h2>
        <p className="text-sm text-muted-foreground">{vendors.length} vendedores cadastrados</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard title="Total de Vendedores" value={vendors.length} icon={Users}        color="primary" />
        <StatCard title="Ativos"               value={ativos.length} icon={CheckCircle}  color="accent" />
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar vendedor..."
              className="w-full h-10 pl-9 pr-4 bg-muted/60 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-semibold px-4 py-3">ID</th>
                <th className="text-left font-semibold px-4 py-3">Nome</th>
                <th className="text-left font-semibold px-4 py-3">E-mail</th>
                <th className="text-left font-semibold px-4 py-3">Telefone</th>
                <th className="text-left font-semibold px-4 py-3">CPF</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Carregando vendedores...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum vendedor encontrado</td></tr>
              ) : (
                filtered.map((v) => (
                  <tr key={v.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-4 py-3 text-xs text-muted-foreground">#{v.id}</td>
                    <td className="px-4 py-3 font-medium">{v.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.email || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.phone || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.cpf || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${v.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {v.active ? "Ativo" : "Inativo"}
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
