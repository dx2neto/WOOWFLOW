import React, { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function ResellerFormModal({ show, reseller, onClose, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState([]);

  const [form, setForm] = useState(() => ({
    name: reseller?.name || "",
    cpf_cnpj: reseller?.cpf_cnpj || "",
    person_type: reseller?.person_type || "pessoa_fisica",
    phone: reseller?.phone || "",
    email: reseller?.email || "",
    city: reseller?.city || "",
    address: reseller?.address || "",
    commission_rate: reseller?.commission_rate || 0,
    status: reseller?.status || "pendente",
    ixc_vendor_id: reseller?.ixc_vendor_id || "",
    plans_config: reseller?.plans_config || "[]",
    notes: reseller?.notes || "",
  }));

  const plans = (() => {
    try { return JSON.parse(form.plans_config || "[]"); } catch { return []; }
  })();
  const updatePlan = (idx, field, value) => {
    const next = plans.map((p, i) => i === idx ? { ...p, [field]: value } : p);
    setForm(f => ({ ...f, plans_config: JSON.stringify(next) }));
  };
  const addPlan = () => {
    const next = [...plans, { plan_name: "", ixc_plan_id: "", contract_template_id: "", terms: "" }];
    setForm(f => ({ ...f, plans_config: JSON.stringify(next) }));
  };
  const removePlan = (idx) => {
    const next = plans.filter((_, i) => i !== idx);
    setForm(f => ({ ...f, plans_config: JSON.stringify(next) }));
  };

  useEffect(() => {
    if (!show) return;
    base44.entities.ContractTemplate.list("-usage_count", 100)
      .then(setTemplates)
      .catch(() => {});
  }, [show]);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: "Preencha nome e telefone", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...form,
        commission_rate: Number(form.commission_rate) || 0,
        cpf_cnpj: form.cpf_cnpj.replace(/\D/g, ""),
      };
      if (reseller) {
        await base44.entities.Reseller.update(reseller.id, data);
        toast({ title: "Revendedor atualizado" });
      } else {
        await base44.entities.Reseller.create(data);
        toast({ title: "Revendedor cadastrado" });
      }
      onSaved();
    } catch {
      toast({ title: "Erro ao salvar revendedor", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-bold font-heading">{reseller ? "Editar Revendedor" : "Novo Revendedor"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Dados principais */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome / Razão Social *">
              <input className="input-base" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="CPF/CNPJ">
              <input className="input-base" value={form.cpf_cnpj} onChange={e => setForm(f => ({ ...f, cpf_cnpj: e.target.value }))} />
            </Field>
            <Field label="Tipo de Pessoa">
              <select className="input-base" value={form.person_type} onChange={e => setForm(f => ({ ...f, person_type: e.target.value }))}>
                <option value="pessoa_fisica">Pessoa Física</option>
                <option value="pessoa_juridica">Pessoa Jurídica</option>
              </select>
            </Field>
            <Field label="Status">
              <select className="input-base" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="pendente">Pendente</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="bloqueado">Bloqueado</option>
              </select>
            </Field>
            <Field label="Telefone *">
              <input className="input-base" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(11) 99999-9999" />
            </Field>
            <Field label="E-mail">
              <input className="input-base" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="Cidade">
              <input className="input-base" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </Field>
            <Field label="Endereço">
              <input className="input-base" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </Field>
            <Field label="Comissão (%)">
              <input className="input-base" type="number" step="0.1" value={form.commission_rate} onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))} />
            </Field>
            <Field label="ID Vendedor IXC">
              <input className="input-base" value={form.ixc_vendor_id} onChange={e => setForm(f => ({ ...f, ixc_vendor_id: e.target.value }))} placeholder="ID do vendedor no IXCSoft" />
            </Field>
          </div>

          {/* Planos e Contratos */}
          <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Planos, Contratos e Termos</h3>
                <p className="text-xs text-muted-foreground">Vincule planos do IXC com templates de contrato e termos</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addPlan}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Plano
              </Button>
            </div>

            {plans.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-3">Nenhum plano vinculado. Clique em "Adicionar Plano".</p>
            ) : (
              <div className="space-y-3">
                {plans.map((plan, idx) => (
                  <div key={idx} className="bg-card border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground">Plano #{idx + 1}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePlan(idx)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Nome do Plano">
                        <input className="input-base" value={plan.plan_name} onChange={e => updatePlan(idx, "plan_name", e.target.value)} placeholder="Ex: Fibra 500MB" />
                      </Field>
                      <Field label="ID Plano IXC">
                        <input className="input-base" value={plan.ixc_plan_id} onChange={e => updatePlan(idx, "ixc_plan_id", e.target.value)} placeholder="ID no IXCSoft" />
                      </Field>
                    </div>
                    <Field label="Template de Contrato">
                      <select className="input-base" value={plan.contract_template_id} onChange={e => updatePlan(idx, "contract_template_id", e.target.value)}>
                        <option value="">Selecione um template...</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Termos / Observações do Contrato">
                      <textarea className="input-base min-h-[50px]" value={plan.terms} onChange={e => updatePlan(idx, "terms", e.target.value)} placeholder="Condições especiais, vigência, etc." />
                    </Field>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Field label="Observações Gerais">
            <textarea className="input-base min-h-[60px]" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </Field>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      {children}
    </div>
  );
}