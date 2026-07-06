import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import ConversationDetail from "@/components/laralogs/ConversationDetail";
import { Search, AlertTriangle, Bot, RefreshCw } from "lucide-react";

const ESCALATION_REGEX = /conectar com um de nossos atendentes|atendente humano|encaminh(ar|ando)|transferir (a )?conversa/i;

export default function LaraLogs() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [onlyEscalated, setOnlyEscalated] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const list = await base44.agents.listConversations({ agent_name: "lara" });
      const full = await Promise.all(
        list.map(async (c) => {
          try {
            const detail = await base44.agents.getConversation(c.id);
            const escalated = (detail.messages || []).some(
              (m) => m.role === "assistant" && ESCALATION_REGEX.test(m.content || "")
            );
            return { ...c, ...detail, escalated };
          } catch {
            return { ...c, messages: [], escalated: false };
          }
        })
      );
      full.sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0));
      setConversations(full);
      if (full.length > 0) setSelectedId(full[0].id);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = conversations.filter((c) => {
    if (onlyEscalated && !c.escalated) return false;
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const name = (c.metadata?.name || "").toLowerCase();
    const lastMsg = (c.messages || []).map((m) => m.content || "").join(" ").toLowerCase();
    return name.includes(term) || lastMsg.includes(term);
  });

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="flex h-full">
      <div className="w-96 border-r border-border bg-card flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold font-heading flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-500" /> Logs da Lara
            </h2>
            <button onClick={loadConversations} disabled={loading} className="p-2 hover:bg-muted rounded-lg disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversa ou mensagem..."
              className="w-full h-9 pl-9 pr-3 bg-muted/60 rounded-lg text-sm focus:outline-none focus:bg-card focus:ring-1 focus:ring-primary"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={onlyEscalated} onChange={(e) => setOnlyEscalated(e.target.checked)} />
            Apenas escaladas para humano
          </label>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada</div>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`w-full flex gap-3 p-4 border-b border-border text-left hover:bg-muted/40 transition-colors ${
                  selectedId === conv.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{conv.metadata?.name || "Conversa"}</p>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {conv.updated_date ? new Date(conv.updated_date).toLocaleDateString("pt-BR") : ""}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {conv.messages?.[conv.messages.length - 1]?.content || "Sem mensagens"}
                  </p>
                  {conv.escalated && (
                    <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-amber-700 bg-amber-50">
                      <AlertTriangle className="w-3 h-3" /> Escalado
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <ConversationDetail conversation={selected} escalated={selected?.escalated} />
    </div>
  );
}