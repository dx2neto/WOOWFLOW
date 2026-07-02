import React, { useState } from "react";
import { X } from "lucide-react";
import { trunkTypes, trunkStatus } from "./constants";

export default function SipTrunkModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item || {
    name: "", trunk_type: "sip_trunk", operator: "", host: "", port: 5060, sip_user: "", sip_password: "",
    sip_domain: "", caller_id: "", operator_code: "", codecs: [], dtmf_mode: "rfc2833", transport: "udp",
    max_channels: 10, status: "offline", active: true, notes: "",
  });
  const set = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{item ? "Editar" : "Novo"} Tronco SIP</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="grid grid-cols-2 gap-3">
          <input required placeholder="Nome do tronco" className="col-span-2 border border-border rounded-lg p-2 text-sm" value={form.name} onChange={(e) => set("name", e.target.value)} />
          <select className="border border-border rounded-lg p-2 text-sm" value={form.trunk_type} onChange={(e) => set("trunk_type", e.target.value)}>
            {Object.entries(trunkTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input placeholder="Operadora" className="border border-border rounded-lg p-2 text-sm" value={form.operator} onChange={(e) => set("operator", e.target.value)} />
          <input placeholder="Host/IP" className="border border-border rounded-lg p-2 text-sm" value={form.host} onChange={(e) => set("host", e.target.value)} />
          <input type="number" placeholder="Porta" className="border border-border rounded-lg p-2 text-sm" value={form.port} onChange={(e) => set("port", Number(e.target.value))} />
          <input placeholder="Usuário SIP" className="border border-border rounded-lg p-2 text-sm" value={form.sip_user} onChange={(e) => set("sip_user", e.target.value)} />
          <input type="password" placeholder="Senha SIP" className="border border-border rounded-lg p-2 text-sm" value={form.sip_password} onChange={(e) => set("sip_password", e.target.value)} />
          <input placeholder="Domínio SIP" className="border border-border rounded-lg p-2 text-sm" value={form.sip_domain} onChange={(e) => set("sip_domain", e.target.value)} />
          <input placeholder="Caller ID padrão" className="border border-border rounded-lg p-2 text-sm" value={form.caller_id} onChange={(e) => set("caller_id", e.target.value)} />
          <input placeholder="Código da operadora" className="border border-border rounded-lg p-2 text-sm" value={form.operator_code} onChange={(e) => set("operator_code", e.target.value)} />
          <input placeholder="Codecs (separado por vírgula)" className="col-span-2 border border-border rounded-lg p-2 text-sm" value={(form.codecs || []).join(", ")} onChange={(e) => set("codecs", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
          <select className="border border-border rounded-lg p-2 text-sm" value={form.dtmf_mode} onChange={(e) => set("dtmf_mode", e.target.value)}>
            <option value="rfc2833">RFC2833</option><option value="info">INFO</option><option value="inband">Inband</option>
          </select>
          <select className="border border-border rounded-lg p-2 text-sm" value={form.transport} onChange={(e) => set("transport", e.target.value)}>
            <option value="udp">UDP</option><option value="tcp">TCP</option><option value="tls">TLS</option>
          </select>
          <input type="number" placeholder="Limite de canais" className="border border-border rounded-lg p-2 text-sm" value={form.max_channels} onChange={(e) => set("max_channels", Number(e.target.value))} />
          <select className="border border-border rounded-lg p-2 text-sm" value={form.status} onChange={(e) => set("status", e.target.value)}>
            {Object.entries(trunkStatus).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <textarea placeholder="Observações" className="col-span-2 border border-border rounded-lg p-2 text-sm" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Ativo
          </label>
          <button type="submit" className="col-span-2 py-2 bg-primary text-primary-foreground rounded-lg font-medium">Salvar</button>
        </form>
      </div>
    </div>
  );
}