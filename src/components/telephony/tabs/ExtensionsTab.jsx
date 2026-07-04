import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, PhoneForwarded } from "lucide-react";
import ExtensionModal from "../ExtensionModal";

const statusColor = { online: "text-green-600 bg-green-50", offline: "text-gray-500 bg-gray-50", ocupado: "text-amber-600 bg-amber-50", pausa: "text-purple-600 bg-purple-50" };

export default function ExtensionsTab() {
  const [items, setItems] = useState([]);
  const [modalItem, setModalItem] = useState(undefined);
  const load = async () => setItems(await base44.entities.Extension.list("number"));
  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    if (data.id) await base44.entities.Extension.update(data.id, data);
    else await base44.entities.Extension.create(data);
    setModalItem(undefined); load();
  };
  const handleDelete = async (id) => { await base44.entities.Extension.delete(id); load(); };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{items.length} ramais cadastrados</p>
        <button onClick={() => setModalItem(null)} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><Plus className="w-4 h-4" /> Novo Ramal</button>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>
            <th className="p-3">Ramal</th><th className="p-3">Atendente</th><th className="p-3">Setor</th><th className="p-3">Status</th><th className="p-3">Desvio</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className="p-3 font-medium">{i.number}</td>
                <td className="p-3">{i.attendant_name}</td>
                <td className="p-3 text-muted-foreground">{i.sector}</td>
                <td className="p-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor[i.status]}`}>{i.status}</span></td>
                <td className="p-3">
                  {i.forward_enabled ? (
                    <span className="flex items-center gap-1 text-xs text-primary font-medium"><PhoneForwarded className="w-3.5 h-3.5" /> {i.forward_destination}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
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
      {modalItem !== undefined && <ExtensionModal item={modalItem} onClose={() => setModalItem(undefined)} onSave={handleSave} />}
    </div>
  );
}