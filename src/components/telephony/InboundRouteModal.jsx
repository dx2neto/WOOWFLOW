import React, { useState } from "react";
import { X } from "lucide-react";
import { destinationTypes } from "./constants";

export default function InboundRouteModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item || {
    name: "", did_number: "", public_number: "", inbound_trunk: "", city: "", respect_business_hours: true,
    respect_holidays: true, main_destination_type: "ura", main_destination_value: "", after_hours_destination: "",
    failure_destination: "", priority: 1, active: true, record_call: true, auto_protocol: true,
  });
  const set = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{item ? "Editar" : "Nova"} Rota de Entrada</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="grid grid-cols-2 gap-3">
          <input required placeholder="Nome da rota" className="col-span-2 border border-border rounded-lg p-2 text-sm" value={form.name} onChange={(e) => set("name", e.target.value)} />
          <input required placeholder="Número DID" className="border border-border rounded-lg p-2 text-sm" value={form.did_number} onChange={(e) => set("did_number", e.target.value)} />
          <input placeholder="Número público" className="border border-border rounded-lg p-2 text-sm" value={form.public_number} onChange={(e) => set("public_number", e.target.value)} />
          <input placeholder="Tronco de entrada" className="border border-border rounded-lg p-2 text-sm" value={form.inbound_trunk} onChange={(e) => set("inbound_trunk", e.target.value)} />
          <input placeholder="Cidade" className="border border-border rounded-lg p-2 text-sm" value={form.city} onChange={(e) => set("city", e.target.value)} />
          <select className="border border-border rounded-lg p-2 text-sm" value={form.main_destination_type} onChange={(e) => set("main_destination_type", e.target.value)}>
            {Object.entries(destinationTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input placeholder="Destino principal (valor)" className="border border-border rounded-lg p-2 text-sm" value={form.main_destination_value} onChange={(e) => set("main_destination_value", e.target.value)} />
          <input placeholder="Destino fora do horário" className="border border-border rounded-lg p-2 text-sm" value={form.after_hours_destination} onChange={(e) => set("after_hours_destination", e.target.value)} />
          <input placeholder="Destino em caso de falha" className="border border-border rounded-lg p-2 text-sm" value={form.failure_destination} onChange={(e) => set("failure_destination", e.target.value)} />
          <input type="number" placeholder="Prioridade" className="border border-border rounded-lg p-2 text-sm" value={form.priority} onChange={(e) => set("priority", Number(e.target.value))} />
          <div className="col-span-2 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.respect_business_hours} onChange={(e) => set("respect_business_hours", e.target.checked)} /> Respeitar horário</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.respect_holidays} onChange={(e) => set("respect_holidays", e.target.checked)} /> Respeitar feriados</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.record_call} onChange={(e) => set("record_call", e.target.checked)} /> Gravar chamada</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.auto_protocol} onChange={(e) => set("auto_protocol", e.target.checked)} /> Gerar protocolo</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Ativo</label>
          </div>
          <button type="submit" className="col-span-2 py-2 bg-primary text-primary-foreground rounded-lg font-medium">Salvar</button>
        </form>
      </div>
    </div>
  );
}