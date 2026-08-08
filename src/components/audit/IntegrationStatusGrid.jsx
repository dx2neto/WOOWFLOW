import React from "react";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { statusLabel } from "@/components/inbox/inboxConstants";

const statusStyle = {
  connected:    "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending:      "border-amber-200 bg-amber-50 text-amber-700",
  error:        "border-red-200 bg-red-50 text-red-700",
  disconnected: "border-muted bg-muted/40 text-muted-foreground",
};

export default function IntegrationStatusGrid({ configs, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {configs.map((cfg) => {
        const status = cfg.status || "disconnected";
        const Icon = status === "connected" ? CheckCircle : status === "error" ? XCircle : status === "pending" ? AlertTriangle : RefreshCw;
        return (
          <div key={cfg.id} className={`rounded-xl border p-4 ${statusStyle[status] || statusStyle.disconnected}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold">{cfg.display_name || cfg.service}</span>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">{statusLabel(status)}</span>
              <span className="opacity-70">{cfg.provider || "—"}</span>
            </div>
            {cfg.error_message && (
              <p className="mt-2 text-xs bg-white/60 rounded px-2 py-1 line-clamp-2">{cfg.error_message}</p>
            )}
            {cfg.last_sync && (
              <p className="mt-1.5 text-[10px] opacity-60">Última sync: {new Date(cfg.last_sync).toLocaleString("pt-BR")}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}