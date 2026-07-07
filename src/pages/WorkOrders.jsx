import React, { useState, useEffect, useCallback } from "react";
import { PageContainer, StatCard, Card } from "@/components/ui/app-card";
import { ixcApi } from "@/functions/ixcApi";
import { useToast } from "@/components/ui/use-toast";
import {
  Search, Plus, Loader2, RefreshCw, ChevronLeft, ChevronRight,
  Wrench, CheckCircle, Clock, XCircle
} from "lucide-react";

const STATUS_CONFIG = {
  A:  { label: "Aberta",      color: "bg-blue-100 text-blue-700" },
  E:  { label: "Em andamento",color: "bg-amber-100 text-amber-700" },
  F:  { label: "Fechada",     color: "bg-green-100 text-green-700" },
  C:  { label: "Cancelada",   color: "bg-red-100 text-red-700" },
  AG: { label: "Agendada",    color: "bg-purple-100 text-purple-700" },
};

const PAGE_SIZE = 60;

export default function WorkOrders() {
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating]     = useState(false);
  const [newOS, setNewOS]           = useState({ id_cliente: "", assunto: "", descricao: "", prioridade: "N" });
  const { toast } = useToast();

  const load = useCallback(async (pg = 1, st = statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await ixcApi({
        action: "os", page: pg, limit: PAGE_SIZE,
        status: st !== "all" ? st : undefined,
        search: search || undefined,
      });
      if (res?.data?.success === false) { setError(res.data.error); setItems([]); return; }
      setItems(res?.data?.data || []);
      setTotal(res?.data?.pagination?.total || 0);
      setPage(pg);
    } catch {
      setError("Não foi possível carregar as ordens de serviço.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(1); }, []);

  const handleCreateOS = async () => {
    if (!newOS.id_cliente || !newOS.assunto) {
      toast({ title: "Preencha ID do cliente e assunto", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await ixcApi({ action: "os_create", data: newOS });
      if (res?.data?.success) {
        toast({ title: "OS criada com sucesso!" });
        setShowCreate(false);
        setNewOS({ id_cliente: "", assunto: "", descricao: "", prioridade: "N" });
        load(1);
      } else {
        toast({ title: res?.data?.error || "Falha ao criar OS", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao criar OS", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const abertas    = items.filter((i) => i.status === "A");
  const emAndamento= items.filter((i) => i.status === "E");
  const fechadas   = items.filter((i) => i.status === "F");
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Ordens de Serviço</h2>
          <p className="text-sm text-muted-foreground">{total} OS registradas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load(1)} className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" /> Nova OS
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total (pág.)"  value={items.length}       icon={Wrench}       color="primary" />
        <StatCard title="Abertas"        value={abertas.length}     icon={Clock}        color="warning" />
        <StatCard title="Em Andamento"   value={emAndamento.length} icon={Wrench}       color="indigo" />
        <StatCard title="Fechadas"       value={fechadas.length}    icon={CheckCircle}  color="accent" />
      </div>

      {showCreate && (
        <Card title="Criar Nova OS" className="p-5 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground font-medium">ID do Cliente *</label>
              <input value={newOS.id_cliente} onChange={(e) => setNewOS({ ...newOS, id_cliente: e.target.value })} placeholder="Ex: 12345"
                className="w-full mt-1 h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">Assunto *</label>
              <input value={newOS.assunto} onChange={(e) => setNewOS({ ...newOS, assunto: e.target.value })} placeholder="Ex: Sem sinal óptico"
                className="w-full mt-1 h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">Prioridade</label>
              <select value={newOS.prioridade} onChange={(e) => setNewOS({ ...newOS, prioridade: e.target.value })}
                className="w-full mt-1 h-10 px-3 border border-border rounded-lg text-sm bg-card">
                <option value="N">Normal</option>
                <option value="B">Baixa</option>
                <option value="A">Alta</option>
                <option value="U">Urgente</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">Descrição</label>
              <input value={newOS.descricao} onChange={(e) => setNewOS({ ...newOS, descricao: e.target.value })} placeholder="Detalhes do problema"
                className="w-full mt-1 h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleCreateOS} disabled={creating}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Criar OS
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">Cancelar</button>
          </div>
        </Card>
      )}

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(1)}
              placeholder="Buscar por cliente ou assunto..." className="w-full h-10 pl-9 pr-4 bg-muted/60 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[["all", "Todas"], ["A", "Abertas"], ["E", "Em andamento"], ["F", "Fechadas"], ["AG", "Agendadas"]].map(([k, l]) => (
              <button key={k} onClick={() => { setStatusFilter(k); load(1, k); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-semibold px-4 py-3">ID</th>
                <th className="text-left font-semibold px-4 py-3">Cliente</th>
                <th className="text-left font-semibold px-4 py-3">Assunto</th>
                <th className="text-left font-semibold px-4 py-3">Técnico</th>
                <th className="text-left font-semibold px-4 py-3">Cidade</th>
                <th className="text-left font-semibold px-4 py-3">Abertura</th>
                <th className="text-left font-semibold px-4 py-3">Agendamento</th>
                <th className="text-left font-semibold px-4 py-3">Prioridade</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">Nenhuma OS encontrada</td></tr>
              ) : (
                items.map((os) => {
                  const sc = STATUS_CONFIG[os.status] || { label: os.status || "—", color: "bg-muted text-muted-foreground" };
                  return (
                    <tr key={os.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3 text-xs text-muted-foreground">#{os.id}</td>
                      <td className="px-4 py-3 font-medium">{os.client_name}</td>
                      <td className="px-4 py-3 max-w-[180px] truncate" title={os.subject}>{os.subject || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{os.tech_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{os.city || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{os.open_date ? new Date(os.open_date).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{os.scheduled_date || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{os.priority || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${sc.color}`}>{sc.label}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <span>Página {page} de {totalPages} — {total} OS</span>
            <div className="flex gap-2">
              <button disabled={page <= 1 || loading} onClick={() => load(page - 1)} className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <button disabled={page >= totalPages || loading} onClick={() => load(page + 1)} className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
