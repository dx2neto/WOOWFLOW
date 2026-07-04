import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ixcApi } from "@/functions/ixcApi";
import { Search, User, MessageSquare, Loader2 } from "lucide-react";

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setCustomers([]);
      setConversations([]);
      return;
    }
    const timeout = setTimeout(() => runSearch(query.trim()), 400);
    return () => clearTimeout(timeout);
  }, [query]);

  const runSearch = async (term) => {
    setLoading(true);
    try {
      const [ixcRes, allConversations] = await Promise.all([
        ixcApi({ action: "clientes", search: term }).catch(() => null),
        base44.entities.Conversation.list("-last_message_time", 300).catch(() => []),
      ]);
      setCustomers(ixcRes?.data?.result?.registros?.slice(0, 6) || []);
      const lower = term.toLowerCase();
      setConversations(
        allConversations
          .filter((c) => c.customer_name?.toLowerCase().includes(lower) || c.phone?.includes(term))
          .slice(0, 6)
      );
    } finally {
      setLoading(false);
    }
  };

  const goToCustomer = (customer) => {
    setOpen(false);
    setQuery("");
    navigate(`/customers?q=${encodeURIComponent(customer.name || "")}`);
  };

  const goToConversation = (conv) => {
    setOpen(false);
    setQuery("");
    navigate(`/inbox?conversation=${conv.id}`);
  };

  const hasResults = customers.length > 0 || conversations.length > 0;

  return (
    <div ref={containerRef} className="flex-1 max-w-md mx-auto relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Buscar clientes, conversas, protocolos..."
          className="w-full h-10 pl-10 pr-4 bg-muted/60 rounded-lg text-sm border border-transparent focus:border-primary focus:bg-card focus:outline-none transition-colors"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg max-h-96 overflow-y-auto scrollbar-thin z-50">
          {!loading && !hasResults && (
            <p className="p-4 text-sm text-muted-foreground text-center">Nenhum resultado encontrado</p>
          )}

          {customers.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">Clientes (IXC)</p>
              {customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => goToCustomer(c)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.phone || c.cpf_cnpj || ""}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {conversations.length > 0 && (
            <div className="p-2 border-t border-border">
              <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">Conversas</p>
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => goToConversation(conv)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{conv.customer_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{conv.last_message || conv.phone}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}