import React, { useState, useEffect, useCallback } from "react";
import { zapsignApi } from "@/functions/zapsignApi";
import { PageContainer, StatCard, Card } from "@/components/ui/app-card";
import { useToast } from "@/components/ui/use-toast";
import SendContractModal from "@/components/signatures/SendContractModal";
import {
  FileSignature, CheckCircle, Clock, XCircle, Send, Plus,
  RefreshCw, Loader2, FileText, Trash2, Edit2,
  ExternalLink, AlertTriangle, Save, X, Search
} from "lucide-react";

// ── Config maps ───────────────────────────────────────────────────────────────
const DOC_TYPE_LABEL = {
  contrato: "Contrato", termo_adesao: "Termo de Adesão", termo_comodato: "Termo de Comodato",
  termo_permanencia: "Termo de Permanência", aceite_eletronico: "Aceite Eletrônico", aditivo: "Aditivo"
};
const STATUS_CFG = {
  pendente: { label: "Pendente",  bg: "bg-amber-100 text-amber-700",  Icon: Clock },
  assinado: { label: "Assinado",  bg: "bg-green-100 text-green-700",  Icon: CheckCircle },
  expirado: { label: "Expirado",  bg: "bg-red-100 text-red-700",      Icon: XCircle },
  cancelado: { label: "Cancelado",bg: "bg-gray-100 text-gray-700",   Icon: XCircle },
  erro:      { label: "Erro",     bg: "bg-red-100 text-red-700",      Icon: AlertTriangle },
};

// ── Default template variables ────────────────────────────────────────────────
const DEFAULT_VARIABLES = [
  { key: "nome_cliente",       label: "Nome do cliente",       source: "ixc" },
  { key: "cpf_cnpj",          label: "CPF/CNPJ",              source: "ixc" },
  { key: "email",             label: "E-mail",                source: "ixc" },
  { key: "telefone",          label: "Telefone",              source: "ixc" },
  { key: "endereco",          label: "Endereço",              source: "ixc" },
  { key: "cidade",            label: "Cidade",                source: "ixc" },
  { key: "estado",            label: "Estado",                source: "ixc" },
  { key: "plano",             label: "Nome do plano",         source: "ixc" },
  { key: "valor_mensalidade", label: "Valor da mensalidade",  source: "ixc" },
  { key: "data_inicio",       label: "Data de início",        source: "ixc" },
  { key: "id_contrato",       label: "ID do contrato",        source: "ixc" },
  { key: "data_hoje",         label: "Data atual",            source: "ixc" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Componente TemplateFormModal
// ─────────────────────────────────────────────────────────────────────────────
function TemplateFormModal({ open, template, onClose, onSave }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", document_type: "contrato",
    zapsign_template_id: "", expires_in_days: 30,
    send_via_whatsapp: true, send_via_email: false, active: true,
    whatsapp_message_template: "",
    variables: JSON.stringify(DEFAULT_VARIABLES, null, 2),
    extra_signers: "[]",
  });

  useEffect(() => {
    if (template) {
      setForm({
        name: template.name || "",
        description: template.description || "",
        document_type: template.document_type || "contrato",
        zapsign_template_id: template.zapsign_template_id || "",
        expires_in_days: template.expires_in_days || 30,
        send_via_whatsapp: template.send_via_whatsapp !== false,
        send_via_email: template.send_via_email || false,
        active: template.active !== false,
        whatsapp_message_template: template.whatsapp_message_template || "",
        variables: template.variables || JSON.stringify(DEFAULT_VARIABLES, null, 2),
        extra_signers: template.extra_signers || "[]",
      });
    } else {
      setForm((f) => ({ ...f, name: "", description: "", zapsign_template_id: "", whatsapp_message_template: "", variables: JSON.stringify(DEFAULT_VARIABLES, null, 2), extra_signers: "[]" }));
    }
  }, [template, open]);

  async function handleSave() {
    if (!form.name.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await zapsignApi({ action: "save_template", id: template?.id, ...form });
      if (res?.data?.success) { toast({ title: template ? "Template atualizado" : "Template criado" }); onSave(); }
      else toast({ title: res?.data?.error?.message || "Falha ao salvar", variant: "destructive" });
    } catch { toast({ title: "Erro ao salvar template", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-background rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-base">{template ? "Editar Template" : "Novo Template"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Nome do template *</label>
              <input className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:border-primary" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Contrato Residencial Fibra" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Descrição</label>
              <input className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:border-primary" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Uso interno" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo de documento</label>
              <select className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:border-primary" value={form.document_type} onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value }))}>
                {Object.entries(DOC_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Validade (dias)</label>
              <input type="number" className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:border-primary" value={form.expires_in_days} onChange={(e) => setForm((f) => ({ ...f, expires_in_days: Number(e.target.value) }))} min={1} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">ID do Template ZapSign</label>
              <input className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:border-primary font-mono" value={form.zapsign_template_id} onChange={(e) => setForm((f) => ({ ...f, zapsign_template_id: e.target.value }))} placeholder="Obtenha no painel ZapSign → Templates" />
              <p className="text-[11px] text-muted-foreground mt-0.5">Encontrado em: ZapSign → Modelos → &lt;seu modelo&gt; → ID/Token</p>
            </div>
          </div>

          {/* Flags */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "send_via_whatsapp", label: "Enviar por WhatsApp" },
              { key: "send_via_email", label: "Enviar por e-mail" },
              { key: "active", label: "Template ativo" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer hover:bg-muted/30 text-sm">
                <input type="checkbox" checked={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))} className="accent-primary" />
                {label}
              </label>
            ))}
          </div>

          {/* Mensagem WhatsApp */}
          {form.send_via_whatsapp && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Mensagem WhatsApp</label>
              <p className="text-[11px] text-muted-foreground">Variáveis: {"{nome}"} {"{link_assinatura}"} {"{plano}"} {"{valor}"} {"{tipo_doc}"}</p>
              <textarea className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:border-primary resize-y font-mono text-xs" rows={4} value={form.whatsapp_message_template} onChange={(e) => setForm((f) => ({ ...f, whatsapp_message_template: e.target.value }))} placeholder={`Olá, {nome}! Seu {tipo_doc} está pronto para assinatura:\n{link_assinatura}`} />
            </div>
          )}

          {/* Variáveis (JSON) */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Variáveis do template (JSON)
              <span className="ml-2 text-[10px] text-muted-foreground font-normal">source: "ixc" = preenchido automático do IXCSoft | "manual" = usuário preenche</span>
            </label>
            <textarea className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-xs font-mono focus:outline-none focus:border-primary resize-y" rows={8} value={form.variables} onChange={(e) => setForm((f) => ({ ...f, variables: e.target.value }))} spellCheck={false} />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Template
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal: Signatures
// ─────────────────────────────────────────────────────────────────────────────
export default function Signatures() {
  const { toast } = useToast();
  const [tab, setTab]         = useState("docs");   // "docs" | "templates"
  const [loading, setLoading] = useState(true);
  const [docs, setDocs]       = useState([]);
  const [templates, setTemplates] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch]   = useState("");

  // Modals
  const [sendModal, setSendModal]       = useState(false);
  const [templateModal, setTemplateModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);

  // Actions in progress
  const [actingId, setActingId] = useState(null);
  const [syncingStatus, setSyncingStatus] = useState(false);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await zapsignApi({ action: "list_docs", status: statusFilter, search, limit: 200 });
      if (res?.data?.success) setDocs(res.data.data || []);
      else setDocs([]);
    } catch { setDocs([]); }
    finally { setLoading(false); }
  }, [statusFilter, search]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await zapsignApi({ action: "list_templates" });
      if (res?.data?.success) setTemplates(res.data.data || []);
    } catch { setTemplates([]); }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const pending  = docs.filter((d) => d.status === "pendente").length;
  const signed   = docs.filter((d) => d.status === "assinado").length;
  const expired  = docs.filter((d) => d.status === "expirado").length;

  async function handleResend(doc) {
    setActingId(doc.id);
    try {
      const res = await zapsignApi({ action: "resend", id: doc.id });
      if (res?.data?.success) toast({ title: "Lembrete enviado por WhatsApp" });
      else toast({ title: res?.data?.error?.message || "Falha ao reenviar", variant: "destructive" });
    } catch { toast({ title: "Erro ao reenviar", variant: "destructive" }); }
    finally { setActingId(null); }
  }

  async function handleCancel(doc) {
    if (!confirm(`Cancelar documento de ${doc.customer_name}? Esta ação não pode ser desfeita.`)) return;
    setActingId(doc.id);
    try {
      const res = await zapsignApi({ action: "cancel", id: doc.id });
      if (res?.data?.success) { toast({ title: "Documento cancelado" }); loadDocs(); }
      else toast({ title: res?.data?.error?.message || "Falha ao cancelar", variant: "destructive" });
    } catch { toast({ title: "Erro ao cancelar", variant: "destructive" }); }
    finally { setActingId(null); }
  }

  async function handleSyncStatus() {
    setSyncingStatus(true);
    try {
      const res = await zapsignApi({ action: "sync_status" });
      if (res?.data?.success) {
        toast({ title: `${res.data.data.updated} documento(s) atualizados` });
        loadDocs();
      } else toast({ title: res?.data?.error?.message || "Falha na sincronização", variant: "destructive" });
    } catch { toast({ title: "Erro na sincronização", variant: "destructive" }); }
    finally { setSyncingStatus(false); }
  }

  async function handleDeleteTemplate(t) {
    if (!confirm(`Excluir template "${t.name}"?`)) return;
    try {
      const res = await zapsignApi({ action: "delete_template", id: t.id });
      if (res?.data?.success) { toast({ title: "Template excluído" }); loadTemplates(); }
      else toast({ title: "Falha ao excluir", variant: "destructive" });
    } catch { toast({ title: "Erro ao excluir", variant: "destructive" }); }
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Assinatura de Contratos</h2>
          <p className="text-sm text-muted-foreground">ZapSign · IXCSoft · WhatsApp</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncStatus}
            disabled={syncingStatus}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncingStatus ? "animate-spin" : ""}`} />
            Sincronizar status
          </button>
          <button
            onClick={() => setSendModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" /> Enviar Contrato
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Pendentes"  value={pending}      icon={Clock}          color="warning" />
        <StatCard title="Assinados"  value={signed}       icon={CheckCircle}    color="accent" />
        <StatCard title="Expirados"  value={expired}      icon={XCircle}        color="danger" />
        <StatCard title="Total"      value={docs.length}  icon={FileSignature}  color="primary" />
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {[["docs", "Documentos"], ["templates", "Templates"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Documentos ─────────────────────────────────────────────── */}
      {tab === "docs" && (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:border-primary"
                placeholder="Buscar por cliente, CPF, plano..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadDocs()}
              />
            </div>
            <select
              className="px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:border-primary"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos os status</option>
              {Object.entries(STATUS_CFG).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Cliente", "Tipo", "Template", "Contrato IXC", "Status", "Criado em", "Venc.", "WhatsApp", "Ações"].map((h) => (
                      <th key={h} className="text-left font-semibold px-3 py-3 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
                  ) : docs.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">Nenhum documento encontrado</td></tr>
                  ) : docs.map((doc) => {
                    const scfg = STATUS_CFG[doc.status] || STATUS_CFG.pendente;
                    const Icon = scfg.Icon;
                    const acting = actingId === doc.id;
                    return (
                      <tr key={doc.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-3">
                          <p className="font-medium">{doc.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{doc.phone}</p>
                          {doc.customer_cpf_cnpj && <p className="text-xs text-muted-foreground">{doc.customer_cpf_cnpj}</p>}
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-xs">{DOC_TYPE_LABEL[doc.document_type] || doc.document_type}</span>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground max-w-[120px] truncate">{doc.template_name || "—"}</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          {doc.ixc_contract_id ? (
                            <div>
                              <p>{doc.plan_name || `#${doc.ixc_contract_id}`}</p>
                              {doc.plan_value > 0 && <p className="text-[11px]">R$ {Number(doc.plan_value).toFixed(2)}</p>}
                            </div>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${scfg.bg}`}>
                            <Icon className="w-3 h-3" /> {scfg.label}
                          </span>
                          {doc.signed_date && <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(doc.signed_date).toLocaleDateString("pt-BR")}</p>}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{doc.created_date ? new Date(doc.created_date).toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{doc.expires_at ? new Date(doc.expires_at).toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="px-3 py-3">
                          {doc.whatsapp_sent ? (
                            <span className="text-[11px] text-green-600 font-medium">✓ Enviado</span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Não enviado</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            {doc.sign_url && (
                              <a href={doc.sign_url} target="_blank" rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Abrir link de assinatura">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {doc.status === "pendente" && (
                              <button onClick={() => handleResend(doc)} disabled={acting}
                                className="p-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50" title="Reenviar via WhatsApp">
                                {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            {doc.status === "pendente" && (
                              <button onClick={() => handleCancel(doc)} disabled={acting}
                                className="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50" title="Cancelar">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── Tab: Templates ──────────────────────────────────────────────── */}
      {tab === "templates" && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => { setEditTemplate(null); setTemplateModal(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" /> Novo Template
            </button>
          </div>

          {templates.length === 0 ? (
            <Card className="p-10 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold">Nenhum template cadastrado</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Crie um template para começar a enviar contratos via ZapSign.</p>
              <button onClick={() => { setEditTemplate(null); setTemplateModal(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
                <Plus className="w-4 h-4" /> Criar primeiro template
              </button>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {templates.map((t) => (
                <Card key={t.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-sm">{t.name}</span>
                        {t.active !== false ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">Ativo</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">Inativo</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{DOC_TYPE_LABEL[t.document_type] || t.document_type}</p>
                      {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {t.zapsign_template_id ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium font-mono">{t.zapsign_template_id}</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> Sem ID ZapSign
                          </span>
                        )}
                        {t.send_via_whatsapp && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">WhatsApp</span>}
                        {t.send_via_email && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium">E-mail</span>}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t.expires_in_days || 30}d validade</span>
                        {(t.usage_count || 0) > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t.usage_count}× usado</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => { setEditTemplate(t); setTemplateModal(true); }}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Editar">
                        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => handleDeleteTemplate(t)}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Excluir">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <SendContractModal
        open={sendModal}
        onClose={() => setSendModal(false)}
        onSuccess={() => { setSendModal(false); loadDocs(); }}
      />
      <TemplateFormModal
        open={templateModal}
        template={editTemplate}
        onClose={() => setTemplateModal(false)}
        onSave={() => { setTemplateModal(false); loadTemplates(); }}
      />
    </PageContainer>
  );
}
