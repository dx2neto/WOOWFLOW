import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PhoneMissed, PhoneCall } from "lucide-react";

export default function MissedCallsAlertPanel() {
  const [missedCalls, setMissedCalls] = useState([]);

  useEffect(() => {
    loadMissedCalls();
  }, []);

  const loadMissedCalls = async () => {
    const calls = await base44.entities.Call.filter({}, "-start_time", 200);
    setMissedCalls(
      calls.filter((c) => (c.status === "perdida" || c.status === "abandonada") && c.next_action !== "Retorno realizado")
    );
  };

  const handleReturnCall = async (call) => {
    await base44.entities.Call.update(call.id, { next_action: "Retorno realizado" });
    loadMissedCalls();
  };

  if (missedCalls.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <PhoneMissed className="w-5 h-5 text-red-600" />
        <h3 className="font-semibold text-red-700">Chamadas Perdidas — Retorno Pendente ({missedCalls.length})</h3>
      </div>
      <div className="space-y-2">
        {missedCalls.map((call) => (
          <div key={call.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-red-100">
            <div>
              <p className="font-medium text-sm">{call.customer_name || call.phone}</p>
              <p className="text-xs text-muted-foreground">
                {call.phone} • Fila: {call.queue_name || "—"} • Atendente responsável: {call.attendant_name || "Não atribuído"}
              </p>
            </div>
            <button
              onClick={() => handleReturnCall(call)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
            >
              <PhoneCall className="w-3.5 h-3.5" /> Marcar retorno feito
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}