import React, { useState } from "react";
import { X } from "lucide-react";

export default function LeadFormModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: "", phone: "", email: "", city: "", plan_interest: "", estimated_value: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setSaving(true);
    try {
      await onSave({ ...form, estimated_value: form.estimated_value ? Number(form.estimated_value) : 0 });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold font-heading">Novo Lead</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required placeholder="Nome" value={form.name} onChange={set("name")} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          <input required placeholder="Telefone" value={form.phone} onChange={set("phone")} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          <input placeholder="Email" value={form.email} onChange={set("email")} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          <input placeholder="Cidade" value={form.city} onChange={set("city")} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          <input placeholder="Plano de interesse" value={form.plan_interest} onChange={set("plan_interest")} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          <input type="number" placeholder="Valor estimado" value={form.estimated_value} onChange={set("estimated_value")} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}