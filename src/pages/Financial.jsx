import React, { useState, useEffect, useCallback } from "react";
import { PageContainer, StatCard } from "@/components/ui/app-card";
import { ixcApi } from "@/functions/ixcApi";
import { evolutionApi } from "@/functions/evolutionApi";
import { useToast } from "@/components/ui/use-toast";
import { exportToCsv } from "@/lib/exportCsv";
import StatusInvoiceGroup from "@/components/financial/StatusInvoiceGroup";
import { DollarSign, AlertTriangle, Users, Search, Download, RefreshCw, Loader2 } from "lucide-react";

const today = new Date();

const mapStatus = (c) => {
  if (c.status === "P") return "paga";
  if (c.status === "A" && c.due_date && new Date(c.due_date) < today) return "vencida";
  if (c.status === "A") return "pendente";
  return "negociando";
};

const fmtBRL = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Financial() {
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [sendingId, setSendingId] = useState(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await ixcApi({ action: "faturas" });
      if (response?.data?.error) {
        setError(response.data.error);
        setCharges([]);
      } else {
        const registros = response?.data?.result?.registros || [];
        const mapped = registros.map((c) => {
          const dueDate = c.due_date ? new Date(c.due_date) : null;
          const status = mapStatus(c);
          const daysLate = status === "vencida" && dueDate ? Math.floor((today.getTime() - dueDate.getTime()) / 86400000) : 0;
          return { ...c, status, days_late: daysLate };
        });
        setCharges(mapped);
      }
    } catch {
      setError("Não foi possível carregar as faturas do IXC Provedor.");
      setCharges([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSend = async (charge, type) => {
    if (!charge.phone) {
      toast({ title: "Cliente sem telefone cadastrado", variant: "destructive" });
      return;
    }
    setSendingId(`${type}-${charge.id}`);
    try {
      const message = type === "pix"
        ? `Olá ${charge.customer_name}, segue o código PIX para pagamento da sua fatura de ${fmtBRL(charge.value)}${charge.due_date ? ` com vencimento em ${new Date(charge.due_date).toLocaleDateString("pt-BR")}` : ""}.`
        : `Olá ${charge.customer_name}, segue o boleto da sua fatura de ${fmtBRL(charge.value)}${charge.due_date ? ` com vencimento em ${new Date(charge.due_date).toLocaleDateString("pt-BR")}` : ""}.`;
      const response = await evolutionApi({ action: "send_message", phone: charge.phone, message });
      if (response?.data?.success) {
        toast({ title: type === "pix" ? "PIX enviado com sucesso" : "Boleto enviado com sucesso" });
      } else {
        toast({ title: "Falha ao enviar mensagem", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao enviar mensagem", variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const q = search.toLowerCase();
  const matches = (c) => !q || c.customer_name?.toLowerCase().includes(q) || c.phone?.includes(search);

  const vencidas = charges.filter((c) => c.status === "vencida" && matches(c)).sort((a, b) => b.days_late - a.days_late);
  const pendentes = charges.filter((c) => c.status === "pendente" && matches(c)).sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));

  const totalVencido = vencidas.reduce((s, c) => s + (c.value || 0), 0);
  const totalPendente = pendentes.reduce((s, c) => s + (c.value || 0), 0);
  const clientesInadimplentes = new Set(vencidas.map((c) => c.customer_name)).size;

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Financeiro — Inadimplência</h2>
          <p className="text-sm text-muted-foreground">Faturas pendentes e vencidas agrupadas por status — integrado ao IXCSoft</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
          <button
            onClick={() => exportToCsv("inadimplencia.csv", [...vencidas, ...pendentes].map((c) => ({
              cliente: c.customer_name, telefone: c.phone, vencimento: c.due_date, valor: c.value, status: c.status, dias_atraso: c.days_late,
            })))}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Vencido" value={fmtBRL(totalVencido)} icon={AlertTriangle} color="danger" />
        <StatCard title="Total Pendente" value={fmtBRL(totalPendente)} icon={DollarSign} color="warning" />
        <StatCard title="Faturas Vencidas" value={vencidas.length} icon={AlertTriangle} color="danger" />
        <StatCard title="Clientes Inadimplentes" value={clientesInadimplentes} icon={Users} color="primary" />
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente ou telefone..."
          className="w-full h-10 pl-9 pr-4 bg-muted/60 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando faturas do IXC...
        </div>
      ) : (
        <>
          <StatusInvoiceGroup
            title="Vencidas"
            subtitle="Clientes inadimplentes — ordenado por dias em atraso"
            badgeColor="bg-red-100 text-red-700"
            invoices={vencidas}
            sendingId={sendingId}
            onSend={handleSend}
          />
          <StatusInvoiceGroup
            title="Pendentes"
            subtitle="Faturas em aberto ainda dentro do vencimento"
            badgeColor="bg-amber-100 text-amber-700"
            invoices={pendentes}
            sendingId={sendingId}
            onSend={handleSend}
          />
        </>
      )}
    </PageContainer>
  );
}