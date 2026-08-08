import React from "react";
import { AlertCircle, RefreshCw, X } from "lucide-react";

export default function ClearConversationsModal({ show, count, onConfirm, onClose, clearing }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !clearing && onClose()}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" /> Limpar Conversas
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Todas as <strong>{count}</strong> conversa(s) e suas mensagens serão removidas permanentemente.
            </p>
          </div>
          <button onClick={() => !clearing && onClose()} className="rounded-lg p-2 hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} disabled={clearing}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">Cancelar</button>
          <button onClick={onConfirm} disabled={clearing}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {clearing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            {clearing ? "Limpando..." : "Limpar tudo"}
          </button>
        </div>
      </div>
    </div>
  );
}