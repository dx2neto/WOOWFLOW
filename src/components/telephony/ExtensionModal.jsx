import React, { useState } from "react";
import { X } from "lucide-react";
import { extensionPermissions } from "./constants";

export default function ExtensionModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item || { number: "", attendant_name: "", sector: "", permissions: [], status: "offline", active: true });
  const set = (k, v) => setForm({ ...form, [k]: v });
  const togglePerm = (key) => {
    const list = form.permissions || [];
    set("permissions", list.includes(key) ? list.filter((p) => p !== key) : [...list, key]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{item ? "Editar" : "Novo"} Ramal</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="Número do ramal" className="border border-border rounded-lg p-2 text-sm" value={form.number} onChange={(e) => set("number", e.target.value)} />
            <input required placeholder="Nome do atendente" className="border border-border rounded-lg p-2 text-sm" value={form.attendant_name} onChange={(e) => set("attendant_name", e.target.value)} />
            <input placeholder="Setor" className="border border-border rounded-lg p-2 text-sm" value={form.sector} onChange={(e) => set("sector", e.target.value)} />
            <select className="border border-border rounded-lg p-2 text-sm" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="online">Online</option><option value="offline">Offline</option><option value="ocupado">Ocupado</option><option value="pausa">Pausa</option>
            </select>
          </div>
          <p className="text-sm font-medium">Permissões</p>
          <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
            {Object.entries(extensionPermissions).map(([k, v]) => (
              <label key={k} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={(form.permissions || []).includes(k)} onChange={() => togglePerm(k)} /> {v}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Ativo
          </label>
          <button type="submit" className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium">Salvar</button>
        </form>
      </div>
    </div>
  );
}