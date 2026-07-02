import React, { useState } from "react";
import { X, Save } from "lucide-react";

const COLORS = [
  { key: "blue", class: "bg-blue-500" },
  { key: "green", class: "bg-green-500" },
  { key: "red", class: "bg-red-500" },
  { key: "yellow", class: "bg-yellow-500" },
  { key: "purple", class: "bg-purple-500" },
  { key: "gray", class: "bg-gray-500" },
  { key: "orange", class: "bg-orange-500" },
  { key: "pink", class: "bg-pink-500" },
];

export default function TagFormModal({ tag, onSave, onClose }) {
  const [name, setName] = useState(tag?.name || "");
  const [color, setColor] = useState(tag?.color || "blue");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    await onSave({ name, color });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold font-heading">{tag ? "Editar Etiqueta" : "Nova Etiqueta"}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nome *</label>
            <input
              type="text" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Urgente"
              className="w-full h-10 px-3 bg-muted/60 rounded-lg text-sm border border-transparent focus:border-primary focus:bg-card focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Cor</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.key} type="button" onClick={() => setColor(c.key)}
                  className={`w-8 h-8 rounded-full ${c.class} ring-2 ring-offset-2 ${color === c.key ? "ring-primary" : "ring-transparent"}`}
                />
              ))}
            </div>
          </div>
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