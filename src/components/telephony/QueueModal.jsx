import React, { useState } from "react";
import { X } from "lucide-react";
import { queueStrategies } from "./constants";

export default function QueueModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item || { name: "", sector: "", strategy: "roundrobin", max_wait_time: 120, music_on_hold: "", extensions: [], active: true });
  const set = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{item ? "Editar" : "Nova"} Fila</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="grid grid-cols-2 gap-3">
          <input required placeholder="Nome da fila" className="col-span-2 border border-border rounded-lg p-2 text-sm" value={form.name} onChange={(e) => set("name", e.target.value)} />
          <input required placeholder="Setor" className="border border-border rounded-lg p-2 text-sm" value={form.sector} onChange={(e) => set("sector", e.target.value)} />
          <select className="border border-border rounded-lg p-2 text-sm" value={form.strategy} onChange={(e) => set("strategy", e.target.value)}>
            {Object.entries(queueStrategies).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="number" placeholder="Tempo máx. de espera (s)" className="border border-border rounded-lg p-2 text-sm" value={form.max_wait_time} onChange={(e) => set("max_wait_time", Number(e.target.value))} />
          <input placeholder="Música de espera" className="border border-border rounded-lg p-2 text-sm" value={form.music_on_hold} onChange={(e) => set("music_on_hold", e.target.value)} />
          <input placeholder="Ramais (separados por vírgula)" className="col-span-2 border border-border rounded-lg p-2 text-sm" value={(form.extensions || []).join(", ")} onChange={(e) => set("extensions", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Ativa
          </label>
          <button type="submit" className="col-span-2 py-2 bg-primary text-primary-foreground rounded-lg font-medium">Salvar</button>
        </form>
      </div>
    </div>
  );
}