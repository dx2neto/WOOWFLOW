import React from "react";
import { ArrowRightLeft, RefreshCw, X } from "lucide-react";

export default function TransferModal({ show, selected, sector, setSector, attendant, setAttendant, users, availableSectors, onConfirm, onClose, transferring }) {
  if (!show || !selected) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !transferring && onClose()}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" /> Transferir Atendimento
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Transferir conversa de <strong>{selected.sector || "Atendimento"}</strong> para outro setor.
            </p>
          </div>
          <button onClick={() => !transferring && onClose()} className="rounded-lg p-2 hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-semibold block mb-1.5">Setor de destino *</label>
            <select value={sector} onChange={(e) => setSector(e.target.value)}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary">
              <option value="">Selecione um setor...</option>
              {availableSectors.filter((s) => s !== selected.sector).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold block mb-1.5">
              Atendente <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <select value={attendant} onChange={(e) => setAttendant(e.target.value)}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary">
              <option value="">Sem atendente específico</option>
              {users.filter((u) => (u.status || "ativo") === "ativo").map((u) => (
                <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} disabled={transferring}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">Cancelar</button>
          <button onClick={onConfirm} disabled={transferring || !sector}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {transferring ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            {transferring ? "Transferindo..." : "Transferir"}
          </button>
        </div>
      </div>
    </div>
  );
}