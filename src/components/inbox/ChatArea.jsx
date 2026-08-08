import React from "react";
import { MessageCircle, RefreshCw, Phone, ArrowRightLeft, CheckCircle, MoreHorizontal, Sparkles, Paperclip, Mic, Send, Zap, ChevronDown, StickyNote } from "lucide-react";
import { ChannelBadge, StatusBadge } from "@/components/Badges";
import { initials, formatDate, formatTime, channelTabs } from "./inboxConstants";
import MessageBubble from "@/components/inbox/MessageBubble";

export default function ChatArea({
  selected, messages, loadingMessages, selectedInstance,
  syncingHistory, sending, sendingMedia, messageMode, setMessageMode,
  message, setMessage, onSend, onSyncHistory, onWhatsAppCall,
  onAttachClick, onAudioClick, onFileChange, onAudioChange,
  fileInputRef, audioInputRef, messagesEndRef,
  showShortcuts, setShowShortcuts, templates, filteredTemplates, templateSearch, setTemplateSearch,
}) {
  if (!selected) {
    return (
      <section className="min-h-0 flex flex-col bg-muted/20">
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <MessageCircle className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p className="font-medium">Selecione uma conversa</p>
            <p className="text-sm mt-1">ou sincronize o WhatsApp para importar conversas</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-0 flex flex-col bg-muted/20">
      {/* Header da conversa */}
      <div className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-border bg-card px-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent font-bold text-white text-sm">
          {initials(selected.customer_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="truncate text-sm font-bold">{selected.customer_name}</p>
            <ChannelBadge channel={selected.channel} />
            <StatusBadge status={selected.status} />
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {selected.phone || "Sem telefone"}
            {selected.protocol && ` · ${selected.protocol}`}
            {selected.sector && ` · ${selected.sector}`}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selected.channel === "whatsapp" && (
            <button onClick={() => onSyncHistory(selected, true)} disabled={syncingHistory}
              className="rounded-lg p-2 hover:bg-muted" title="Sincronizar histórico WhatsApp">
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${syncingHistory ? "animate-spin" : ""}`} />
            </button>
          )}
          <button onClick={onWhatsAppCall} className="rounded-lg p-2 hover:bg-muted" title="Ligar via WhatsApp">
            <Phone className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={() => setShowShortcuts(false)} className="rounded-lg p-2 hover:bg-muted" title="Transferir conversa">
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <button className="rounded-lg p-2 hover:bg-green-50 hover:text-green-700" title="Finalizar atendimento">
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </button>
          <button className="rounded-lg p-2 hover:bg-muted" title="Mais ações">
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Área de mensagens */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5 scrollbar-thin">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Conversa via {channelTabs.find((t) => t.key === selected.channel)?.label || "canal"}
            {selected.created_date && <span>· {formatDate(selected.created_date)}</span>}
          </div>

          {loadingMessages ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" /> Carregando mensagens...
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">Nenhuma mensagem ainda</p>
              {selected.channel === "whatsapp" && (
                <button onClick={() => onSyncHistory(selected, true)}
                  className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline">
                  <RefreshCw className="h-3.5 w-3.5" /> Buscar histórico do WhatsApp
                </button>
              )}
            </div>
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Área de envio */}
      <div className="flex-shrink-0 border-t border-border bg-card p-3">
        <input ref={fileInputRef} type="file" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip,.rar" className="hidden" onChange={onFileChange} />
        <input ref={audioInputRef} type="file" accept="audio/*,.ogg,.mp3,.m4a,.aac,.wav,.opus" className="hidden" onChange={onAudioChange} />

        <div className="rounded-xl border border-border bg-background p-2">
          {/* Tabs modo */}
          <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
            <div className="flex gap-1">
              <button onClick={() => setMessageMode("reply")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${messageMode === "reply" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                Responder
              </button>
              <button onClick={() => setMessageMode("internal")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${messageMode === "internal" ? "bg-amber-100 text-amber-800" : "text-muted-foreground hover:bg-muted"}`}>
                <StickyNote className="h-3 w-3" /> Nota interna
              </button>
            </div>

            {selected?.channel === "whatsapp" && (
              <div className="flex items-center gap-1">
                <button onClick={() => onSyncHistory(selected, false)} disabled={syncingHistory}
                  title="Sincronizar histórico" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50">
                  <RefreshCw className={`h-3.5 w-3.5 ${syncingHistory ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Histórico</span>
                </button>
                <button onClick={onWhatsAppCall} title="Ligar"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-green-50 hover:text-green-700">
                  <Phone className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Ligar</span>
                </button>
              </div>
            )}
          </div>

          {/* Input + botões */}
          <div className="flex items-center gap-1.5">
            <button onClick={onAttachClick} disabled={sendingMedia || selected?.channel !== "whatsapp"}
              title="Anexar arquivo" className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-40">
              {sendingMedia ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
            </button>
            <button onClick={onAudioClick} disabled={sendingMedia || selected?.channel !== "whatsapp"}
              title="Enviar áudio" className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-40">
              <Mic className="h-5 w-5" />
            </button>

            <input type="text" value={message} onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
              placeholder={messageMode === "internal" ? "Nota interna (não enviada ao cliente)..." : "Digite sua mensagem..."}
              className={`h-10 flex-1 bg-transparent px-2 text-sm outline-none ${messageMode === "internal" ? "placeholder:text-amber-400" : ""}`} />

            {/* Atalhos (templates) */}
            <div className="relative" data-shortcuts-panel>
              <button onClick={() => setShowShortcuts((s) => !s)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors ${showShortcuts ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                <Zap className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Atalhos</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showShortcuts ? "rotate-180" : ""}`} />
              </button>

              {showShortcuts && (
                <div className="absolute bottom-12 right-0 z-50 w-80 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                  <div className="p-3 border-b border-border">
                    <p className="text-sm font-semibold mb-2">Templates de mensagem</p>
                    <input value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)}
                      placeholder="Buscar template..." className="w-full h-8 px-3 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div className="max-h-64 overflow-y-auto scrollbar-thin">
                    {filteredTemplates.length === 0 ? (
                      <p className="p-4 text-xs text-muted-foreground text-center">
                        {templates.length === 0 ? "Nenhum template cadastrado" : "Nenhum template encontrado"}
                      </p>
                    ) : (
                      filteredTemplates.map((tp) => (
                        <button key={tp.id} onClick={() => { setMessage(tp.content || tp.body || ""); setShowShortcuts(false); setTemplateSearch(""); }}
                          className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b border-border/50 last:border-0">
                          <p className="text-xs font-semibold text-foreground">{tp.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tp.content || tp.body}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={onSend} disabled={sending || !message.trim()}
              className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50 ${messageMode === "internal" ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-600 hover:bg-emerald-700"}`}>
              {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>{messageMode === "internal" ? "Salvar nota" : "Enviar"}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}