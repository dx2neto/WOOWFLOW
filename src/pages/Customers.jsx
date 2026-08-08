import React, { useState, useEffect, useMemo } from "react";
import { PageContainer, Card } from "@/components/ui/app-card";
import { Plus, Search, MoreVertical, Filter, X } from "lucide-react";
import { ixcApi } from "@/functions/ixcApi";
import { useNavigate } from "react-router-dom";
import { maskCpfCnpj } from "@/lib/lgpd";

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [contactsByClient, setContactsByClient] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get("q") || "");
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");

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
    } catch {
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
    } catch {
      setContactsByClient({});
    }
  };

  const cities = useMemo(() => {
    const set = new Set(customers.map((c) => c.city).filter(Boolean));
    return Array.from(set).sort();
  }, [customers]);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (statusFilter !== "all") {
        const isActive = c.contract_status === "ativo";
        if (statusFilter === "ativo" && !isActive) return false;
        if (statusFilter === "cancelado" && isActive) return false;
      }
      if (cityFilter !== "all" && c.city !== cityFilter) return false;
      return true;
    });
  }, [customers, statusFilter, cityFilter]);

  const activeFilters = statusFilter !== "all" || cityFilter !== "all";

  const clearFilters = () => {
    setStatusFilter("all");
    setCityFilter("all");
  };



  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Clientes</h2>
          <p className="text-sm text-muted-foreground">{activeFilters ? `${filtered.length} de ${customers.length} clientes` : `${customers.length} clientes cadastrados`}</p>
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
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-muted ${activeFilters ? "border-primary bg-primary/5 text-primary" : "border-border"}`}
          >
            <Filter className="w-4 h-4" /> Filtros
            {activeFilters && <span className="ml-1 w-2 h-2 rounded-full bg-primary" />}
          </button>
        </div>

        {showFilters && (
          <div className="px-4 py-3 border-b border-border bg-muted/20 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Filtrar por:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="h-9 px-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todas as cidades</option>
              {cities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} de {customers.length} clientes</span>
            {activeFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" /> Limpar
              </button>
            )}
          </div>
        )}

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
                  <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)} className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold text-xs">
                          {c.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.cpf_cnpj ? maskCpfCnpj(c.cpf_cnpj) : "—"}</p>
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