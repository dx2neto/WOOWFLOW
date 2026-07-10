import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ixcApi } from "@/functions/ixcApi";
import { agreementApi } from "@/functions/agreementApi";
import { Bot, MessageCircle, DollarSign, FileText, Wrench, Shield, Clock } from "lucide-react";

const ICONS = {
  message:   { icon: MessageCircle, color: "bg-purple-100 text-purple-600" },
  billing:   { icon: DollarSign,    color: "bg-green-100 text-green-600" },
  contract:  { icon: FileText,      color: "bg-blue-100 text-blue-600" },
  os:        { icon: Wrench,       color: "bg-amber-100 text-amber-600" },
  agreement: { icon: Shield,        color: "bg-indigo-100 text-indigo-600" },
};

export default function CustomerTimeline({ phone, clientId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTimeline(); }, [phone, clientId]);

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const [conversations, billingResponse, contractsResponse, osResponse, agreementsResponse] = await Promise.all([
        phone ? base44.entities.Conversation.filter({ phone }, "-last_message_time", 30) : Promise.resolve([]),
        clientId ? ixcApi({ action: "faturas_cliente", clientId }) : Promise.resolve(null),
        clientId ? ixcApi({ action: "contratos", clientId }) : Promise.resolve(null),
        clientId ? ixcApi({ action: "os", clientId, limit: 50 }) : Promise.resolve(null),
        clientId ? agreementApi({ action: "by_customer", customerId: String(clientId) }) : Promise.resolve(null),
      ]);

      // Mensagens (de todas as conversas do cliente, IA ou humanas)
      const messagesByConv = await Promise.all(
        conversations.map((c) => base44.entities.Message.filter({ conversation_id: c.id }, "-timestamp", 30))
      );
      const convById = Object.fromEntries(conversations.map((c) => [c.id, c]));
      const messageEvents = messagesByConv.flat().map((m) => {
        const conv = convById[m.conversation_id];
        let title = "Cliente enviou mensagem";
        if (m.direction === "internal") title = "Observação interna";
        else if (m.direction === "out") title = conv?.is_ai ? "Lara respondeu" : "Atendente respondeu";
        return { type: "message", date: m.timestamp, title, description: m.content || "(sem conteúdo)" };
      });

      // Financeiro
      const faturas = billingResponse?.data?.result?.registros || [];
      const billingEvents = faturas.map((f) => ({
        type: "billing",
        date: f.payment_date || f.due_date,
        title: f.status === "P" ? "Fatura paga" : f.status === "A" ? "Fatura em aberto" : "Fatura cancelada",
        description: `Vencimento: ${f.due_date ? new Date(f.due_date).toLocaleDateString("pt-BR") : "—"} • R$ ${Number(f.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      }));

      // Contratos
      const contratos = contractsResponse?.data?.result?.registros || [];
      const contractEvents = contratos.flatMap((c) => {
        const events = [];
        if (c.start_date) {
          events.push({
            type: "contract", date: c.start_date, title: "Contrato ativado",
            description: `Contrato #${c.id} — ${c.plan_name || "Plano não informado"}`,
          });
        }
        if (c.status === "CA" || c.status === "cancelado") {
          events.push({
            type: "contract", date: c.renewal_date || c.start_date, title: "Contrato cancelado",
            description: `Contrato #${c.id} — ${c.plan_name || "Plano não informado"}`,
          });
        }
        return events;
      });

      // Ordens de Serviço
      const ordens = osResponse?.data?.data || [];
      const osEvents = ordens.flatMap((o) => {
        const events = [];
        if (o.open_date) {
          events.push({ type: "os", date: o.open_date, title: "OS aberta", description: `OS #${o.id} — ${o.subject || "Sem assunto"}` });
        }
        if (o.close_date) {
          events.push({ type: "os", date: o.close_date, title: "OS finalizada", description: `OS #${o.id} — ${o.solution || o.subject || "Sem assunto"}` });
        }
        return events;
      });

      // Acordos
      const agreements = agreementsResponse?.data?.data || [];
      const agreementEvents = agreements.flatMap((a) => {
        const events = [];
        if (a.created_date) {
          events.push({ type: "agreement", date: a.created_date, title: "Acordo criado", description: `Valor negociado: R$ ${Number(a.negotiated_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` });
        }
        if (a.status === "paid") {
          events.push({ type: "agreement", date: a.updated_date || a.created_date, title: "Acordo quitado", description: `Cliente ${a.customer_name}` });
        }
        if (a.status === "broken") {
          events.push({ type: "agreement", date: a.updated_date || a.created_date, title: "Acordo quebrado", description: `Cliente ${a.customer_name}` });
        }
        return events;
      });

      const merged = [...messageEvents, ...billingEvents, ...contractEvents, ...osEvents, ...agreementEvents]
        .filter((e) => e.date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 100);

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
      {events.map((event, idx) => {
        const cfg = ICONS[event.type] || ICONS.message;
        const Icon = cfg.icon;
        return (
          <div key={idx} className="flex gap-3 relative pb-6">
            {idx !== events.length - 1 && (
              <div className="absolute left-4 top-9 bottom-0 w-px bg-border" />
            )}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${cfg.color}`}>
              <Icon className="w-4 h-4" />
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
        );
      })}
    </div>
  );
}