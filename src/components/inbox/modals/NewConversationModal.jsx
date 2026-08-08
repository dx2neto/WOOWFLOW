import React from "react";
import { CirclePlus, X } from "lucide-react";

export default function NewConversationModal({ show, form, setForm, onSubmit, onClose, creating, availableSectors, channelTabs }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">Nova conversa</h3>
            <p className="text-sm text-muted-foreground">Crie um atendimento em qualquer canal.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm font-semibold">
            Nome do contato *
            <input value={form.customer_name} onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary" required />
          </label>
          <label className="text-sm font-semibold">
            Telefone ou ID
            <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary" />
          </label>
          <label className="text-sm font-semibold">
            Canal
            <select value={form.channel} onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary">
              {channelTabs.filter((t) => t.key !== "all").map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Setor
            <select value={form.sector} onChange={(e) => setForm((p) => ({ ...p, sector: e.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary">
              {availableSectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Prioridade
            <select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary">
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancelar</button>
          <button type="submit" disabled={creating}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {creating ? "Criando..." : "Criar conversa"}
          </button>
        </div>
      </form>
    </div>
  );
}