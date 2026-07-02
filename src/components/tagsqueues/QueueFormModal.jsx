import React, { useState } from "react";
import { X, Save } from "lucide-react";

const SECTORS = ["Comercial", "Suporte Técnico", "Financeiro", "Cobrança", "Retenção", "Pós-venda", "Agendamento", "Ouvidoria", "NOC", "Administrativo"];

export default function QueueFormModal({ queue, onSave, onClose }) {
  const [name, setName] = useState(queue?.name || "");
  const [sector, setSector] = useState(queue?.sector || SECTORS[0]);
  const [description, setDescription] = useState(queue?.description || "");
  const [active, setActive] = useState(queue?.active !== false);
  const [saving, setSaving] = useState(false);

  const field = "w-full h-10 px-3 bg-muted/60 rounded-lg text-sm border border-transparent focus:border-primary focus:bg-card focus:outline-none";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    await onSave({ name, sector, description, active });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold font-heading">{queue ? "Editar Fila" : "Nova Fila"}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nome *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Fila Suporte N1" className={field} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Setor *</label>
            <select value={sector} onChange={(e) => setSector(e.target.value)} className={field}>
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Descrição</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição da fila" className={field} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 accent-primary" />
            <span className="text-sm">Fila ativa</span>
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