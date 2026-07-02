import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2 } from "lucide-react";
import OutboundRouteModal from "../OutboundRouteModal";
import { callTypes } from "../constants";

export default function OutboundRoutesTab() {
  const [items, setItems] = useState([]);
  const [modalItem, setModalItem] = useState(undefined);
  const load = async () => setItems(await base44.entities.OutboundRoute.list("-created_date"));
  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    if (data.id) await base44.entities.OutboundRoute.update(data.id, data);
    else await base44.entities.OutboundRoute.create(data);
    setModalItem(undefined); load();
  };
  const handleDelete = async (id) => { await base44.entities.OutboundRoute.delete(id); load(); };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{items.length} rotas de saída</p>
        <button onClick={() => setModalItem(null)} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><Plus className="w-4 h-4" /> Nova Rota</button>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>
            <th className="p-3">Nome</th><th className="p-3">Tipo</th><th className="p-3">Tronco Principal</th><th className="p-3">Limite Simult.</th><th className="p-3">Status</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className="p-3 font-medium">{i.name}</td>
                <td className="p-3">{callTypes[i.call_type]}</td>
                <td className="p-3 text-muted-foreground">{i.primary_trunk}</td>
                <td className="p-3">{i.max_simultaneous_calls}</td>
                <td className="p-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${i.active ? "text-green-600 bg-green-50" : "text-gray-500 bg-gray-50"}`}>{i.active ? "Ativa" : "Inativa"}</span>
                </td>
                <td className="p-3 flex gap-2">
                  <button onClick={() => setModalItem(i)}><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                  <button onClick={() => handleDelete(i.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modalItem !== undefined && <OutboundRouteModal item={modalItem} onClose={() => setModalItem(undefined)} onSave={handleSave} />}
    </div>
  );
}