import React, { useState } from "react";
import { X } from "lucide-react";

export default function BillingRuleFormModal({ rule, onClose, onSave }) {
  const [form, setForm] = useState({
    name: rule?.name || "",
    days_offset: rule?.days_offset ?? -2,
    message_template: rule?.message_template || "",
    active: rule?.active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, days_offset: Number(form.days_offset) });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold font-heading">{rule ? "Editar Regra" : "Nova Regra"}</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Nome da regra</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="Ex: Aviso 2 dias antes"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Dias em relação ao vencimento</label>
            <input
              type="number"
              value={form.days_offset}
              onChange={(e) => setForm({ ...form, days_offset: e.target.value })}
              required
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="Negativo = antes, positivo = após"
            />
            <p className="text-xs text-muted-foreground mt-1">Ex: -2 envia 2 dias antes do vencimento, 3 envia 3 dias após o vencimento.</p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Mensagem</label>
            <textarea
              value={form.message_template}
              onChange={(e) => setForm({ ...form, message_template: e.target.value })}
              required
              rows={4}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              placeholder="Use {customer_name}, {value} e {due_date}"
            />
            <p className="text-xs text-muted-foreground mt-1">Variáveis disponíveis: {"{customer_name}"}, {"{value}"}, {"{due_date}"}</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Regra ativa
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}