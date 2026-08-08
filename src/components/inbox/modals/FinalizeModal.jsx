import React from "react";
import { CheckCircle, RefreshCw, X } from "lucide-react";

export default function FinalizeModal({ show, selected, note, setNote, onConfirm, onClose, finalizing }) {
  if (!show || !selected) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !finalizing && onClose()}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" /> Finalizar Atendimento
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Conversa com <strong>{selected.customer_name}</strong> será marcada como finalizada.
            </p>
          </div>
          <button onClick={() => !finalizing && onClose()} className="rounded-lg p-2 hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <label className="block text-sm font-semibold mb-1.5">
          Nota de encerramento <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Descreva a resolução, próximos passos ou informações relevantes..."
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary resize-none" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} disabled={finalizing}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">Cancelar</button>
          <button onClick={onConfirm} disabled={finalizing}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {finalizing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {finalizing ? "Finalizando..." : "Finalizar"}
          </button>
        </div>
      </div>
    </div>
  );
}