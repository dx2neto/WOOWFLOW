import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2 } from "lucide-react";
import UraModal from "../UraModal";

export default function UraTab() {
  const [items, setItems] = useState([]);
  const [modalItem, setModalItem] = useState(undefined);
  const load = async () => setItems(await base44.entities.UraMenu.list("-created_date"));
  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    if (data.id) await base44.entities.UraMenu.update(data.id, data);
    else await base44.entities.UraMenu.create(data);
    setModalItem(undefined); load();
  };
  const handleDelete = async (id) => { await base44.entities.UraMenu.delete(id); load(); };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{items.length} menus de URA</p>
        <button onClick={() => setModalItem(null)} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><Plus className="w-4 h-4" /> Nova URA</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((i) => (
          <div key={i.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold">{i.name}</h4>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${i.active ? "text-green-600 bg-green-50" : "text-gray-500 bg-gray-50"}`}>{i.active ? "Ativa" : "Inativa"}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{i.welcome_audio_text}</p>
            <div className="space-y-1 mb-3">
              {(i.options || []).map((opt, idx) => (
                <p key={idx} className="text-xs flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">{opt.digit}</span> {opt.label}</p>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModalItem(i)} className="flex-1 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted flex items-center justify-center gap-1"><Pencil className="w-3.5 h-3.5" /> Editar</button>
              <button onClick={() => handleDelete(i.id)} className="px-3 py-1.5 border border-border rounded-lg hover:bg-muted"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
            </div>
          </div>
        ))}
      </div>
      {modalItem !== undefined && <UraModal item={modalItem} onClose={() => setModalItem(undefined)} onSave={handleSave} />}
    </div>
  );
}