import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { agreementApi } from "@/functions/agreementApi";
import { useToast } from "@/components/ui/use-toast";
import {
  CheckCircle, Clock, XCircle, PenLine, FileText, Shield,
  RefreshCw, Loader2, Send, FileSignature, DollarSign,
  Eye, AlertTriangle, TrendingDown
} from "lucide-react";

const STATUS_CONFIG = {
  active:            { label: "Ativo",              bg: "bg-green-50",  border: "border-green-200", text: "text-green-700",   badge: "bg-green-100 text-green-700",   icon: CheckCircle },
  overdue:           { label: "Vencido",             bg: "bg-amber-50",  border: "border-amber-200", text: "text-amber-700",   badge: "bg-amber-100 text-amber-700",   icon: Clock },
  broken:            { label: "Quebrado",            bg: "bg-red-50",    border: "border-red-200",   text: "text-red-700",     badge: "bg-red-100 text-red-700",       icon: XCircle },
  paid:              { label: "Quitado",             bg: "bg-blue-50",   border: "border-blue-200",  text: "text-blue-700",    badge: "bg-blue-100 text-blue-700",     icon: Shield },
  pending_signature: { label: "Aguard. Assinatura",  bg: "bg-purple-50", border: "border-purple-200",text: "text-purple-700",  badge: "bg-purple-100 text-purple-700", icon: PenLine },
  none:              { label: "Sem acordo",           bg: "bg-gray-50",   border: "border-gray-200",  text: "text-gray-600",    badge: "bg-gray-100 text-gray-600",     icon: FileText },
};

const fmtBRL  = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export default function AgreementCheckPanel({ conversation, instance }) {
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing]   = useState(null);
  const { toast } = useToast();

  const check = useCallback(async () => {
    if (!conversation) return;
    setLoading(true);
    setError(null);
    try {
      const res = await agreementApi({
        action: "verify",
        phone: conversation.phone,
        customerId: conversation.customer_id || conversation.ixc_customer_id || undefined,
        conversationId: conversation.id,
        cpfCnpj: conversation.cpf_cnpj || undefined,
      });
      if (res?.data?.success) {
        setResult(res.data.data);
        // Mostrar aviso IXC se presente mas não crítico
        if (res.data.data?.ixc_warning) {
          setError({ type: "warning", message: res.data.data.ixc_warning });
        }
      } else {
        const errMsg = res?.data?.error?.message || "Falha na verificação de acordo";
        const errCode = res?.data?.error?.code || "UNKNOWN";
        setError({ type: "error", code: errCode, message: errMsg });
        setResult(null);
      }
    } catch (e) {
      setError({ type: "error", code: "NETWORK_ERROR", message: "Erro de conexão ao verificar acordo. Tente novamente." });
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [conversation]);

  useEffect(() => {
    check();
  }, [check]);

  const handleAction = async (action, agreementId, label) => {
    if (!agreementId) return;
    setActing(action);
    try {
      const res = await agreementApi({ action, agreementId, instance });
      if (res?.data?.success) {
        toast({ title: label });
        check();
      } else {
        toast({ title: res?.data?.error?.message || `Falha: ${label}`, variant: "destructive" });
      }
    } catch {
      toast({ title: `Erro ao executar: ${label}`, variant: "destructive" });
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <p className="text-xs">Verificando acordo...</p>
      </div>
    );
  }

  // Erro crítico (sem resultado)
  if (error?.type === "error" && !result) {
    const isIxcConfig  = error.code === "IXC_NOT_CONFIGURED";
    const isNotFound   = error.code === "IXC_CUSTOMER_NOT_FOUND";
    const isZapConfig  = error.code === "ZAPSIGN_NOT_CONFIGURED";
    return (
      <div className="space-y-3">
        <div className="p-3 rounded-xl border border-red-200 bg-red-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">
                {isIxcConfig ? "IXCSoft não configurado" :
                 isNotFound  ? "Cliente não encontrado no IXC" :
                 isZapConfig ? "ZapSign não configurado" :
                 "Erro na verificação"}
              </p>
              <p className="text-xs text-red-600 mt-1">{error.message}</p>
              {isIxcConfig && <p className="text-xs text-red-500 mt-1">Acesse Base44 → Configurações → Variáveis de Ambiente e configure IXC_API_URL e IXC_API_TOKEN.</p>}
              {isZapConfig && <p className="text-xs text-red-500 mt-1">Acesse Base44 → Configurações → Variáveis de Ambiente e configure ZAPSIGN_API_TOKEN.</p>}
            </div>
          </div>
        </div>
        <button onClick={check} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-accent transition-colors">
          <RefreshCw className="w-4 h-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  const status = result?.agreementStatus || "none";
  const cfg    = STATUS_CONFIG[status] || STATUS_CONFIG.none;
  const Icon   = cfg.icon;
  const agreement = result?.agreement;
  const invoices  = result?.invoices;
  const agreementId = agreement?.id;

  return (
    <div className="space-y-3">
      {/* Aviso não-crítico (ex: cliente IXC não encontrado mas acordo local existe) */}
      {error?.type === "warning" && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-200 bg-amber-50">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">{error.message}</p>
        </div>
      )}

      {/* Status banner */}
      <div className={`flex items-center justify-between p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${cfg.text}`} />
          <div>
            <p className={`text-sm font-bold ${cfg.text}`}>{cfg.label}</p>
            <p className="text-xs text-muted-foreground">
              {status === "none" ? "Sem acordo ativo" :
               status === "active" ? "Parcelas em dia" :
               status === "overdue" ? "Parcela(s) vencida(s)" :
               status === "broken" ? "Acordo quebrado por inadimplência" :
               status === "paid" ? "Acordo totalmente quitado" :
               "Aguardando assinatura do documento"}
            </p>
          </div>
        </div>
        <button
          onClick={check}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-white/60 transition-colors"
          title="Atualizar verificação"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${cfg.text} ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Agreement data */}
      {agreement && (
        <div className="bg-card border rounded-xl p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Valor negociado</p>
              <p className="font-semibold font-mono">{fmtBRL(agreement.negotiatedAmount || agreement.negotiated_amount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Valor restante</p>
              <p className={`font-semibold font-mono ${(agreement.remainingAmount || agreement.remaining_amount || 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                {fmtBRL(agreement.remainingAmount || agreement.remaining_amount)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Parcelas</p>
              <p className="font-medium">
                {agreement.paidInstallments || agreement.paid_installments || 0}/{agreement.installments || 1}
                {(agreement.overdueInstallments || agreement.overdue_installments || 0) > 0 && (
                  <span className="ml-1 text-red-500">({agreement.overdueInstallments || agreement.overdue_installments} atras.)</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Próx. vencimento</p>
              <p className="font-medium">{fmtDate(agreement.nextDueDate || agreement.next_due_date)}</p>
            </div>
            {(agreement.nextInstallmentAmount || agreement.next_installment_amount) && (
              <div className="col-span-2">
                <p className="text-muted-foreground">Valor da próxima parcela</p>
                <p className="font-semibold font-mono text-primary">{fmtBRL(agreement.nextInstallmentAmount || agreement.next_installment_amount)}</p>
              </div>
            )}
          </div>
          {agreement.notes && (
            <p className="text-xs text-muted-foreground border-t pt-2 italic">{agreement.notes}</p>
          )}
        </div>
      )}

      {/* IXC invoices summary */}
      {invoices && (invoices.open?.length > 0 || invoices.overdue?.length > 0) && (
        <div className="bg-card border rounded-xl p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" /> Títulos IXCSoft
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="bg-green-50 rounded-lg p-2">
              <p className="font-bold text-green-700">{invoices.paid?.length || 0}</p>
              <p className="text-green-600">Pagos</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2">
              <p className="font-bold text-amber-700">{invoices.open?.length || 0}</p>
              <p className="text-amber-600">Em aberto</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2">
              <p className="font-bold text-red-700">{invoices.overdue?.length || 0}</p>
              <p className="text-red-600">Vencidos</p>
            </div>
          </div>
          {invoices.overdue?.length > 0 && (
            <div className="mt-2 space-y-1">
              {invoices.overdue.slice(0, 3).map((inv) => (
                <div key={inv.id} className="flex justify-between text-xs">
                  <span className="text-red-600">{fmtDate(inv.due_date)}</span>
                  <span className="font-mono font-semibold text-red-700">{fmtBRL(inv.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-2">
        <button
          onClick={check}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-accent transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar Verificação
        </button>

        {agreementId && (
          <>
            <Link
              to={`/agreements/${agreementId}`}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
            >
              <Eye className="w-4 h-4" /> Ver Detalhes do Acordo
            </Link>

            <button
              onClick={() => handleAction("send_reminder", agreementId, "Lembrete enviado")}
              disabled={!!acting}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              {acting === "send_reminder" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar Lembrete
            </button>

            <button
              onClick={() => handleAction("generate_zapsign", agreementId, "Documento gerado")}
              disabled={!!acting}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-50"
            >
              {acting === "generate_zapsign" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSignature className="w-4 h-4" />}
              Gerar Acordo ZapSign
            </button>
          </>
        )}

        <Link
          to="/agreements/new"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-accent transition-colors"
        >
          <TrendingDown className="w-4 h-4" /> Renegociar / Novo Acordo
        </Link>

        <Link
          to="/financial"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm text-muted-foreground hover:bg-accent transition-colors"
        >
          <DollarSign className="w-4 h-4" /> Consultar Financeiro IXC
        </Link>
      </div>

      {/* Customer info */}
      {result?.customer && (
        <div className="text-xs text-muted-foreground pt-1 border-t">
          <p><span className="font-medium">Cliente:</span> {result.customer.name}</p>
          {result.customer.cpf_cnpj && <p><span className="font-medium">CPF/CNPJ:</span> {result.customer.cpf_cnpj}</p>}
          {result.customer.city && <p><span className="font-medium">Cidade:</span> {result.customer.city}</p>}
        </div>
      )}
    </div>
  );
}
