import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChannelBadge, StatusBadge } from "@/components/Badges";
import { ChevronDown, ChevronUp, MessageCircle } from "lucide-react";

function fmtDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function ConversationMessages({ conversationId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    base44.entities.Message.filter({ conversation_id: conversationId }, "timestamp")
      .then((data) => active && setMessages(data))
      .catch(() => active && setMessages([]))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [conversationId]);

  if (loading) return <p className="py-4 text-center text-xs text-muted-foreground">Carregando mensagens...</p>;
  if (messages.length === 0) return <p className="py-4 text-center text-xs text-muted-foreground">Nenhuma mensagem nesta conversa</p>;

  return (
    <div className="max-h-72 space-y-2 overflow-y-auto p-3 scrollbar-thin">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.direction === "out" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[80%] rounded-lg px-3 py-1.5 text-xs ${msg.direction === "out" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            <p className="whitespace-pre-wrap">{msg.content}</p>
            <p className={`mt-1 text-[10px] ${msg.direction === "out" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{fmtDateTime(msg.timestamp)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CustomerConversationsHistory({ phone, email }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [byPhone, byEmail] = await Promise.all([
          phone ? base44.entities.Conversation.filter({ phone }) : Promise.resolve([]),
          email ? base44.entities.Conversation.filter({ email }) : Promise.resolve([]),
        ]);
        const merged = [...byPhone, ...byEmail.filter((c) => !byPhone.some((p) => p.id === c.id))];
        merged.sort((a, b) => new Date(b.last_message_time || 0) - new Date(a.last_message_time || 0));
        if (active) setConversations(merged);
      } catch {
        if (active) setConversations([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [phone, email]);

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Carregando histórico de conversas...</p>;
  }

  if (conversations.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada para este cliente em nenhum canal</p>;
  }

  return (
    <div className="divide-y divide-border">
      {conversations.map((conv) => {
        const isExpanded = expandedId === conv.id;
        return (
          <div key={conv.id}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : conv.id)}
              className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/40"
            >
              <MessageCircle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <ChannelBadge channel={conv.channel} />
                  <StatusBadge status={conv.status} />
                  {conv.protocol && <span className="text-xs text-muted-foreground">#{conv.protocol}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(conv.last_message_time)}</span>
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">{conv.last_message || "Sem mensagens"}</p>
              </div>
              {isExpanded ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
            </button>
            {isExpanded && (
              <div className="border-t border-border bg-muted/10">
                <ConversationMessages conversationId={conv.id} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}