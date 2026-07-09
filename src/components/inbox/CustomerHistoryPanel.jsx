import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ChannelBadge, StatusBadge } from "@/components/Badges";
import { History, MessageCircle } from "lucide-react";

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function CustomerHistoryPanel({ conversation, onSelect }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const phone = conversation?.phone;
        if (!phone) {
          if (active) setHistory([]);
          return;
        }
        const results = await base44.entities.Conversation.filter({ phone }, "-last_message_time", 50);
        if (active) setHistory(results.filter((c) => c.id !== conversation.id));
      } catch {
        if (active) setHistory([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [conversation?.id, conversation?.phone]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <p className="text-xs font-bold uppercase text-muted-foreground">Histórico do cliente em outros canais</p>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando histórico...</p>
      ) : history.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
          Nenhuma outra conversa encontrada para este cliente
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className="flex w-full flex-col gap-1.5 rounded-lg border border-border bg-background p-3 text-left hover:bg-muted/50"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  <ChannelBadge channel={conv.channel} />
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(conv.last_message_time)}</span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{conv.last_message || "Sem mensagens"}</p>
              <div className="flex items-center gap-1.5">
                <StatusBadge status={conv.status} />
                {conv.protocol && <span className="text-[11px] text-muted-foreground">#{conv.protocol}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}