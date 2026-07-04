import React, { useState } from "react";
import { X } from "lucide-react";

export default function FlowFormModal({ flow, onClose, onSave }) {
  const [form, setForm] = useState({
    name: flow?.name || "", channel: flow?.channel || "WhatsApp", steps: flow?.steps || 1,
  });

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) return;
    onSave({ ...form, steps: Number(form.steps) || 1 });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold font-heading">{flow ? "Editar Fluxo" : "Novo Fluxo"}</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required placeholder="Nome do fluxo" value={form.name} onChange={set("name")} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          <select value={form.channel} onChange={set("channel")} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
            <option value="WhatsApp">WhatsApp</option>
            <option value="Instagram">Instagram</option>
          </select>
          <input type="number" min="1" placeholder="Etapas" value={form.steps} onChange={set("steps")} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancelar</button>
            <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}