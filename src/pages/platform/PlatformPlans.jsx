import React, { useState, useEffect } from "react";
import { PageContainer, Card } from "@/components/ui/app-card";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Package } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const currency = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PlatformPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("plans")
      .select("*")
      .order("price_monthly", { ascending: true });
    setPlans(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateField = (id, field, value) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const savePlan = async (plan) => {
    setSavingId(plan.id);
    const { error } = await supabase
      .from("plans")
      .update({
        name: plan.name,
        price_monthly: Number(plan.price_monthly) || 0,
        max_users: Number(plan.max_users) || 0,
        max_instances: Number(plan.max_instances) || 0,
        is_active: plan.is_active,
      })
      .eq("id", plan.id);
    setSavingId(null);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Plano atualizado", description: `${plan.name} salvo com sucesso.` });
    }
  };

  return (
    <PageContainer>
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-heading text-foreground">Planos da plataforma</h2>
        <p className="text-sm text-muted-foreground">
          Defina precos, limites e disponibilidade dos planos oferecidos aos assinantes
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {plans.map((plan) => (
            <Card key={plan.id} className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">{currency(plan.price_monthly)}/mes</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`active-${plan.id}`} className="text-xs text-muted-foreground">
                    Ativo
                  </Label>
                  <Switch
                    id={`active-${plan.id}`}
                    checked={!!plan.is_active}
                    onCheckedChange={(v) => updateField(plan.id, "is_active", v)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor={`name-${plan.id}`}>Nome</Label>
                  <Input
                    id={`name-${plan.id}`}
                    value={plan.name || ""}
                    onChange={(e) => updateField(plan.id, "name", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`price-${plan.id}`}>Preco mensal (R$)</Label>
                  <Input
                    id={`price-${plan.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={plan.price_monthly ?? 0}
                    onChange={(e) => updateField(plan.id, "price_monthly", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`users-${plan.id}`}>Max. usuarios</Label>
                  <Input
                    id={`users-${plan.id}`}
                    type="number"
                    min="1"
                    value={plan.max_users ?? 1}
                    onChange={(e) => updateField(plan.id, "max_users", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`inst-${plan.id}`}>Max. instancias</Label>
                  <Input
                    id={`inst-${plan.id}`}
                    type="number"
                    min="1"
                    value={plan.max_instances ?? 1}
                    onChange={(e) => updateField(plan.id, "max_instances", e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button size="sm" onClick={() => savePlan(plan)} disabled={savingId === plan.id}>
                  {savingId === plan.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" aria-hidden="true" />
                      Salvar
                    </>
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
