import React from "react";
import { Card } from "@/components/ui/app-card";
import { Send, Loader2 } from "lucide-react";

const fmtBRL = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function StatusInvoiceGroup({ title, subtitle, badgeColor, invoices, sendingId, onSend }) {
  const totalValue = invoices.reduce((s, i) => s + (i.value || 0), 0);

  return (
    <Card className="overflow-hidden mb-6">
      <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badgeColor}`}>
            {title} · {invoices.length}
          </span>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <p className="text-sm font-semibold">{fmtBRL(totalValue)}</p>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left font-semibold px-4 py-3">Cliente</th>
              <th className="text-left font-semibold px-4 py-3">Telefone</th>
              <th className="text-left font-semibold px-4 py-3">Vencimento</th>
              <th className="text-left font-semibold px-4 py-3">Valor</th>
              <th className="text-left font-semibold px-4 py-3">Dias Atraso</th>
              <th className="text-right font-semibold px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Nenhuma fatura nesta categoria</td></tr>
            ) : (
              invoices.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{c.customer_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone || "—"}</td>
                  <td className="px-4 py-3">{c.due_date ? new Date(c.due_date).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="px-4 py-3 font-semibold">{fmtBRL(c.value)}</td>
                  <td className="px-4 py-3">{c.days_late > 0 ? <span className="text-red-600 font-medium">{c.days_late} dias</span> : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        disabled={sendingId === `pix-${c.id}`}
                        onClick={() => onSend(c, "pix")}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                        title="Enviar PIX via WhatsApp"
                      >
                        {sendingId === `pix-${c.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} PIX
                      </button>
                      <button
                        disabled={sendingId === `boleto-${c.id}`}
                        onClick={() => onSend(c, "boleto")}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                        title="Enviar Boleto via WhatsApp"
                      >
                        {sendingId === `boleto-${c.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Boleto
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}