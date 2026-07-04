import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, Card } from "@/components/ui/Card";
import { Plus, Search, MoreVertical, Filter } from "lucide-react";
import { ixcApi } from "@/functions/ixcApi";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [contactsByClient, setContactsByClient] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => { loadContacts(); }, []);
  useEffect(() => {
    const timeout = setTimeout(() => loadCustomers(search), 400);
    return () => clearTimeout(timeout);
  }, [search]);

  const loadCustomers = async (searchTerm) => {
    setLoading(true);
    setError(null);
    try {
      const response = await ixcApi({ action: "clientes", search: searchTerm || undefined });
      if (response?.data?.error) {
        setError(response.data.error);
        setCustomers([]);
      } else {
        setCustomers(response?.data?.result?.registros || []);
      }
    } catch (e) {
      setError("Não foi possível carregar os clientes do IXC Provedor.");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    try {
      const response = await ixcApi({ action: "contatos" });
      const registros = response?.data?.result?.registros || [];
      const grouped = {};
      registros.forEach((ct) => {
        if (!ct.client_id) return;
        grouped[ct.client_id] = grouped[ct.client_id] || [];
        grouped[ct.client_id].push(ct);
      });
      setContactsByClient(grouped);
    } catch (e) {
      setContactsByClient({});
    }
  };

  const filtered = customers;



  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Clientes</h2>
          <p className="text-sm text-muted-foreground">{customers.length} clientes cadastrados</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, telefone, CPF ou cidade..."
              className="w-full h-10 pl-9 pr-4 bg-muted/60 rounded-lg text-sm focus:outline-none focus:bg-card focus:ring-1 focus:ring-primary"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
            <Filter className="w-4 h-4" /> Filtros
          </button>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-semibold px-4 py-3">Cliente</th>
                <th className="text-left font-semibold px-4 py-3">Contato</th>
                <th className="text-left font-semibold px-4 py-3">Email</th>
                <th className="text-left font-semibold px-4 py-3">Cidade</th>
                <th className="text-left font-semibold px-4 py-3">Contatos</th>
                <th className="text-left font-semibold px-4 py-3">Contrato</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</td></tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold text-xs">
                          {c.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.cpf_cnpj || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.phone}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.email || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.city || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground" title={(contactsByClient[c.id] || []).map((ct) => `${ct.name} ${ct.phone}`).join(", ")}>
                      {(contactsByClient[c.id] || []).length > 0 ? `${contactsByClient[c.id].length} contato(s)` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${c.contract_status === "ativo" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {c.contract_status === "ativo" ? "Ativo" : "Cancelado"}
                      </span>
                    </td>
                    <td className="px-4 py-3"><button className="p-1.5 hover:bg-muted rounded-lg"><MoreVertical className="w-4 h-4 text-muted-foreground" /></button></td>
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