import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ixcApi } from "@/functions/ixcApi";
import { Bot, DollarSign, Clock } from "lucide-react";

export default function CustomerTimeline({ phone, clientId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTimeline(); }, [phone, clientId]);

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const [conversations, billingResponse] = await Promise.all([
        phone ? base44.entities.Conversation.filter({ phone }) : Promise.resolve([]),
        clientId ? ixcApi({ action: "faturas_cliente", clientId }) : Promise.resolve(null),
      ]);

      const laraConversations = conversations.filter((c) => c.is_ai);
      const messagesByConv = await Promise.all(
        laraConversations.map((c) => base44.entities.Message.filter({ conversation_id: c.id }))
      );

      const laraEvents = messagesByConv.flat().map((m) => ({
        type: "lara",
        date: m.timestamp,
        title: m.direction === "out" ? "Lara respondeu" : "Cliente enviou mensagem",
        description: m.content,
      }));

      const faturas = billingResponse?.data?.result?.registros || [];
      const billingEvents = faturas.map((f) => ({
        type: "billing",
        date: f.payment_date || f.due_date,
        title: f.status === "P" ? "Fatura paga" : f.status === "A" ? "Fatura em aberto" : "Fatura cancelada",
        description: `Vencimento: ${f.due_date ? new Date(f.due_date).toLocaleDateString("pt-BR") : "—"} • R$ ${f.value?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      }));

      const merged = [...laraEvents, ...billingEvents]
        .filter((e) => e.date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setEvents(merged);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Carregando linha do tempo...</p>;
  }

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma interação encontrada para este cliente</p>;
  }

  return (
    <div className="space-y-0">
      {events.map((event, idx) => (
        <div key={idx} className="flex gap-3 relative pb-6">
          {idx !== events.length - 1 && (
            <div className="absolute left-4 top-9 bottom-0 w-px bg-border" />
          )}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
            event.type === "lara" ? "bg-purple-100 text-purple-600" : "bg-green-100 text-green-600"
          }`}>
            {event.type === "lara" ? <Bot className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{event.title}</p>
              <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                <Clock className="w-3 h-3" />
                {new Date(event.date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 break-words">{event.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
