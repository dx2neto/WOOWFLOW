import React from "react";
import { MessageCircle, Loader2 } from "lucide-react";

function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
}

export default function WhatsAppSearchResults({ results, loading, onSelect }) {
  if (!loading && results.length === 0) return null;

  return (
    <div className="border-b border-border bg-muted/20">
      <p className="flex items-center gap-1.5 px-3 pt-3 pb-1 text-xs font-bold uppercase text-muted-foreground">
        <MessageCircle className="h-3.5 w-3.5 text-green-600" /> Contatos no Evolution Go
      </p>
      {loading ? (
        <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando no WhatsApp...
        </div>
      ) : (
        results.map((contact) => (
          <button
            key={contact.phone}
            onClick={() => onSelect(contact)}
            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-green-600 text-xs font-bold text-white">
              {initials(contact.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{contact.name}</p>
              <p className="truncate text-xs text-muted-foreground">{contact.phone}</p>
            </div>
            <span className="flex-shrink-0 text-xs font-semibold text-primary">Iniciar</span>
          </button>
        ))
      )}
    </div>
  );
}