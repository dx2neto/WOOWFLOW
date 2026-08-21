import React from "react";
import { channelTabs, statusLabel } from "./inboxConstants";
import { ChevronRight } from "lucide-react";

const STATUS_DOT = {
  connected: "bg-emerald-500",
  pending: "bg-amber-500",
  error: "bg-red-500",
  disconnected: "bg-muted-foreground/40",
};

const STATUS_BADGE = {
  connected: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
  disconnected: "bg-muted text-muted-foreground",
};

/**
 * Painel Unificado — visão geral de todos os canais do Inbox Omnichannel:
 * WhatsApp (Evolution API), PABX, Instagram, Facebook, chat interno/externo, etc.
 * Mostra status de conexão e contagem de atividade por canal.
 */
export default function UnifiedChannelOverview({ channelStats, totalActive, totalChannels, onChannelSelect }) {
  const channels = channelTabs.filter((t) => t.key !== "all");

  return (
    <div className="border-b border-border bg-gradient-to-r from-violet-50/50 to-transparent px-4 py-3 flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold font-heading">Painel Unificado de Canais</h3>
          <span className="text-xs text-muted-foreground">
            {totalActive} de {totalChannels} canais ativos
          </span>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {channels.map((ch) => {
          const Icon = ch.icon;
          const stat = channelStats[ch.key] || { count: 0, status: "disconnected", detail: "" };
          const dotClass = STATUS_DOT[stat.status] || STATUS_DOT.disconnected;
          const badgeClass = STATUS_BADGE[stat.status] || STATUS_BADGE.disconnected;
          return (
            <button
              key={ch.key}
              onClick={() => onChannelSelect?.(ch.key)}
              className="group flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 hover:border-primary/40 hover:shadow-sm transition-all flex-shrink-0 min-w-[150px]"
            >
              <div className="relative flex-shrink-0">
                <Icon className={`w-5 h-5 ${ch.className}`} />
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${dotClass}`} />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold truncate">{ch.label}</p>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{stat.detail}</p>
              </div>
              <div className="flex flex-col items-end flex-shrink-0">
                <span className="text-sm font-bold">{stat.count}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${badgeClass}`}>
                  {statusLabel(stat.status)}
                </span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}