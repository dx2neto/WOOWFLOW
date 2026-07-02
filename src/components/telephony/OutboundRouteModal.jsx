import React, { useState } from "react";
import { X } from "lucide-react";
import { callTypes } from "./constants";

export default function OutboundRouteModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item || {
    name: "", dialing_prefix: "", call_type: "local", primary_trunk: "", secondary_trunk: "", contingency_trunk: "",
    area_code: "", city: "", preferred_operator: "", caller_id: "", allowed_hours: "", max_simultaneous_calls: 5, active: true,
  });
  const set = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{item ? "Editar" : "Nova"} Rota de Saída</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="grid grid-cols-2 gap-3">
          <input required placeholder="Nome da rota" className="col-span-2 border border-border rounded-lg p-2 text-sm" value={form.name} onChange={(e) => set("name", e.target.value)} />
          <input placeholder="Prefixo de discagem" className="border border-border rounded-lg p-2 text-sm" value={form.dialing_prefix} onChange={(e) => set("dialing_prefix", e.target.value)} />
          <select className="border border-border rounded-lg p-2 text-sm" value={form.call_type} onChange={(e) => set("call_type", e.target.value)}>
            {Object.entries(callTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input placeholder="Tronco principal" className="border border-border rounded-lg p-2 text-sm" value={form.primary_trunk} onChange={(e) => set("primary_trunk", e.target.value)} />
          <input placeholder="Tronco secundário" className="border border-border rounded-lg p-2 text-sm" value={form.secondary_trunk} onChange={(e) => set("secondary_trunk", e.target.value)} />
          <input placeholder="Tronco de contingência" className="border border-border rounded-lg p-2 text-sm" value={form.contingency_trunk} onChange={(e) => set("contingency_trunk", e.target.value)} />
          <input placeholder="Código de área" className="border border-border rounded-lg p-2 text-sm" value={form.area_code} onChange={(e) => set("area_code", e.target.value)} />
          <input placeholder="Cidade" className="border border-border rounded-lg p-2 text-sm" value={form.city} onChange={(e) => set("city", e.target.value)} />
          <input placeholder="Operadora preferencial" className="border border-border rounded-lg p-2 text-sm" value={form.preferred_operator} onChange={(e) => set("preferred_operator", e.target.value)} />
          <input placeholder="Caller ID" className="border border-border rounded-lg p-2 text-sm" value={form.caller_id} onChange={(e) => set("caller_id", e.target.value)} />
          <input placeholder="Horário permitido" className="border border-border rounded-lg p-2 text-sm" value={form.allowed_hours} onChange={(e) => set("allowed_hours", e.target.value)} />
          <input type="number" placeholder="Limite simultâneo" className="border border-border rounded-lg p-2 text-sm" value={form.max_simultaneous_calls} onChange={(e) => set("max_simultaneous_calls", Number(e.target.value))} />
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Ativo
          </label>
          <button type="submit" className="col-span-2 py-2 bg-primary text-primary-foreground rounded-lg font-medium">Salvar</button>
        </form>
      </div>
    </div>
  );
}