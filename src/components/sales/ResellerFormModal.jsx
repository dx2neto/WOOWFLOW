import React, { useState } from "react";
import { X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function ResellerFormModal({ show, reseller, onClose, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
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
    notes: reseller?.notes || "",
  }));

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
      <div className="relative bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold font-heading">{reseller ? "Editar Revendedor" : "Novo Revendedor"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
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
              <input className="input-base" value={form.ixc_vendor_id} onChange={e => setForm(f => ({ ...f, ixc_vendor_id: e.target.value }))} />
            </Field>
          </div>
          <Field label="Observações">
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