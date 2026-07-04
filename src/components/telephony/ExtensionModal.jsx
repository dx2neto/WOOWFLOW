import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X } from "lucide-react";
import { extensionPermissions } from "./constants";

const forwardTypes = { sempre: "Sempre", ocupado: "Quando Ocupado", sem_resposta: "Sem Resposta", indisponivel: "Indisponível" };

export default function ExtensionModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item || {
    number: "", attendant_name: "", user_id: "", sector: "", permissions: [], status: "offline",
    forward_enabled: false, forward_type: "sempre", forward_destination: "", active: true,
  });
  const [users, setUsers] = useState([]);

  useEffect(() => {
    base44.entities.User.list().then(setUsers);
  }, []);

  const set = (k, v) => setForm({ ...form, [k]: v });
  const togglePerm = (key) => {
    const list = form.permissions || [];
    set("permissions", list.includes(key) ? list.filter((p) => p !== key) : [...list, key]);
  };

  const handleUserChange = (userId) => {
    const u = users.find((usr) => usr.id === userId);
    setForm({ ...form, user_id: userId, attendant_name: u ? u.full_name : form.attendant_name });
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
            <select className="border border-border rounded-lg p-2 text-sm" value={form.user_id || ""} onChange={(e) => handleUserChange(e.target.value)}>
              <option value="">Selecione o colaborador...</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            <input required placeholder="Nome do atendente" className="border border-border rounded-lg p-2 text-sm" value={form.attendant_name} onChange={(e) => set("attendant_name", e.target.value)} />
            <input placeholder="Setor" className="border border-border rounded-lg p-2 text-sm" value={form.sector} onChange={(e) => set("sector", e.target.value)} />
            <select className="border border-border rounded-lg p-2 text-sm" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="online">Online</option><option value="offline">Offline</option><option value="ocupado">Ocupado</option><option value="pausa">Pausa</option>
            </select>
          </div>

          <div className="border border-border rounded-lg p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.forward_enabled} onChange={(e) => set("forward_enabled", e.target.checked)} /> Ativar desvio de chamadas
            </label>
            {form.forward_enabled && (
              <div className="grid grid-cols-2 gap-3">
                <select className="border border-border rounded-lg p-2 text-sm" value={form.forward_type} onChange={(e) => set("forward_type", e.target.value)}>
                  {Object.entries(forwardTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input placeholder="Destino (ramal, fila ou número)" className="border border-border rounded-lg p-2 text-sm" value={form.forward_destination} onChange={(e) => set("forward_destination", e.target.value)} />
              </div>
            )}
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