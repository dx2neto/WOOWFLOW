import React, { useState, useEffect, useCallback } from "react";
import { zapsignApi } from "@/functions/zapsignApi";
import { useToast } from "@/components/ui/use-toast";
import {
  X, Search, Loader2, ChevronRight, ChevronLeft,
  User, FileText, Send, CheckCircle, AlertTriangle, RefreshCw
} from "lucide-react";

const DOC_TYPE_LABEL = {
  contrato: "Contrato", termo_adesao: "Termo de Adesão", termo_comodato: "Termo de Comodato",
  termo_permanencia: "Termo de Permanência", aceite_eletronico: "Aceite Eletrônico", aditivo: "Aditivo"
};

const STEPS = ["Cliente IXC", "Template", "Confirmar & Enviar"];

export default function SendContractModal({ open, onClose, onSuccess }) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);

  // Step 0 — busca cliente
  const [query, setQuery]               = useState("");
  const [searching, setSearching]       = useState(false);
  const [customers, setCustomers]       = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [contracts, setContracts]       = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [useManualMode, setUseManualMode] = useState(false);

  // Manual mode fields
  const [manualName, setManualName]     = useState("");
  const [manualPhone, setManualPhone]   = useState("");
  const [manualEmail, setManualEmail]   = useState("");
  const [manualCpf, setManualCpf]       = useState("");

  // Step 1 — template
  const [templates, setTemplates]       = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [manualVars, setManualVars]     = useState({});

  // Step 2 — envio
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [sending, setSending]           = useState(false);
  const [result, setResult]             = useState(null);

  useEffect(() => {
    if (!open) { reset(); return; }
    loadTemplates();
  }, [open]);

  function reset() {
    setStep(0); setQuery(""); setCustomers([]); setSelectedCustomer(null);
    setContracts([]); setSelectedContract(null); setSelectedTemplate(null);
    setManualVars({}); setResult(null); setSending(false);
    setManualName(""); setManualPhone(""); setManualEmail(""); setManualCpf("");
    setUseManualMode(false);
  }

  async function loadTemplates() {
    setLoadingTemplates(true);
    try {
      const res = await zapsignApi({ action: "list_templates" });
      if (res?.data?.success) setTemplates((res.data.data || []).filter((t) => t.active !== false));
    } catch { setTemplates([]); }
    finally { setLoadingTemplates(false); }
  }

  const searchCustomers = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setCustomers([]);
    try {
      const res = await zapsignApi({ action: "lookup_ixc_customer", query: query.trim() });
      if (res?.data?.success) setCustomers(res.data.data || []);
      else toast({ title: res?.data?.error?.message || "Erro ao buscar clientes", variant: "destructive" });
    } catch { toast({ title: "Erro de conexão", variant: "destructive" }); }
    finally { setSearching(false); }
  }, [query, toast]);

  async function selectCustomer(c) {
    setSelectedCustomer(c);
    setSelectedContract(null);
    setContracts([]);
    setLoadingContracts(true);
    try {
      const res = await zapsignApi({ action: "get_ixc_contracts", ixcCustomerId: c.id });
      if (res?.data?.success) setContracts(res.data.data || []);
    } catch { setContracts([]); }
    finally { setLoadingContracts(false); }
  }

  // Parse template variables — manual ones needing user input
  const manualTemplateVars = selectedTemplate
    ? JSON.parse(selectedTemplate.variables || "[]").filter((v) => v.source !== "ixc")
    : [];

  async function handleSend() {
    if (!selectedTemplate) return;
    setSending(true);
    try {
      let res;
      if (useManualMode || !selectedCustomer) {
        res = await zapsignApi({
          action: "create_manual",
          templateId: selectedTemplate.id,
          customerName: manualName,
          customerPhone: manualPhone,
          customerEmail: manualEmail,
          cpfCnpj: manualCpf,
          manualVariables: manualVars,
          sendWhatsApp,
        });
      } else {
        res = await zapsignApi({
          action: "create_from_ixc",
          ixcCustomerId: selectedCustomer.id,
          ixcContractId: selectedContract?.id,
          templateId: selectedTemplate.id,
          manualVariables: manualVars,
          sendWhatsApp,
        });
      }

      if (res?.data?.success) {
        setResult(res.data.data);
        onSuccess?.();
      } else {
        toast({ title: res?.data?.error?.message || "Falha ao criar documento", variant: "destructive" });
      }
    } catch { toast({ title: "Erro ao enviar contrato", variant: "destructive" }); }
    finally { setSending(false); }
  }

  function canProceedStep0() {
    if (useManualMode) return manualName.trim() && manualPhone.trim();
    return selectedCustomer !== null;
  }

  function canProceedStep1() {
    return selectedTemplate !== null;
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-background rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-lg">Enviar Contrato para Assinatura</h2>
            <p className="text-xs text-muted-foreground">ZapSign + IXCSoft + WhatsApp</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 px-6 py-3 border-b bg-muted/20">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg ${i === step ? "bg-primary text-primary-foreground" : i < step ? "text-green-600" : "text-muted-foreground"}`}>
                {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[10px]">{i + 1}</span>}
                {s}
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ─ Step 0: Cliente ──────────────────────────────────────── */}
          {step === 0 && !result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setUseManualMode(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!useManualMode ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                >
                  Buscar no IXCSoft
                </button>
                <button
                  onClick={() => { setUseManualMode(true); setSelectedCustomer(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${useManualMode ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                >
                  Inserir manualmente
                </button>
              </div>

              {!useManualMode ? (
                <>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <input
                        className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:border-primary"
                        placeholder="Nome, CPF ou CNPJ do cliente IXC..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && searchCustomers()}
                      />
                    </div>
                    <button
                      onClick={searchCustomers}
                      disabled={searching || !query.trim()}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                    >
                      {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Buscar
                    </button>
                  </div>

                  {customers.length > 0 && (
                    <div className="border rounded-xl overflow-hidden">
                      {customers.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => selectCustomer(c)}
                          className={`w-full text-left px-4 py-3 border-b last:border-0 hover:bg-muted/50 transition-colors flex items-center gap-3 ${selectedCustomer?.id === c.id ? "bg-primary/10 border-primary/20" : ""}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{c.nome_razao || c.nome}</p>
                            <p className="text-xs text-muted-foreground">{c.cnpj_cpf} · {c.telefone_celular || c.fone}</p>
                          </div>
                          {selectedCustomer?.id === c.id && <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Contratos do cliente selecionado */}
                  {selectedCustomer && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        Contratos de {selectedCustomer.nome_razao || selectedCustomer.nome}
                        {loadingContracts && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
                      </p>
                      {contracts.length > 0 ? (
                        <div className="border rounded-xl overflow-hidden">
                          <button
                            onClick={() => setSelectedContract(null)}
                            className={`w-full text-left px-4 py-2.5 border-b text-xs text-muted-foreground hover:bg-muted/50 ${!selectedContract ? "bg-primary/10" : ""}`}
                          >
                            Sem contrato específico (dados gerais do cliente)
                          </button>
                          {contracts.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => setSelectedContract(c)}
                              className={`w-full text-left px-4 py-2.5 border-b last:border-0 hover:bg-muted/50 transition-colors ${selectedContract?.id === c.id ? "bg-primary/10" : ""}`}
                            >
                              <p className="text-sm font-medium">{c.descricao || c.plano || `Contrato #${c.id}`}</p>
                              <p className="text-xs text-muted-foreground">
                                {c.status === "A" ? "Ativo" : c.status} · {c.valor ? `R$ ${Number(c.valor).toFixed(2)}` : ""} · ID: {c.id}
                              </p>
                            </button>
                          ))}
                        </div>
                      ) : !loadingContracts && (
                        <p className="text-xs text-muted-foreground italic">Nenhum contrato encontrado para este cliente.</p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* Modo manual */
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Nome completo *</label>
                    <input className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:border-primary" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Nome do cliente" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Telefone (WhatsApp) *</label>
                    <input className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:border-primary" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} placeholder="11999990000" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">CPF/CNPJ</label>
                    <input className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:border-primary" value={manualCpf} onChange={(e) => setManualCpf(e.target.value)} placeholder="000.000.000-00" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">E-mail (opcional)</label>
                    <input className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:border-primary" value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} placeholder="email@cliente.com" type="email" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─ Step 1: Template ─────────────────────────────────────── */}
          {step === 1 && !result && (
            <div className="space-y-4">
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" /> Carregando templates...
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="font-medium">Nenhum template cadastrado</p>
                  <p className="text-sm text-muted-foreground mt-1">Crie um template em Assinatura de Contratos → Templates antes de enviar documentos.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTemplate(t); setManualVars({}); }}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedTemplate?.id === t.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">{t.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{DOC_TYPE_LABEL[t.document_type] || t.document_type}</p>
                          {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {t.zapsign_template_id ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">Template ZapSign</span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Sem template ZapSign</span>
                          )}
                          {t.send_via_whatsapp && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">WhatsApp</span>}
                          {t.usage_count > 0 && <span className="text-[10px] text-muted-foreground">{t.usage_count}× usado</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Variáveis manuais do template selecionado */}
              {selectedTemplate && manualTemplateVars.length > 0 && (
                <div className="border rounded-xl p-4 bg-muted/20 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">Preencher variáveis manuais do template</p>
                  {manualTemplateVars.map((v) => (
                    <div key={v.key}>
                      <label className="text-xs font-medium">{v.label || v.key}</label>
                      <input
                        className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:border-primary"
                        value={manualVars[v.key] || ""}
                        onChange={(e) => setManualVars((p) => ({ ...p, [v.key]: e.target.value }))}
                        placeholder={v.default || v.label || v.key}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─ Step 2: Confirmar ────────────────────────────────────── */}
          {step === 2 && !result && (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 font-semibold text-base mb-3">
                  <FileText className="w-5 h-5 text-primary" />
                  Resumo do envio
                </div>
                <div className="grid grid-cols-2 gap-y-2">
                  <span className="text-muted-foreground text-xs">Cliente</span>
                  <span className="font-medium text-xs">{selectedCustomer ? (selectedCustomer.nome_razao || selectedCustomer.nome) : manualName}</span>
                  <span className="text-muted-foreground text-xs">Telefone</span>
                  <span className="font-medium text-xs">{selectedCustomer?.telefone_celular || selectedCustomer?.fone || manualPhone}</span>
                  {selectedContract && (
                    <>
                      <span className="text-muted-foreground text-xs">Contrato IXC</span>
                      <span className="font-medium text-xs">{selectedContract.descricao || `#${selectedContract.id}`}</span>
                    </>
                  )}
                  <span className="text-muted-foreground text-xs">Template</span>
                  <span className="font-medium text-xs">{selectedTemplate?.name}</span>
                  <span className="text-muted-foreground text-xs">Tipo de documento</span>
                  <span className="font-medium text-xs">{DOC_TYPE_LABEL[selectedTemplate?.document_type] || selectedTemplate?.document_type}</span>
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-muted/30">
                <input type="checkbox" checked={sendWhatsApp} onChange={(e) => setSendWhatsApp(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                <div>
                  <p className="text-sm font-medium">Enviar link por WhatsApp</p>
                  <p className="text-xs text-muted-foreground">O cliente receberá o link de assinatura na instância CONNECT</p>
                </div>
              </label>

              {!selectedTemplate?.zapsign_template_id && (
                <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">Este template não possui um <strong>zapsign_template_id</strong> configurado. O envio irá falhar. Configure o ID do template ZapSign na página de Templates.</p>
                </div>
              )}
            </div>
          )}

          {/* ─ Resultado ────────────────────────────────────────────── */}
          {result && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold">Documento criado!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.whatsapp_sent ? "Link de assinatura enviado por WhatsApp." : "Documento criado. Link de assinatura disponível abaixo."}
                </p>
              </div>
              {result.sign_url && (
                <a
                  href={result.sign_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                >
                  <FileText className="w-4 h-4" /> Ver link de assinatura
                </a>
              )}
              <button onClick={onClose} className="block mx-auto text-sm text-muted-foreground hover:underline">Fechar</button>
            </div>
          )}
        </div>

        {/* Footer */}
        {!result && (
          <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/10">
            <button
              onClick={() => step === 0 ? onClose() : setStep((s) => s - 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {step === 0 ? "Cancelar" : "Voltar"}
            </button>

            {step < 2 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 0 ? !canProceedStep0() : !canProceedStep1()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={sending || !selectedTemplate}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Enviando..." : "Enviar Contrato"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
