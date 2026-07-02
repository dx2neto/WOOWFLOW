import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { CallStatusBadge } from "../TelephonyBadges";
import { callStatus } from "../constants";
import CallDetailPanel from "../CallDetailPanel";
import moment from "moment";

const filters = ["todas", ...Object.keys(callStatus)];

export default function CallsInboxTab() {
  const [calls, setCalls] = useState([]);
  const [filter, setFilter] = useState("todas");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    base44.entities.Call.list("-start_time", 100).then(setCalls);
  }, []);

  const filtered = filter === "todas" ? calls : calls.filter((c) => c.status === filter);

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
            {f === "todas" ? "Todas" : callStatus[f].label}
          </button>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>
            <th className="p-3">Cliente</th><th className="p-3">Telefone</th><th className="p-3">Direção</th><th className="p-3">Fila/Ramal</th><th className="p-3">Protocolo</th><th className="p-3">Status</th><th className="p-3">Horário</th>
          </tr></thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} onClick={() => setSelected(c)} className="border-t border-border cursor-pointer hover:bg-muted/40">
                <td className="p-3 font-medium">{c.customer_name || "Não identificado"}</td>
                <td className="p-3 text-muted-foreground">{c.phone}</td>
                <td className="p-3">
                  {c.direction === "entrada" ? <PhoneIncoming className="w-4 h-4 text-green-600" /> : <PhoneOutgoing className="w-4 h-4 text-blue-600" />}
                </td>
                <td className="p-3 text-muted-foreground">{c.queue_name || c.extension}</td>
                <td className="p-3 text-muted-foreground">{c.protocol}</td>
                <td className="p-3"><CallStatusBadge status={c.status} /></td>
                <td className="p-3 text-muted-foreground">{c.start_time ? moment(c.start_time).format("DD/MM HH:mm") : "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma ligação encontrada</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {selected && <CallDetailPanel call={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}