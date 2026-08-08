import React, { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { salesPipelineApi } from "@/functions/salesPipelineApi";

export default function NewSaleModal({ show, onClose, onCreated, resellers = [] }) {
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    customer_name: "", cpf_cnpj: "", phone: "", email: "",
    plan_name: "", monthly_fee: "", installation_address: "", city: "", neighborhood: "",
    reseller_id: "", vendor_name: "", notes: "", sale_type: "direta", commission_rate: "",
  });

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.cpf_cnpj.trim() || !form.phone.trim()) {
      toast({ title: "Preencha nome, CPF/CNPJ e telefone", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const reseller = resellers.find(r => r.id === form.reseller_id);
      const finalSaleType = form.sale_type === "revenda" || reseller ? "revenda" : "direta";
      const resp = await salesPipelineApi({
        action: "start_sale",
        ...form,
        sale_type: finalSaleType,
        commission_rate: form.commission_rate ? Number(form.commission_rate) : undefined,
        monthly_fee: form.monthly_fee ? Number(form.monthly_fee) : undefined,
        reseller_name: reseller?.name || "",
      });
      if (resp?.data?.success === false) {
        toast({ title: "Erro ao criar venda", description: resp.data.error, variant: "destructive" });
      } else {
        toast({ title: "Venda criada com sucesso" });
        setForm({ customer_name: "", cpf_cnpj: "", phone: "", email: "", plan_name: "", monthly_fee: "", installation_address: "", city: "", neighborhood: "", reseller_id: "", vendor_name: "", notes: "", sale_type: "direta", commission_rate: "" });
        onCreated();
      }
    } catch {
      toast({ title: "Erro ao criar venda", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold font-heading">Nova Venda</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome do Cliente *">
              <input className="input-base" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="João da Silva" />
            </Field>
            <Field label="CPF/CNPJ *">
              <input className="input-base" value={form.cpf_cnpj} onChange={e => setForm(f => ({ ...f, cpf_cnpj: e.target.value }))} placeholder="000.000.000-00" />
            </Field>
            <Field label="Telefone *">
              <input className="input-base" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(11) 99999-9999" />
            </Field>
            <Field label="E-mail">
              <input className="input-base" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="cliente@email.com" />
            </Field>
            <Field label="Plano">
              <input className="input-base" value={form.plan_name} onChange={e => setForm(f => ({ ...f, plan_name: e.target.value }))} placeholder="Fibra 500MB" />
            </Field>
            <Field label="Mensalidade (R$)">
              <input className="input-base" type="number" step="0.01" value={form.monthly_fee} onChange={e => setForm(f => ({ ...f, monthly_fee: e.target.value }))} placeholder="99,90" />
            </Field>
            <Field label="Cidade">
              <input className="input-base" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="São Paulo" />
            </Field>
            <Field label="Bairro">
              <input className="input-base" value={form.neighborhood} onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))} placeholder="Centro" />
            </Field>
          </div>
          <Field label="Endereço de Instalação">
            <input className="input-base" value={form.installation_address} onChange={e => setForm(f => ({ ...f, installation_address: e.target.value }))} placeholder="Rua, número" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de Venda">
              <select className="input-base" value={form.sale_type} onChange={e => setForm(f => ({ ...f, sale_type: e.target.value, reseller_id: e.target.value === "direta" ? "" : f.reseller_id }))}>
                <option value="direta">Venda Direta</option>
                <option value="revenda">Venda Revenda</option>
              </select>
            </Field>
            <Field label="Vendedor">
              <input className="input-base" value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} placeholder="Nome do vendedor" />
            </Field>
          </div>
          {form.sale_type === "revenda" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Revendedor">
                <select className="input-base" value={form.reseller_id} onChange={e => setForm(f => ({ ...f, reseller_id: e.target.value }))}>
                  <option value="">— Selecionar —</option>
                  {resellers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="Comissão (%)">
                <input className="input-base" type="number" step="0.1" value={form.commission_rate} onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))} placeholder="10" />
              </Field>
            </div>
          )}
          <Field label="Observações">
            <textarea className="input-base min-h-[60px]" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </Field>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={creating}>{creating ? "Criando..." : "Criar Venda"}</Button>
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