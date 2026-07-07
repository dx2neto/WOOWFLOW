import React, { useState, useEffect, useCallback } from "react";
import { PageContainer, StatCard, Card } from "@/components/ui/app-card";
import { ixcApi } from "@/functions/ixcApi";
import { evolutionApi } from "@/functions/evolutionApi";
import { useToast } from "@/components/ui/use-toast";
import {
  Search, RefreshCw, Loader2, WifiOff, AlertTriangle,
  Send, Plus, ChevronLeft, ChevronRight, Info
} from "lucide-react";

const PAGE_SIZE = 60;

export default function NOC() {
  const [tab, setTab]         = useState("offline");
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState("");
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const [pending, setPending] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const { toast } = useToast();

  const load = useCallback(async (pg = 1, currentTab = tab) => {
    setLoading(true);
    setError(null);
    setPending(false);
    try {
      const action = currentTab === "offline" ? "noc_offline" : "noc_sinal_ruim";
      const res = await ixcApi({ action, page: pg, limit: PAGE_SIZE });
      if (res?.data?.success === false) { setError(res.data.error); setItems([]); return; }
      if (res?.data?.pending) { setPending(true); setItems([]); setTotal(0); return; }
      setItems(res?.data?.data || []);
      setTotal(res?.data?.pagination?.total || 0);
      setPage(pg);
    } catch {
      setError("Não foi possível carregar dados do NOC.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(1, tab); }, [tab]);

  const filtered = search
    ? items.filter((i) =>
        i.client_name?.toLowerCase().includes(search.toLowerCase()) ||
        i.city?.toLowerCase().includes(search.toLowerCase()) ||
        i.olt?.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSend = async (item) => {
    if (!item.phone) { toast({ title: "Cliente sem telefone", variant: "destructive" }); return; }
    setSendingId(item.contract_id);
    try {
      const msg = `Olá ${item.client_name}, identificamos que sua conexão está sem sinal. Nossa equipe já está ciente e trabalhando para normalizar. Em caso de dúvidas, responda esta mensagem.`;
      const r = await evolutionApi({ action: "send_message", phone: item.phone, message: msg });
      if (r?.data?.success) toast({ title: `Mensagem enviada para ${item.client_name}` });
      else toast({ title: "Falha ao enviar mensagem", variant: "destructive" });
    } catch { toast({ title: "Erro ao enviar mensagem", variant: "destructive" }); }
    finally { setSendingId(null); }
  };

  const handleOpenOS = async (item) => {
    try {
      const r = await ixcApi({
        action: "os_create",
        data: { id_cliente: item.client_id, assunto: "Sem sinal — origem NOC", descricao: `Contrato ${item.contract_id} | OLT: ${item.olt || "—"} | CTO: ${item.cto || "—"}`, prioridade: "A" },
      });
      if (r?.data?.success) toast({ title: "OS aberta com sucesso!" });
      else toast({ title: r?.data?.error || "Falha ao abrir OS", variant: "destructive" });
    } catch { toast({ title: "Erro ao abrir OS", variant: "destructive" }); }
  };

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">NOC — Centro de Operações</h2>
          <p className="text-sm text-muted-foreground">Monitoramento de clientes offline e com sinal ruim</p>
        </div>
        <button onClick={() => load(1)} className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard title={tab === "offline" ? "Contratos Suspensos" : "Sinal Ruim"} value={total} icon={WifiOff} color="danger" />
        <StatCard title="Nesta página" value={items.length} icon={AlertTriangle} color="warning" />
        <StatCard title="Com OLT identificada" value={items.filter((i) => i.olt).length} icon={Info} color="indigo" />
      </div>

      <div className="flex gap-2 mb-4">
        {[["offline", "Clientes Offline / Suspensos"], ["sinal_ruim", "Sinal Ruim (OLT)"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
            {l}
          </button>
        ))}
      </div>

      {pending && (
        <Card className="p-6 mb-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Módulo pendente de integração OLT/RADIUS</p>
              <p className="text-sm text-muted-foreground mt-1">
                O módulo de <strong>sinal ruim</strong> requer integração com OLT (GPON/EPON), RADIUS ou Zabbix para obter dados de potência óptica em tempo real.
                O código está preparado para receber esses dados quando a integração for configurada.
              </p>
              <p className="text-xs text-muted-foreground mt-2">Integrações suportadas no roadmap: Huawei OLT, ZTE OLT, Zabbix, Grafana, RADIUS.</p>
            </div>
          </div>
        </Card>
      )}

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      {!pending && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por cliente, cidade ou OLT..."
                className="w-full h-10 pl-9 pr-4 bg-muted/60 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left font-semibold px-4 py-3">Cliente</th>
                  <th className="text-left font-semibold px-4 py-3">Telefone</th>
                  <th className="text-left font-semibold px-4 py-3">Cidade</th>
                  <th className="text-left font-semibold px-4 py-3">Plano</th>
                  <th className="text-left font-semibold px-4 py-3">OLT</th>
                  <th className="text-left font-semibold px-4 py-3">CTO</th>
                  <th className="text-left font-semibold px-4 py-3">Status Internet</th>
                  <th className="text-right font-semibold px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum cliente encontrado</td></tr>
                ) : (
                  filtered.map((i) => (
                    <tr key={i.contract_id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{i.client_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{i.phone || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{i.city || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{i.plan_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{i.olt || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{i.cto || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-700">
                          {i.status_internet === "S" ? "Suspenso" : i.status_internet || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            disabled={!!sendingId}
                            onClick={() => handleSend(i)}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                            title="Enviar mensagem WhatsApp"
                          >
                            {sendingId === i.contract_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => handleOpenOS(i)}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"
                            title="Abrir OS"
                          >
                            <Plus className="w-3 h-3" /> OS
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
              <span>Página {page} de {totalPages} — {total} contratos</span>
              <div className="flex gap-2">
                <button disabled={page <= 1 || loading} onClick={() => load(page - 1)} className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                <button disabled={page >= totalPages || loading} onClick={() => load(page + 1)} className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </Card>
      )}
    </PageContainer>
  );
}
