import React from "react";
import { RefreshCw, CirclePlus, X } from "lucide-react";
import { channelTabs } from "./inboxConstants";

export default function InboxHeader({
  instances, selectedInstance, onInstanceChange, onReloadInstances,
  loadingConvsFromWa, onLoadWhatsAppConversations,
  onNewConversation, onClear, conversationsCount,
  channel, setChannel, channelCounts,
  selectedInstanceState,
}) {
  return (
    <div className="border-b border-border bg-card px-4 py-3 flex-shrink-0">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold font-heading">Inbox Omnichannel</h2>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${selectedInstanceState === "connected" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${selectedInstanceState === "connected" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              {selectedInstanceState === "connected" ? "WhatsApp Conectado" : "Verificar WhatsApp"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Atendimento centralizado — WhatsApp, PABX, redes sociais, chats e integrações.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          {instances.length > 0 ? (
            <div className="flex items-center gap-2">
              <select value={selectedInstance} onChange={(e) => onInstanceChange(e.target.value)}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary">
                {instances.map((inst) => (
                  <option key={inst.name} value={inst.name}>
                    {["connected","open"].includes(inst.state) ? "🟢" : "🔴"} {inst.name}
                  </option>
                ))}
              </select>
              <button onClick={onReloadInstances} className="rounded-lg border border-border p-2 hover:bg-muted" title="Recarregar instâncias">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <button onClick={onReloadInstances} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-muted">
              <RefreshCw className="h-4 w-4" /> Carregar instâncias
            </button>
          )}
          <button onClick={onLoadWhatsAppConversations} disabled={!selectedInstance || loadingConvsFromWa}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loadingConvsFromWa ? "animate-spin" : ""}`} /> Sincronizar
          </button>
          <button onClick={onNewConversation}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <CirclePlus className="h-4 w-4" /> Nova conversa
          </button>
          <button onClick={onClear}
            disabled={conversationsCount === 0}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-300 px-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40">
            <X className="h-4 w-4" /> Limpar
          </button>
        </div>
      </div>

      {/* Abas de canal */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {channelTabs.map((tab) => {
          const Icon = tab.icon;
          const active = channel === tab.key;
          return (
            <button key={tab.key} onClick={() => setChannel(tab.key)}
              className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm font-semibold transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}>
              <Icon className={`h-4 w-4 ${active ? "" : tab.className}`} />
              {tab.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${active ? "bg-white/20" : "bg-muted text-muted-foreground"}`}>
                {channelCounts[tab.key] || 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}