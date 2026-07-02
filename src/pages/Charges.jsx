import React, { useState, useEffect } from "react";
import { PageContainer, StatCard, Card } from "@/components/ui/Card";
import { DollarSign, Zap, Send, CheckCircle, AlertTriangle, Search, Filter } from "lucide-react";
import { ixcApi } from "@/functions/ixcApi";

const today = new Date();

const mapStatus = (c) => {
  if (c.status === "P") return "paga";
  if (c.status === "A" && c.due_date && new Date(c.due_date) < today) return "vencida";
  if (c.status === "A") return "pendente";
  return "negociando";
};

export default function Charges() {
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => { loadCharges(); }, []);

  const loadCharges = async () => {
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
          const daysLate = status === "vencida" && dueDate ? Math.floor((today - dueDate) / 86400000) : 0;
          return { ...c, status, days_late: daysLate };
        });
        setCharges(mapped);
      }
    } catch (e) {
      setError("Não foi possível carregar as cobranças do IXC Provedor.");
      setCharges([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === "all" ? charges : charges.filter((c) => c.status === filter);

  const totalPending = charges.filter((c) => c.status === "pendente").reduce((s, c) => s + (c.value || 0), 0);
  const totalOverdue = charges.filter((c) => c.status === "vencida").reduce((s, c) => s + (c.value || 0), 0);
  const totalPaid = charges.filter((c) => c.status === "paga").reduce((s, c) => s + (c.value || 0), 0);

  const statusConfig = {
    paga: { label: "Paga", color: "bg-green-100 text-green-700" },
    pendente: { label: "Pendente", color: "bg-amber-100 text-amber-700" },
    vencida: { label: "Vencida", color: "bg-red-100 text-red-700" },
    negociando: { label: "Negociando", color: "bg-purple-100 text-purple-700" },
  };

  const filters = [
    { key: "all", label: "Todas" },
    { key: "pendente", label: "Pendentes" },
    { key: "vencida", label: "Vencidas" },
    { key: "paga", label: "Pagas" },
  ];

  return (
    <PageContainer>
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-heading">Cobranças e PIX</h2>
        <p className="text-sm text-muted-foreground">Gestão de cobranças automáticas e lembretes PIX</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="A Receber" value={`R$ ${totalPending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={DollarSign} color="warning" />
        <StatCard title="Vencido" value={`R$ ${totalOverdue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={AlertTriangle} color="danger" />
        <StatCard title="Recebido" value={`R$ ${totalPaid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={CheckCircle} color="accent" />
        <StatCard title="Faturas em Aberto" value={charges.filter((c) => c.status !== "paga").length} icon={Send} color="primary" />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-semibold px-4 py-3">Cliente</th>
                <th className="text-left font-semibold px-4 py-3">Telefone</th>
                <th className="text-left font-semibold px-4 py-3">Vencimento</th>
                <th className="text-left font-semibold px-4 py-3">Valor</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-left font-semibold px-4 py-3">Dias Atraso</th>
                <th className="text-right font-semibold px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma cobrança encontrada</td></tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{c.customer_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.phone}</td>
                    <td className="px-4 py-3">{c.due_date ? new Date(c.due_date).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="px-4 py-3 font-semibold">R$ {(c.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusConfig[c.status]?.color || statusConfig.pendente.color}`}>
                        {statusConfig[c.status]?.label || c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{c.days_late > 0 ? <span className="text-red-600 font-medium">{c.days_late} dias</span> : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-2 hover:bg-green-50 rounded-lg text-green-600" title="Enviar PIX"><Zap className="w-4 h-4" /></button>
                        <button className="p-2 hover:bg-blue-50 rounded-lg text-blue-600" title="Enviar Boleto"><Send className="w-4 h-4" /></button>
                      </div>
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