import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/app-card";
import { Target, Pencil, Check } from "lucide-react";

const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function GoalsSection() {
  const [goal, setGoal] = useState(null);
  const [progress, setProgress] = useState({ contracts: 0, salesValue: 0 });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ target_new_contracts: 0, target_sales_value: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const month = currentMonth();
    const goals = await base44.entities.Goal.filter({ month });
    const currentGoal = goals[0] || null;
    setGoal(currentGoal);
    setForm({
      target_new_contracts: currentGoal?.target_new_contracts || 0,
      target_sales_value: currentGoal?.target_sales_value || 0,
    });

    const leads = await base44.entities.Lead.filter({ stage: "venda_fechada" }, "-updated_date", 500);
    const wonThisMonth = leads.filter((l) => (l.updated_date || "").slice(0, 7) === month);
    setProgress({
      contracts: wonThisMonth.length,
      salesValue: wonThisMonth.reduce((sum, l) => sum + (l.estimated_value || 0), 0),
    });
    setLoading(false);
  };

  const handleSave = async () => {
    const data = {
      month: currentMonth(),
      target_new_contracts: Number(form.target_new_contracts) || 0,
      target_sales_value: Number(form.target_sales_value) || 0,
    };
    if (goal) {
      await base44.entities.Goal.update(goal.id, data);
    } else {
      await base44.entities.Goal.create(data);
    }
    setEditing(false);
    await load();
  };

  const contractsPct = form.target_new_contracts > 0 ? Math.min(100, Math.round((progress.contracts / form.target_new_contracts) * 100)) : 0;
  const salesPct = form.target_sales_value > 0 ? Math.min(100, Math.round((progress.salesValue / form.target_sales_value) * 100)) : 0;

  if (loading) return null;

  return (
    <Card title="Metas do Mês" className="p-5 mb-6" action={
      <button onClick={() => setEditing(!editing)} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
        {editing ? <><Check className="w-3.5 h-3.5" /> Fechar</> : <><Pencil className="w-3.5 h-3.5" /> Editar metas</>}
      </button>
    }>
      {editing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 p-3 bg-muted/40 rounded-lg">
          <div>
            <label className="text-xs text-muted-foreground">Meta de novos contratos</label>
            <input
              type="number"
              value={form.target_new_contracts}
              onChange={(e) => setForm({ ...form, target_new_contracts: Number(e.target.value) || 0 })}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Meta de vendas (R$)</label>
            <input
              type="number"
              value={form.target_sales_value}
              onChange={(e) => setForm({ ...form, target_sales_value: Number(e.target.value) || 0 })}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
          <button onClick={handleSave} className="sm:col-span-2 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            Salvar Metas
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-sm font-medium"><Target className="w-4 h-4 text-primary" /> Novos Contratos</span>
            <span className="text-sm text-muted-foreground">{progress.contracts} / {form.target_new_contracts || 0}</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${contractsPct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{contractsPct}% da meta</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-sm font-medium"><Target className="w-4 h-4 text-accent" /> Vendas (R$)</span>
            <span className="text-sm text-muted-foreground">
              {progress.salesValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / {(Number(form.target_sales_value) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${salesPct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{salesPct}% da meta</p>
        </div>
      </div>
    </Card>
  );
}