import React, { useState } from "react";
import { X } from "lucide-react";
import { signalingTypes, linkStatus } from "./constants";

export default function E1GatewayModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item || {
    name: "", ip_address: "", port: 5060, signaling_type: "e1_para_sip", channels_count: 30, operator: "",
    city: "", area_code: "", link_status: "online", linked_trunk: "", inbound_route: "", outbound_route: "",
    channels_available: 0, channels_busy: 0, channels_failed: 0, notes: "",
  });
  const set = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{item ? "Editar" : "Novo"} Gateway E1</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="grid grid-cols-2 gap-3">
          <input required placeholder="Nome do gateway" className="col-span-2 border border-border rounded-lg p-2 text-sm" value={form.name} onChange={(e) => set("name", e.target.value)} />
          <input required placeholder="IP do equipamento" className="border border-border rounded-lg p-2 text-sm" value={form.ip_address} onChange={(e) => set("ip_address", e.target.value)} />
          <input type="number" placeholder="Porta" className="border border-border rounded-lg p-2 text-sm" value={form.port} onChange={(e) => set("port", Number(e.target.value))} />
          <select className="border border-border rounded-lg p-2 text-sm" value={form.signaling_type} onChange={(e) => set("signaling_type", e.target.value)}>
            {Object.entries(signalingTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="number" placeholder="Qtd. de canais" className="border border-border rounded-lg p-2 text-sm" value={form.channels_count} onChange={(e) => set("channels_count", Number(e.target.value))} />
          <input placeholder="Operadora" className="border border-border rounded-lg p-2 text-sm" value={form.operator} onChange={(e) => set("operator", e.target.value)} />
          <input placeholder="Cidade" className="border border-border rounded-lg p-2 text-sm" value={form.city} onChange={(e) => set("city", e.target.value)} />
          <input placeholder="Código de área" className="border border-border rounded-lg p-2 text-sm" value={form.area_code} onChange={(e) => set("area_code", e.target.value)} />
          <select className="border border-border rounded-lg p-2 text-sm" value={form.link_status} onChange={(e) => set("link_status", e.target.value)}>
            {Object.entries(linkStatus).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <input placeholder="Tronco vinculado" className="border border-border rounded-lg p-2 text-sm" value={form.linked_trunk} onChange={(e) => set("linked_trunk", e.target.value)} />
          <input placeholder="Rota de entrada" className="border border-border rounded-lg p-2 text-sm" value={form.inbound_route} onChange={(e) => set("inbound_route", e.target.value)} />
          <input placeholder="Rota de saída" className="border border-border rounded-lg p-2 text-sm" value={form.outbound_route} onChange={(e) => set("outbound_route", e.target.value)} />
          <input type="number" placeholder="Canais disponíveis" className="border border-border rounded-lg p-2 text-sm" value={form.channels_available} onChange={(e) => set("channels_available", Number(e.target.value))} />
          <input type="number" placeholder="Canais ocupados" className="border border-border rounded-lg p-2 text-sm" value={form.channels_busy} onChange={(e) => set("channels_busy", Number(e.target.value))} />
          <textarea placeholder="Observações técnicas" className="col-span-2 border border-border rounded-lg p-2 text-sm" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          <button type="submit" className="col-span-2 py-2 bg-primary text-primary-foreground rounded-lg font-medium">Salvar</button>
        </form>
      </div>
    </div>
  );
}