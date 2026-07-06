import React from "react";
import ReactMarkdown from "react-markdown";
import { AlertTriangle, Bot, User } from "lucide-react";

export default function ConversationDetail({ conversation, escalated }) {
  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Selecione uma conversa para revisar</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="h-16 border-b border-border bg-card flex items-center justify-between px-5 flex-shrink-0">
        <div>
          <p className="font-semibold text-sm">{conversation.metadata?.name || "Conversa"}</p>
          <p className="text-xs text-muted-foreground">{conversation.metadata?.description || ""}</p>
        </div>
        {escalated && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-amber-700 bg-amber-50">
            <AlertTriangle className="w-3.5 h-3.5" /> Escalado para humano
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-5 bg-muted/20">
        <div className="max-w-2xl mx-auto space-y-3">
          {(conversation.messages || []).length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">Nenhuma mensagem nesta conversa</p>
          ) : (
            conversation.messages.map((msg, idx) => {
              const isUser = msg.role === "user";
              return (
                <div key={idx} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? "bg-primary" : "bg-purple-500"}`}>
                      {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                    </div>
                    <div className={`rounded-2xl px-4 py-2.5 ${isUser ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                      <ReactMarkdown className="text-sm prose prose-sm max-w-none">{msg.content || ""}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}