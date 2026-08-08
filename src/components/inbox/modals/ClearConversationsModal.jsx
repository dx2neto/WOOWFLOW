import React from "react";
import { AlertCircle, RefreshCw, X } from "lucide-react";

export default function ClearConversationsModal({ show, count, onConfirm, onConfirmAll, onClearAndImport, onClose, clearing }) {
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
              Escolha uma opção abaixo. Esta ação é irreversível.
            </p>
          </div>
          <button onClick={() => !clearing && onClose()} className="rounded-lg p-2 hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="mt-2 space-y-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          <p><strong>{count}</strong> conversa(s) carregada(s) na visualização atual.</p>
          <p>Use "Limpar tudo" para remover <strong>todas</strong> as conversas e contatos do sistema.</p>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <button onClick={onConfirm} disabled={clearing}
            className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">
            {clearing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            Limpar apenas as visíveis ({count})
          </button>
          <button onClick={onConfirmAll} disabled={clearing}
            className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {clearing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <AlertCircle className="h-4 w-4" />}
            {clearing ? "Limpando..." : "Limpar tudo (todas conversas e contatos)"}
          </button>
          {onClearAndImport && (
            <button onClick={onClearAndImport} disabled={clearing}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
              {clearing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {clearing ? "Processando..." : "Limpar e importar do WhatsApp"}
            </button>
          )}
          <button onClick={onClose} disabled={clearing}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50">Cancelar</button>
        </div>
      </div>
    </div>
  );
}