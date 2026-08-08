import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useEntityList } from "@/hooks/useEntityQueries";
import { Card } from "@/components/ui/app-card";
import { ChannelBadge, PriorityBadge } from "@/components/Badges";
import {
  Search, MessageCircle, RefreshCw,
  Clock, ChevronRight, CheckCircle,
} from "lucide-react";

function formatTimeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export default function UnansweredTab({ instance }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: conversations = [], isLoading: loading, refetch } = useEntityList("Conversation", "-last_message_time", 100);
  const [search, setSearch] = useState("");
  const [selectedInstance, setSelectedInstance] = useState(instance || "");

  // Realtime: invalida cache quando conversas mudam
  useEffect(() => {
    const unsub = base44.entities.Conversation.subscribe(() => {
      qc.invalidateQueries({ queryKey: ["Conversation"] });
    });
    return unsub;
  }, [qc]);

  const unanswered = conversations.filter((c) =>
    c.channel === "whatsapp" &&
    c.unread === true &&
    !["resolvido", "finalizado", "perdido"].includes(c.status)
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return unanswered;
    return unanswered.filter((c) =>
      [c.customer_name, c.phone, c.last_message].filter(Boolean).some((v) => v.toLowerCase().includes(term))
    );
  }, [unanswered, search]);

  const urgent = unanswered.filter((c) => c.priority === "urgente" || c.priority === "alta").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Não respondidas</p>
          <p className="mt-1 text-2xl font-black">{unanswered.length}</p>
        </Card>
        <Card className="p-4 border-red-200">
          <p className="text-xs font-semibold uppercase text-red-700">Prioridade alta</p>
          <p className="mt-1 text-2xl font-black text-red-700">{urgent}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Instância</p>
          <p className="mt-1 text-sm font-bold truncate">{selectedInstance || "—"}</p>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone, mensagem..."
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button onClick={() => refetch()} className="rounded-lg border border-border p-2 hover:bg-muted" title="Recarregar">
          <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" /> Carregando conversas...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <CheckCircle className="mx-auto mb-3 h-10 w-10 opacity-30" />
          Nenhuma mensagem sem resposta — tudo em dia!
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((conv) => (
            <Card key={conv.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" >
              <div
                className="flex items-center gap-4"
                onClick={() => navigate(`/inbox?conversation=${conv.id}`)}
              >
                <div className="relative flex-shrink-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-700 text-sm font-bold text-white">
                    {conv.customer_name?.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?"}
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-black text-accent-foreground">
                    !
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm truncate">{conv.customer_name}</p>
                    <PriorityBadge priority={conv.priority} />
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {formatTimeAgo(conv.last_message_time)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{conv.last_message || "Sem mensagem"}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <ChannelBadge channel={conv.channel} />
                    <span className="text-xs text-muted-foreground">{conv.phone}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/inbox?conversation=${conv.id}`); }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Responder
                  </button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}