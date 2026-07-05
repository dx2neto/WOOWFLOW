import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Send, MessageSquareText } from "lucide-react";

const categoryLabels = {
  saudacao: "Saudação",
  financeiro: "Financeiro",
  cobranca: "Cobrança",
  suporte_tecnico: "Suporte",
  comercial: "Comercial",
  despedida: "Despedida",
  outro: "Outro",
};

export default function QuickReplyPanel({ onSend, sending }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    (async () => {
      const data = await base44.entities.MessageTemplate.filter({ active: true }, "-created_date", 200);
      setTemplates(data);
      setLoading(false);
    })();
  }, []);

  const categories = ["all", ...Object.keys(categoryLabels).filter((c) => templates.some((t) => t.category === c))];

  const filtered = templates.filter((t) => {
    const matchesCategory = category === "all" || t.category === category;
    const matchesSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.content.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar modelo..."
            className="w-full h-8 pl-8 pr-2 bg-muted/60 rounded-lg text-xs focus:outline-none focus:bg-card focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-thin">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                category === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {c === "all" ? "Todos" : categoryLabels[c] || c}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <p className="p-4 text-center text-xs text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">Nenhum modelo encontrado</p>
        ) : (
          filtered.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => onSend(tpl.content)}
              disabled={sending}
              className="w-full text-left p-3 border-b border-border hover:bg-muted/40 transition-colors disabled:opacity-50 flex gap-2 items-start"
            >
              <MessageSquareText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm truncate">{tpl.title}</p>
                  <Send className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 whitespace-pre-wrap">{tpl.content}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}