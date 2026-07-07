import React, { useState, useEffect, useCallback } from "react";
import { PageContainer, StatCard, Card } from "@/components/ui/app-card";
import { ixcApi } from "@/functions/ixcApi";
import { evolutionApi } from "@/functions/evolutionApi";
import { useToast } from "@/components/ui/use-toast";
import { exportToCsv } from "@/lib/exportCsv";
import {
  DollarSign, AlertTriangle, Search, Filter, Download,
  Send, Loader2, RefreshCw, ChevronLeft, ChevronRight
} from "lucide-react";

const FAIXA_CONFIG = {
  "1-7d":  { label: "1–7 dias",  color: "bg-amber-100 text-amber-700" },
  "8-15d": { label: "8–15 dias", color: "bg-orange-100 text-orange-700" },
  "16-30d":{ label: "16–30 dias",color: "bg-red-100 text-red-700" },
  "31-60d":{ label: "31–60 dias",color: "bg-red-200 text-red-800" },
  "+60d":  { label: "+60 dias",  color: "bg-red-300 text-red-900" },
};

const PAGE_SIZE = 60;

export default function Financial() {
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState("");
  const [faixaFilter, setFaixaFilter] = useState("all");
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [sendingId, setSendingId]   = useState(null);
  const { toast } = useToast();

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await ixcApi({ action: "inadimplentes", page: pg, limit: PAGE_SIZE });
      if (res?.data?.success === false) { setError(res.data.error); setItems([]); return; }
      setItems(res?.data?.data || []);
      setTotal(res?.data?.pagination?.total || 0);
      setPage(pg);
    } catch {
      setError("Não foi possível carregar os inadimplentes do IXC Provedor.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const filtered = items.filter((i) => {
    const matchFaixa = faixaFilter === "all" || i.faixa === faixaFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || i.client_name?.toLowerCase().includes(q) || i.phone?.includes(search) || i.city?.toLowerCase().includes(q);
    return matchFaixa && matchSearch;
  });

  const totalValue = filtered.reduce((s, i) => s + (i.value || 0), 0);
  const fmtBRL = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleSend = async (item, type) => {
    if (!item.phone) {
      toast({ title: "Cliente sem telefone cadastrado", variant: "destructive" });
      return;
    }
    setSendingId(`${type}-${item.id}`);
    try {
      const msg = type === "pix"
        ? `Olá ${item.client_name}, seu débito de ${fmtBRL(item.value)} venceu em ${item.due_date ? new Date(item.due_date).toLocaleDateString("pt-BR") : "—"} (${item.days_late} dia(s) em atraso). ${item.pix_code ? `\nCódigo PIX: ${item.pix_code}` : "Fale conosco para regularizar."}`
        : `Olá ${item.client_name}, seu boleto de ${fmtBRL(item.value)} com vencimento em ${item.due_date ? new Date(item.due_date).toLocaleDateString("pt-BR") : "—"} está em aberto. ${item.linha_digitavel ? `\nLinha digitável: ${item.linha_digitavel}` : "Acesse seu portal para a 2ª via."}`;
      const r = await evolutionApi({ action: "send_message", phone: item.phone, message: msg });
      if (r?.data?.success) {
        toast({ title: `${type === "pix" ? "PIX" : "Boleto"} enviado com sucesso para ${item.client_name}` });
      } else {
        toast({ title: "Falha ao enviar mensagem", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao enviar mensagem", variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Financeiro — Inadimplência</h2>
          <p className="text-sm text-muted-foreground">Títulos vencidos e em aberto do IXCSoft</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load(1)} className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
          <button
            onClick={() => exportToCsv("inadimplentes.csv", filtered.map((i) => ({
              cliente: i.client_name, telefone: i.phone, cidade: i.city,
              valor: i.value, vencimento: i.due_date, dias_atraso: i.days_late, faixa: i.faixa,
            })))}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Inadimplentes" value={total}            icon={AlertTriangle} color="danger" />
        <StatCard title="Nesta página"         value={filtered.length} icon={DollarSign}    color="warning" />
        <StatCard title="Valor Total (pág.)"   value={fmtBRL(totalValue)} icon={DollarSign} color="danger" />
        <StatCard title="Faixa +30 dias"       value={filtered.filter((i) => i.days_late > 30).length} icon={AlertTriangle} color="danger" />
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, telefone ou cidade..."
              className="w-full h-10 pl-9 pr-4 bg-muted/60 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <select
            value={faixaFilter}
            onChange={(e) => setFaixaFilter(e.target.value)}
            className="h-10 px-3 border border-border rounded-lg text-sm bg-card"
          >
            <option value="all">Todas as faixas</option>
            {Object.entries(FAIXA_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
            <Filter className="w-4 h-4" /> Filtros avançados
          </button>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-semibold px-4 py-3">Cliente</th>
                <th className="text-left font-semibold px-4 py-3">Telefone</th>
                <th className="text-left font-semibold px-4 py-3">Cidade</th>
                <th className="text-left font-semibold px-4 py-3">Vencimento</th>
                <th className="text-left font-semibold px-4 py-3">Valor</th>
                <th className="text-left font-semibold px-4 py-3">Dias Atraso</th>
                <th className="text-left font-semibold px-4 py-3">Faixa</th>
                <th className="text-right font-semibold px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum inadimplente encontrado nesta página</td></tr>
              ) : (
                filtered.map((i) => {
                  const fc = FAIXA_CONFIG[i.faixa] || { label: i.faixa, color: "bg-muted text-muted-foreground" };
                  return (
                    <tr key={i.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{i.client_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{i.phone || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{i.city || "—"}</td>
                      <td className="px-4 py-3">{i.due_date ? new Date(i.due_date).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="px-4 py-3 font-semibold text-red-700">{fmtBRL(i.value)}</td>
                      <td className="px-4 py-3 font-medium text-red-600">{i.days_late}d</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${fc.color}`}>{fc.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {(i.pix_code) && (
                            <button
                              disabled={!!sendingId}
                              onClick={() => handleSend(i, "pix")}
                              className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                              title="Enviar PIX via WhatsApp"
                            >
                              {sendingId === `pix-${i.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} PIX
                            </button>
                          )}
                          <button
                            disabled={!!sendingId}
                            onClick={() => handleSend(i, "boleto")}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                            title="Enviar Boleto via WhatsApp"
                          >
                            {sendingId === `boleto-${i.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Boleto
                          </button>
                        </div>
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
            <span>Página {page} de {totalPages} — {total} registros</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => load(page - 1)}
                className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => load(page + 1)}
                className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
