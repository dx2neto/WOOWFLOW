import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { PageContainer, Card } from "@/components/ui/app-card";
import { agreementApi } from "@/functions/agreementApi";
import { evolutionApi } from "@/functions/evolutionApi";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft, CheckCircle, Clock, XCircle, PenLine, FileText,
  DollarSign, Send, RefreshCw, Loader2, Shield, AlertTriangle, User, Calendar, FileSignature, History
} from "lucide-react";

const STATUS_CONFIG = {
  active:            { label: "Ativo",              color: "bg-green-100 text-green-700",   icon: CheckCircle },
  overdue:           { label: "Vencido",             color: "bg-amber-100 text-amber-700",   icon: Clock },
  broken:            { label: "Quebrado",            color: "bg-red-100 text-red-700",       icon: XCircle },
  paid:              { label: "Quitado",             color: "bg-blue-100 text-blue-700",     icon: CheckCircle },
  pending_signature: { label: "Aguard. Assinatura",  color: "bg-purple-100 text-purple-700", icon: PenLine },
  none:              { label: "Sem acordo",           color: "bg-gray-100 text-gray-600",     icon: FileText },
};

const INSTALLMENT_STATUS = {
  pending: { label: "Pendente", color: "text-amber-600" },
  paid:    { label: "Paga",     color: "text-green-600" },
  overdue: { label: "Vencida",  color: "text-red-600" },
  cancelled: { label: "Cancelada", color: "text-gray-400" },
};

const fmtBRL  = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export default function AgreementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = id === "new";

  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(!isNew);
  const [tab, setTab]             = useState("details");
  const [acting, setActing]       = useState(null);
  const [instances, setInstances] = useState([]);
  const [instance, setInstance]   = useState(() => localStorage.getItem("evolution_instance") || "");

  // Form state for new agreement
  const [form, setForm] = useState({
    customer_name: "", customer_phone: "", customer_cpf_cnpj: "",
    customer_city: "", original_amount: "", negotiated_amount: "",
    installments: 1, next_due_date: "", notes: "", origin: "manual",
  });

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const res = await agreementApi({ action: "get_agreement", agreementId: id });
      if (res?.data?.data) setData(res.data.data);
      else toast({ title: "Acordo não encontrado", variant: "destructive" });
    } catch {
      toast({ title: "Erro ao carregar acordo", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    load();
    evolutionApi({ action: "get_instances" }).then((r) => {
      const list = r?.data?.instances || [];
      setInstances(list);
      if (!instance && list.length > 0) {
        const first = list[0].name || list[0].instance?.instanceName || "";
        setInstance(first);
        localStorage.setItem("evolution_instance", first);
      }
    }).catch(() => {});
  }, [load]);

  const agreement    = data?.agreement;
  const installments = data?.installments || [];
  const logs         = data?.logs || [];

  const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.none;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${cfg.color}`}>
        <Icon className="w-4 h-4" /> {cfg.label}
      </span>
    );
  };

  const handleAction = async (actionName, label) => {
    if (acting) return;
    setActing(actionName);
    try {
      const res = await agreementApi({ action: actionName, agreementId: id, instance });
      if (res?.data?.success) {
        toast({ title: `${label} com sucesso` });
        load();
      } else {
        toast({ title: res?.data?.error?.message || `Falha: ${label}`, variant: "destructive" });
      }
    } catch {
      toast({ title: `Erro ao executar: ${label}`, variant: "destructive" });
    } finally {
      setActing(null);
    }
  };

  const handleSendReminder = async () => {
    if (!instance) { toast({ title: "Selecione uma instância WhatsApp", variant: "destructive" }); return; }
    await handleAction("send_reminder", "Lembrete enviado");
  };

  const handleGenerateZapSign = async () => {
    await handleAction("generate_zapsign", "Documento ZapSign gerado");
  };

  const handleMarkBroken = async () => {
    if (!confirm("Marcar este acordo como quebrado?")) return;
    await handleAction("mark_broken", "Acordo marcado como quebrado");
  };

  const handleMarkPaid = async () => {
    if (!confirm("Marcar este acordo como quitado?")) return;
    await handleAction("mark_paid", "Acordo marcado como quitado");
  };

  const handleCreateNew = async () => {
    if (!form.customer_name || !form.original_amount) {
      toast({ title: "Nome e valor original são obrigatórios", variant: "destructive" });
      return;
    }
    setActing("create");
    try {
      const origAmt = parseFloat(String(form.original_amount).replace(",", ".")) || 0;
      const negAmt  = parseFloat(String(form.negotiated_amount || form.original_amount).replace(",", ".")) || origAmt;
      const res = await agreementApi({
        action: "create_agreement",
        data: {
          ...form,
          original_amount:  origAmt,
          negotiated_amount: negAmt,
          remaining_amount:  negAmt,
          paid_amount: 0,
          installments: parseInt(String(form.installments), 10) || 1,
        },
      });
      if (res?.data?.success && res?.data?.data?.id) {
        toast({ title: "Acordo criado com sucesso" });
        navigate(`/agreements/${res.data.data.id}`);
      } else {
        toast({ title: res?.data?.error?.message || "Falha ao criar acordo", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao criar acordo", variant: "destructive" });
    } finally {
      setActing(null);
    }
  };

  if (isNew) {
    return (
      <PageContainer>
        <div className="flex items-center gap-3 mb-6">
          <Link to="/agreements" className="p-2 rounded-lg hover:bg-accent transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold">Novo Acordo</h1>
        </div>
        <Card className="p-6 max-w-2xl">
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: "customer_name", label: "Nome do Cliente *", col: 2 },
              { key: "customer_phone", label: "Telefone" },
              { key: "customer_cpf_cnpj", label: "CPF / CNPJ" },
              { key: "customer_city", label: "Cidade" },
              { key: "original_amount", label: "Valor Original (R$) *", type: "number" },
              { key: "negotiated_amount", label: "Valor Negociado (R$)", type: "number" },
              { key: "installments", label: "Nº de Parcelas", type: "number" },
              { key: "next_due_date", label: "1ª Data de Vencimento", type: "date" },
              { key: "notes", label: "Observações", col: 2, multiline: true },
            ].map(({ key, label, col, type, multiline }) => (
              <div key={key} className={col === 2 ? "col-span-2" : ""}>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>
                {multiline ? (
                  <textarea
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                ) : (
                  <input
                    type={type || "text"}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleCreateNew}
              disabled={!!acting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Criar Acordo
            </button>
            <Link to="/agreements" className="px-5 py-2.5 rounded-lg border text-sm font-medium hover:bg-accent transition-colors">
              Cancelar
            </Link>
          </div>
        </Card>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  if (!agreement) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <AlertTriangle className="w-10 h-10 mb-3 opacity-40" />
          <p>Acordo não encontrado</p>
          <Link to="/agreements" className="mt-4 text-primary text-sm hover:underline">← Voltar</Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/agreements" className="p-2 rounded-lg hover:bg-accent transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{agreement.customer_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={agreement.status} />
              <span className="text-xs text-muted-foreground">Origem: {agreement.origin || "manual"}</span>
            </div>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-accent transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        {instance && (
          <select
            value={instance}
            onChange={(e) => { setInstance(e.target.value); localStorage.setItem("evolution_instance", e.target.value); }}
            className="px-2 py-1.5 text-xs border rounded-lg bg-background"
          >
            {instances.map((inst) => {
              const name = inst.name || inst.instance?.instanceName || "";
              return <option key={name} value={name}>{name}</option>;
            })}
          </select>
        )}
        <button
          onClick={handleSendReminder}
          disabled={!!acting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
        >
          {acting === "send_reminder" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Enviar Lembrete
        </button>
        <button
          onClick={handleGenerateZapSign}
          disabled={!!acting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 text-xs font-medium hover:bg-purple-100 transition-colors disabled:opacity-50"
        >
          {acting === "generate_zapsign" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSignature className="w-3.5 h-3.5" />}
          Gerar ZapSign
        </button>
        {agreement.status !== "paid" && (
          <button
            onClick={handleMarkPaid}
            disabled={!!acting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            {acting === "mark_paid" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
            Marcar Quitado
          </button>
        )}
        {agreement.status !== "broken" && agreement.status !== "paid" && (
          <button
            onClick={handleMarkBroken}
            disabled={!!acting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            {acting === "mark_broken" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Marcar Quebrado
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {[
          { key: "details",      label: "Detalhes",   icon: FileText },
          { key: "installments", label: "Parcelas",   icon: DollarSign },
          { key: "history",      label: "Histórico",  icon: History },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {tab === "details" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer */}
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Dados do Cliente</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Nome</dt><dd className="font-medium">{agreement.customer_name || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Telefone</dt><dd>{agreement.customer_phone || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">CPF/CNPJ</dt><dd>{agreement.customer_cpf_cnpj || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Cidade</dt><dd>{agreement.customer_city || "—"}</dd></div>
            </dl>
          </Card>

          {/* Financial */}
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Dados Financeiros</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Valor Original</dt><dd className="font-mono font-semibold">{fmtBRL(agreement.original_amount)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Valor Negociado</dt><dd className="font-mono font-semibold text-primary">{fmtBRL(agreement.negotiated_amount)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Valor Pago</dt><dd className="font-mono text-green-600">{fmtBRL(agreement.paid_amount)}</dd></div>
              <div className="flex justify-between border-t pt-2"><dt className="text-muted-foreground font-medium">Restante</dt><dd className={`font-mono font-bold ${agreement.remaining_amount > 0 ? "text-red-600" : "text-green-600"}`}>{fmtBRL(agreement.remaining_amount)}</dd></div>
            </dl>
          </Card>

          {/* Installments summary */}
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Calendar className="w-4 h-4" /> Parcelas</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Total de parcelas</dt><dd>{agreement.installments || 1}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Parcelas pagas</dt><dd className="text-green-600 font-semibold">{agreement.paid_installments || 0}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Parcelas vencidas</dt><dd className={`font-semibold ${(agreement.overdue_installments || 0) > 0 ? "text-red-600" : "text-muted-foreground"}`}>{agreement.overdue_installments || 0}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Próx. vencimento</dt><dd className="font-medium">{fmtDate(agreement.next_due_date)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Valor da próxima</dt><dd className="font-mono">{fmtBRL(agreement.next_installment_amount)}</dd></div>
            </dl>
          </Card>

          {/* ZapSign */}
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><FileSignature className="w-4 h-4" /> Assinatura ZapSign</h3>
            {agreement.zapsign_document_id ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt>
                  <dd><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${agreement.zapsign_status === "signed" ? "bg-green-100 text-green-700" : agreement.zapsign_status === "pending" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{agreement.zapsign_status || "pending"}</span></dd>
                </div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Doc ID</dt><dd className="font-mono text-xs truncate max-w-[150px]" title={agreement.zapsign_document_id}>{agreement.zapsign_document_id}</dd></div>
                {agreement.zapsign_signed_at && <div className="flex justify-between"><dt className="text-muted-foreground">Assinado em</dt><dd>{fmtDate(agreement.zapsign_signed_at)}</dd></div>}
                {agreement.zapsign_url && <a href={agreement.zapsign_url} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline">Ver documento →</a>}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum documento vinculado. Clique em "Gerar ZapSign" para criar.</p>
            )}
          </Card>

          {/* Notes */}
          {agreement.notes && (
            <Card className="p-4 md:col-span-2">
              <h3 className="font-semibold text-sm mb-2">Observações</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{agreement.notes}</p>
            </Card>
          )}
        </div>
      )}

      {/* Installments Tab */}
      {tab === "installments" && (
        <Card>
          {installments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <DollarSign className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma parcela registrada</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Nº</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Valor</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Vencimento</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Pagamento</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {installments.map((inst) => {
                  const cfg = INSTALLMENT_STATUS[inst.status] || INSTALLMENT_STATUS.pending;
                  return (
                    <tr key={inst.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-muted-foreground">#{inst.installment_number}</td>
                      <td className="px-4 py-3 text-right font-mono">{fmtBRL(inst.amount)}</td>
                      <td className="px-4 py-3">{fmtDate(inst.due_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{inst.paid_at ? fmtDate(inst.paid_at) : "—"}</td>
                      <td className="px-4 py-3"><span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <Card>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <History className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Sem histórico de verificações</p>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="px-4 py-3 flex items-start gap-3">
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${log.status === "success" ? "bg-green-400" : log.status === "error" ? "bg-red-400" : "bg-amber-400"}`} />
                  <div>
                    <p className="text-sm font-medium">{log.input_type}: <span className="font-mono text-xs">{log.input_value}</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5">{log.result_summary}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(log.created_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </PageContainer>
  );
}
