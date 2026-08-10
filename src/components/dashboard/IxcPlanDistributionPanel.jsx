import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/app-card";
import { ixcApi } from "@/functions/ixcApi";
import { base44 } from "@/api/base44Client";
import { FileText, Loader2, RefreshCw, Layers, CheckCircle, XCircle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

const CHART_COLORS = ["#7c3aed", "#6366f1", "#3b82f6", "#06b6d4", "#10b981", "#84cc16", "#eab308", "#f97316", "#ef4444", "#ec4899"];

const STATUS_LABELS = {
  A:  { label: "Ativo",     color: "bg-green-100 text-green-700" },
  CA: { label: "Cancelado", color: "bg-red-100 text-red-700" },
  I:  { label: "Inativo",   color: "bg-gray-100 text-gray-700" },
};

export default function IxcPlanDistributionPanel() {
  // ── Busca contratos ativos do IXC ─────────────────────────────────────────
  const {
    data: contractData,
    isLoading: loadingContracts,
    refetch: refetchContracts,
  } = useQuery({
    queryKey: ["ixcPlanDistribution"],
    queryFn: async () => {
      const res = await ixcApi({ action: "contratos", status: "A", page: 1, limit: 500 });
      return res?.data?.result?.registros || [];
    },
    staleTime: 120_000,
  });

  // ── Busca templates de contrato ativos (têm ixc_plan_ids) ────────────────
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ["contractTemplatesActive"],
    queryFn: async () => {
      const data = await base44.entities.ContractTemplate.filter({ active: true });
      return data || [];
    },
    staleTime: 120_000,
  });

  const loading = loadingContracts || loadingTemplates;

  // ── Mapa de plan_id → template ────────────────────────────────────────────
  const planToTemplate = useMemo(() => {
    const map = {};
    templates.forEach((t) => {
      let planIds = [];
      try { planIds = JSON.parse(t.ixc_plan_ids || "[]"); } catch { planIds = []; }
      if (!Array.isArray(planIds)) planIds = [planIds];
      planIds.forEach((pid) => {
        if (pid) map[String(pid)] = t;
      });
    });
    return map;
  }, [templates]);

  // ── Agrupa contratos por plan_id ──────────────────────────────────────────
  const planDistribution = useMemo(() => {
    if (!contractData) return [];
    const groups = {};
    contractData.forEach((c) => {
      const pid = String(c.plan_id || "");
      if (!pid) return;
      if (!groups[pid]) {
        groups[pid] = {
          plan_id: pid,
          plan_name: c.plan_name || `Plano #${pid}`,
          count: 0,
          active: 0,
          cancelled: 0,
          linked_template: null,
        };
      }
      groups[pid].count++;
      const st = String(c.status || "").toUpperCase();
      if (st === "A" || st === "ativo") groups[pid].active++;
      else groups[pid].cancelled++;
      if (!groups[pid].linked_template && planToTemplate[pid]) {
        groups[pid].linked_template = planToTemplate[pid];
      }
    });
    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [contractData, planToTemplate]);

  const totalContracts = useMemo(
    () => planDistribution.reduce((s, p) => s + p.count, 0),
    [planDistribution]
  );
  const linkedCount = useMemo(
    () => planDistribution.filter((p) => p.linked_template).length,
    [planDistribution]
  );

  const chartData = useMemo(
    () => planDistribution.slice(0, 10).map((p) => ({
      name: p.plan_name.length > 20 ? p.plan_name.slice(0, 18) + "…" : p.plan_name,
      contratos: p.count,
    })),
    [planDistribution]
  );

  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-base flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" /> Distribuição de Planos IXC — Contratos por Plano
        </h3>
        <button
          onClick={() => refetchContracts()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : planDistribution.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Nenhum contrato ativo encontrado no IXC Provedor.
        </div>
      ) : (
        <>
          {/* ── Resumo ──────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-violet-600 mb-1">Total de Planos</p>
              <p className="text-2xl font-bold text-violet-700">{planDistribution.length}</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-600 mb-1">Contratos Ativos</p>
              <p className="text-2xl font-bold text-blue-700">{totalContracts}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-emerald-600 mb-1">Com Template Vinculado</p>
              <p className="text-2xl font-bold text-emerald-700">{linkedCount}</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-600 mb-1">Sem Template</p>
              <p className="text-2xl font-bold text-amber-700">{planDistribution.length - linkedCount}</p>
            </div>
          </div>

          {/* ── Gráfico de distribuição ─────────────────────────────────────── */}
          {chartData.length > 0 && (
            <div className="mb-5">
              <h4 className="text-sm font-semibold mb-3">Top 10 Planos por Volume de Contratos</h4>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} formatter={(v) => [v, "contratos"]} />
                  <Bar dataKey="contratos" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Tabela detalhada ───────────────────────────────────────────── */}
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left font-semibold px-3 py-2.5">ID Plano IXC</th>
                  <th className="text-left font-semibold px-3 py-2.5">Nome do Plano</th>
                  <th className="text-center font-semibold px-3 py-2.5">Contratos Ativos</th>
                  <th className="text-left font-semibold px-3 py-2.5">Template Vinculado</th>
                  <th className="text-left font-semibold px-3 py-2.5">Tipo do Documento</th>
                  <th className="text-center font-semibold px-3 py-2.5">Auto-envio</th>
                  <th className="text-center font-semibold px-3 py-2.5">Status Template</th>
                </tr>
              </thead>
              <tbody>
                {planDistribution.map((p) => {
                  const tpl = p.linked_template;
                  return (
                    <tr key={p.plan_id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 text-muted-foreground text-xs font-mono">#{p.plan_id}</td>
                      <td className="px-3 py-2.5 font-medium">{p.plan_name}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs font-bold">
                          {p.active}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {tpl ? (
                          <span className="text-xs font-medium text-primary">{tpl.name}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Nenhum template vinculado</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground capitalize text-xs">
                        {tpl ? (tpl.document_type || "—").replace(/_/g, " ") : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {tpl ? (
                          tpl.auto_send ? (
                            <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />
                          )
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {tpl ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${tpl.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                            {tpl.active ? "Ativo" : "Inativo"}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}