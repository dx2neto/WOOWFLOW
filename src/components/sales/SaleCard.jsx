import React from "react";
import { Phone, MapPin, User, AlertCircle, CheckCircle2, FileSignature, MessageCircle } from "lucide-react";

export default function SaleCard({ sale, onClick, selected }) {
  return (
    <div
      onClick={onClick}
      className={`bg-card rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md ${
        selected ? "border-primary ring-1 ring-primary/30" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-foreground line-clamp-1">{sale.customer_name}</p>
        {sale.whatsapp_sent && <MessageCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />}
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Phone className="w-3 h-3" />
          <span className="truncate">{sale.phone || "—"}</span>
        </div>
        {sale.city && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{sale.city}</span>
          </div>
        )}
        {sale.plan_name && (
          <div className="flex items-center gap-1.5">
            <User className="w-3 h-3" />
            <span className="truncate">{sale.plan_name}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border">
        {sale.ixc_customer_exists && <CheckCircle2 className="w-3 h-3 text-indigo-500" />}
        {sale.ixc_financial_risk === "alto" && <AlertCircle className="w-3 h-3 text-red-500" />}
        {sale.credit_decision === "approved" && <CheckCircle2 className="w-3 h-3 text-green-500" />}
        {sale.credit_decision === "rejected" && <AlertCircle className="w-3 h-3 text-red-500" />}
        {sale.zapsign_doc_token && <FileSignature className="w-3 h-3 text-cyan-500" />}
        {sale.monthly_fee && (
          <span className="ml-auto text-xs font-semibold text-foreground">
            R$ {sale.monthly_fee.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}