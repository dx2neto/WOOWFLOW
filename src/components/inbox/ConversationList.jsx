import React from "react";
import { Search, Filter, RefreshCw } from "lucide-react";
import { ChannelBadge, StatusBadge } from "@/components/Badges";
import { Bot } from "lucide-react";
import { initials, formatTime, channelTabs, statusFilters } from "./inboxConstants";
import WhatsAppSearchResults from "@/components/inbox/WhatsAppSearchResults";

export default function ConversationList({
  loading, conversations, filtered, selectedId, onSelect,
  query, setQuery, statusFilter, setStatusFilter,
  channel, channelCounts,
  waResults, searchingWa, startConversationFromWa,
}) {
  return (
    <aside className="min-h-0 border-r border-border bg-card flex flex-col">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, telefone, protocolo..."
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-thin">
          <Filter className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          {statusFilters.map((item) => (
            <button key={item.key} onClick={() => setStatusFilter(item.key)}
              className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold ${statusFilter === item.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <WhatsAppSearchResults results={waResults} loading={searchingWa} onSelect={startConversationFromWa} />

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando conversas...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada</div>
        ) : (
          filtered.map((conv) => (
            <button key={conv.id} onClick={() => onSelect(conv.id)}
              className={`flex w-full gap-3 border-b border-border p-3 text-left transition-colors hover:bg-muted/40 ${selectedId === conv.id ? "border-l-4 border-l-primary bg-primary/5" : ""}`}>
              <div className="relative flex-shrink-0">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-bold text-white">
                  {initials(conv.customer_name)}
                </div>
                {conv.is_ai && (
                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-violet-500">
                    <Bot className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-sm ${conv.unread ? "font-bold" : "font-medium"}`}>{conv.customer_name}</p>
                  <span className="flex-shrink-0 text-xs text-muted-foreground">{formatTime(conv.last_message_time)}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{conv.last_message || "Sem mensagens"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <ChannelBadge channel={conv.channel} />
                  <StatusBadge status={conv.status} />
                  {conv.unread && <span className="h-2.5 w-2.5 rounded-full bg-accent flex-shrink-0" />}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}