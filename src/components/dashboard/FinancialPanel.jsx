import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/app-card";
import { CheckCircle2, Clock3 } from "lucide-react";

const formatBRL = (value) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function FinancialPanel() {
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Charge.list().then((data) => { setCharges(data); setLoading(false); });
  }, []);

  const paid = charges.filter((c) => c.status === "paga");
  const pending = charges.filter((c) => c.status === "pendente" || c.status === "vencida" || c.status === "negociando");
  const totalPaid = paid.reduce((sum, c) => sum + (c.value || 0), 0);
  const totalPending = pending.reduce((sum, c) => sum + (c.value || 0), 0);

  return (
    <Card title="Painel Financeiro" className="p-5 mb-6">
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-4 p-4 rounded-lg bg-green-50">
            <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold font-heading">{formatBRL(totalPaid)}</p>
              <p className="text-sm text-muted-foreground">Faturas pagas ({paid.length})</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 rounded-lg bg-amber-50">
            <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
              <Clock3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold font-heading">{formatBRL(totalPending)}</p>
              <p className="text-sm text-muted-foreground">Valor pendente em aberto ({pending.length})</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}