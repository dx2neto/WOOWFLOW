import React, { useState } from "react";
import { X, Save } from "lucide-react";

export default function HolidayFormModal({ onSave, onClose }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [recurring, setRecurring] = useState(true);
  const [saving, setSaving] = useState(false);

  const field = "w-full h-10 px-3 bg-muted/60 rounded-lg text-sm border border-transparent focus:border-primary focus:bg-card focus:outline-none";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !date) return;
    setSaving(true);
    await onSave({ name, date, recurring });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold font-heading">Novo Feriado</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nome *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Natal" className={field} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Data *</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="w-4 h-4 accent-primary" />
            <span className="text-sm">Repete todo ano</span>
          </label>
          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-10 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}