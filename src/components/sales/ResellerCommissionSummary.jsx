import React from "react";
import { DollarSign, TrendingUp, Users, CheckCircle2 } from "lucide-react";

export default function ResellerCommissionSummary({ resellerSales, resellers }) {
  const totalCommission = resellerSales.reduce((sum, s) => sum + (s.commission_amount || 0), 0);
  const paidCommission = resellerSales.filter(s => s.commission_paid).reduce((sum, s) => sum + (s.commission_amount || 0), 0);
  const pendingCommission = totalCommission - paidCommission;
  const activeResellers = resellers.filter(r => r.status === "ativo").length;

  const stats = [
    { label: "Vendas Revenda", value: resellerSales.length, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Comissão Total", value: `R$ ${totalCommission.toFixed(2)}`, icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
    { label: "Pago", value: `R$ ${paidCommission.toFixed(2)}`, icon: CheckCircle2, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Pendente", value: `R$ ${pendingCommission.toFixed(2)}`, icon: DollarSign, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Revendedores Ativos", value: activeResellers, icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
      {stats.map((stat, i) => (
        <div key={i} className="bg-card rounded-lg border border-border p-3 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.bg}`}>
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}