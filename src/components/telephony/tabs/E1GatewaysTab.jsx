import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2 } from "lucide-react";
import E1GatewayModal from "../E1GatewayModal";
import { LinkStatusBadge } from "../TelephonyBadges";

export default function E1GatewaysTab() {
  const [items, setItems] = useState([]);
  const [modalItem, setModalItem] = useState(undefined);
  const load = async () => setItems(await base44.entities.E1Gateway.list("-created_date"));
  useEffect(() => { load(); }, []);

  const handleSave = async (data) => {
    if (data.id) await base44.entities.E1Gateway.update(data.id, data);
    else await base44.entities.E1Gateway.create(data);
    setModalItem(undefined); load();
  };
  const handleDelete = async (id) => { await base44.entities.E1Gateway.delete(id); load(); };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{items.length} gateways cadastrados</p>
        <button onClick={() => setModalItem(null)} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"><Plus className="w-4 h-4" /> Novo Gateway</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((i) => (
          <div key={i.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold">{i.name}</h4>
              <LinkStatusBadge status={i.link_status} />
            </div>
            <p className="text-xs text-muted-foreground mb-3">{i.ip_address}:{i.port} · {i.city}</p>
            <div className="grid grid-cols-3 gap-2 text-xs mb-3">
              <div className="bg-muted/50 rounded-lg p-2 text-center"><p className="font-bold">{i.channels_available}</p><p className="text-muted-foreground">Livres</p></div>
              <div className="bg-muted/50 rounded-lg p-2 text-center"><p className="font-bold">{i.channels_busy}</p><p className="text-muted-foreground">Ocupados</p></div>
              <div className="bg-muted/50 rounded-lg p-2 text-center"><p className="font-bold">{i.channels_failed}</p><p className="text-muted-foreground">Falha</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModalItem(i)} className="flex-1 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted flex items-center justify-center gap-1"><Pencil className="w-3.5 h-3.5" /> Editar</button>
              <button onClick={() => handleDelete(i.id)} className="px-3 py-1.5 border border-border rounded-lg hover:bg-muted"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
            </div>
          </div>
        ))}
      </div>
      {modalItem !== undefined && <E1GatewayModal item={modalItem} onClose={() => setModalItem(undefined)} onSave={handleSave} />}
    </div>
  );
}