import React, { useState } from "react";
import { X, ShieldCheck, FileText, Send, CheckCircle2, AlertTriangle, Clock, Phone, MapPin, DollarSign, User, Hash, Store } from "lucide-react";
import { SALE_STAGES, SALE_TYPES } from "./saleConstants";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { salesPipelineApi } from "@/functions/salesPipelineApi";
import { maskCpfCnpj } from "@/lib/lgpd";

export default function SaleDetailPanel({ sale, onClose, onRefresh }) {
  const { toast } = useToast();
  const [actionLoading, setActionLoading] = useState(null);
  if (!sale) return null;

  const stageInfo = SALE_STAGES.find(s => s.key === sale.stage) || SALE_STAGES[0];

  const runAction = async (action, label, payload = {}) => {
    setActionLoading(action);
    try {
      const resp = await salesPipelineApi({ action, sale_id: sale.id, ...payload });
      if (resp?.data?.success === false) {
        toast({ title: "Falha: " + label, description: resp.data.error || "", variant: "destructive" });
      } else {
        toast({ title: label + " concluído", description: resp?.data?.message || "" });
        onRefresh();
      }
    } catch {
      toast({ title: "Erro em " + label, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const timeline = sale.timeline || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background shadow-xl overflow-y-auto scrollbar-thin">
        <div className="sticky top-0 bg-background border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold font-heading">{sale.customer_name}</h2>
            <p className="text-xs text-muted-foreground">Correlation: {sale.correlation_id}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="p-5 space-y-5">
          {/* Stage badge */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white ${stageInfo.color}`}>
              <Clock className="w-3 h-3" /> {stageInfo.label}
            </span>
          </div>

          {/* Customer info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info icon={Phone} label="Telefone" value={sale.phone} />
            <Info icon={User} label="Vendedor" value={sale.vendor_name || "—"} />
            <Info icon={MapPin} label="Cidade" value={sale.city || "—"} />
            <Info icon={DollarSign} label="Mensalidade" value={sale.monthly_fee ? `R$ ${sale.monthly_fee.toFixed(2)}` : "—"} />
            <Info icon={Hash} label="CPF/CNPJ" value={sale.cpf_cnpj ? maskCpfCnpj(sale.cpf_cnpj) : "—"} />
            <Info icon={FileText} label="Plano" value={sale.plan_name || "—"} />
          </div>

          {/* IXC info */}
          <Section title="IXCSoft" icon={ShieldCheck}>
            <div className="space-y-1 text-sm">
              <Row label="Cliente IXC" value={sale.ixc_customer_exists ? `#${sale.ixc_customer_id}` : "Não encontrado"} />
              <Row label="Contrato IXC" value={sale.ixc_contract_id ? `#${sale.ixc_contract_id}` : "—"} />
              <Row label="Risco Financeiro" value={
                <span className={sale.ixc_financial_risk === "alto" ? "text-red-600 font-semibold" : sale.ixc_financial_risk === "medio" ? "text-amber-600" : "text-green-600"}>
                  {sale.ixc_financial_risk || "—"}
                </span>
              } />
              <Row label="Faturas Vencidas" value={String(sale.ixc_overdue_count || 0)} />
            </div>
          </Section>

          {/* Credit check */}
          <Section title="Consulta de Crédito" icon={ShieldCheck}>
            <div className="space-y-1 text-sm">
              <Row label="Decisão" value={
                <span className={
                  sale.credit_decision === "approved" ? "text-green-600 font-semibold" :
                  sale.credit_decision === "rejected" ? "text-red-600 font-semibold" :
                  sale.credit_decision === "manual_review" ? "text-orange-600 font-semibold" :
                  "text-muted-foreground"
                }>{sale.credit_decision || "Pendente"}</span>
              } />
              {sale.credit_reason && <Row label="Razão" value={<span className="text-xs">{sale.credit_reason}</span>} />}
            </div>
          </Section>

          {/* Signature */}
          {(sale.zapsign_doc_token || sale.sign_url) && (
            <Section title="Assinatura" icon={FileText}>
              <div className="space-y-1 text-sm">
                <Row label="ZapSign Doc" value={sale.zapsign_doc_token ? `#${sale.zapsign_doc_token.slice(0, 12)}...` : "—"} />
                {sale.sign_url && <a href={sale.sign_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs underline">Abrir link de assinatura</a>}
                <Row label="WhatsApp" value={
                  <span className={sale.whatsapp_sent ? "text-green-600" : "text-red-600"}>
                    {sale.whatsapp_sent ? "Enviado" : "Não enviado"}
                  </span>
                } />
              </div>
            </Section>
          )}

          {/* Commission (only for revenda) */}
          {sale.sale_type === "revenda" && (
            <Section title="Comissão" icon={Store}>
              <div className="space-y-1 text-sm">
                <Row label="Revendedor" value={sale.reseller_name || "—"} />
                <Row label="Taxa" value={`${sale.commission_rate || 0}%`} />
                <Row label="Valor Comissão" value={
                  <span className="font-semibold text-green-600">R$ {(sale.commission_amount || 0).toFixed(2)}</span>
                } />
                <Row label="Status" value={
                  <span className={sale.commission_paid ? "text-green-600 font-semibold" : "text-amber-600 font-semibold"}>
                    {sale.commission_paid ? "Paga" : "Pendente"}
                  </span>
                } />
                <Button
                  className="w-full mt-2" variant="outline" size="sm"
                  disabled={actionLoading === "mark_commission_paid" || !sale.commission_amount}
                  onClick={() => runAction("mark_commission_paid", "Marcar comissão", { paid: !sale.commission_paid })}
                >
                  <DollarSign className="w-4 h-4 mr-2" /> {sale.commission_paid ? "Marcar como pendente" : "Marcar como paga"}
                </Button>
              </div>
            </Section>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <Button
              className="w-full" variant="outline" size="sm"
              disabled={actionLoading === "validate_document"}
              onClick={() => runAction("validate_document", "Validar documento")}
            >
              <ShieldCheck className="w-4 h-4 mr-2" /> Validar CPF/CNPJ
            </Button>
            <Button
              className="w-full" variant="outline" size="sm"
              disabled={actionLoading === "check_ixc_customer"}
              onClick={() => runAction("check_ixc_customer", "Consultar IXC")}
            >
              <FileText className="w-4 h-4 mr-2" /> Consultar IXC + Débitos
            </Button>
            <Button
              className="w-full" variant="outline" size="sm"
              disabled={actionLoading === "run_credit_check"}
              onClick={() => runAction("run_credit_check", "Consulta de crédito")}
            >
              <ShieldCheck className="w-4 h-4 mr-2" /> Consultar Crédito
            </Button>
            <Button
              className="w-full" variant="outline" size="sm"
              disabled={actionLoading === "make_decision"}
              onClick={() => runAction("make_decision", "Avaliar decisão")}
            >
              <AlertTriangle className="w-4 h-4 mr-2" /> Avaliar Decisão
            </Button>
            <Button
              className="w-full" variant="outline" size="sm"
              disabled={actionLoading === "create_ixc_contract" || sale.stage !== "aprovado"}
              onClick={() => runAction("create_ixc_contract", "Gerar contrato IXC")}
            >
              <FileText className="w-4 h-4 mr-2" /> Gerar Contrato IXC
            </Button>
            <Button
              className="w-full" variant="outline" size="sm"
              disabled={actionLoading === "send_for_signature" || !sale.ixc_contract_id}
              onClick={() => runAction("send_for_signature", "Enviar para assinatura")}
            >
              <Send className="w-4 h-4 mr-2" /> Enviar para Assinatura
            </Button>
          </div>

          {/* Timeline */}
          {timeline.length > 0 && (
            <Section title="Linha do Tempo" icon={Clock}>
              <div className="space-y-2">
                {timeline.map((entry, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1" />
                      {i < timeline.length - 1 && <div className="w-px h-6 bg-border" />}
                    </div>
                    <div className="pb-2">
                      <p className="font-medium text-foreground">{entry.description}</p>
                      <p className="text-muted-foreground">{new Date(entry.timestamp).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground flex items-center gap-1"><Icon className="w-3 h-3" /> {label}</p>
      <p className="font-medium text-foreground truncate">{value || "—"}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="border border-border rounded-lg p-3">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2"><Icon className="w-3.5 h-3.5" /> {title}</p>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}