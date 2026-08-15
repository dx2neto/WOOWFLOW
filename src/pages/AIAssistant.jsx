import React, { useState, useRef, useEffect, useCallback } from "react";
import { PageContainer, Card } from "@/components/ui/app-card";
import { aiOrchestrator } from "@/functions/aiOrchestrator";
import { ixcApi } from "@/functions/ixcApi";
import { Send, Bot, User, Zap, AlertTriangle, TrendingUp, TrendingDown, Loader2, Eye, FileText, Wrench, Package, UserCheck, CreditCard } from "lucide-react";
import SpecialistDataView from "@/components/ai/SpecialistDataView";
import BehaviorReportView from "@/components/ai/BehaviorReportView";
import Customer360Panel from "@/components/ai/Customer360Panel";

const SPECIALIST_META = {
  general:   { label: "Atendimento Geral", color: "bg-blue-100 text-blue-700",     icon: Bot },
  finance:   { label: "Financeiro",        color: "bg-green-100 text-green-700",    icon: TrendingUp },
  tech:      { label: "Suporte Técnico",  color: "bg-purple-100 text-purple-700",   icon: Zap },
  sales:     { label: "Vendas",           color: "bg-orange-100 text-orange-700",   icon: TrendingUp },
  retention: { label: "Retenção",         color: "bg-red-100 text-red-700",         icon: TrendingDown },
  copilot:   { label: "Copiloto",         color: "bg-indigo-100 text-indigo-700",   icon: Bot },
};

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Olá! Sou a Lara, sua assistente virtual. Como posso ajudar você hoje? 😊" },
  ]);
  const [input, setInput] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [rightTab, setRightTab] = useState("360");
  const [customer360, setCustomer360] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await aiOrchestrator({
        message: userMsg.content,
        phone: phone.replace(/\D/g, "") || customer360?.phone || null,
        conversation_history: messages.map((m) => ({
          direction: m.role === "user" ? "in" : "out",
          content: m.content,
        })),
        customer_context: customer360 ? {
          name: customer360.name,
          phone: customer360.phone,
          cpf_cnpj: customer360.cpf_cnpj,
          ixc_customer_id: String(customer360.id),
          city: customer360.city,
          is_active: customer360.is_active,
          financial_risk: customer360.financial_risk,
          overdue_count: customer360.overdue_count,
        } : null,
        mode: "auto",
      });

      const orch = res?.data?.orchestrator;
      if (orch?.response?.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: orch.response.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Desculpe, não consegui processar sua mensagem agora. Pode tentar novamente?" }]);
      }
      setLastResult(orch);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erro de conexão. Tente novamente em instantes." }]);
    } finally {
      setLoading(false);
    }
  };

  const runQuickAction = useCallback(async (action) => {
    if (!customer360) return;
    setActionLoading(action);
    try {
      const clientId = String(customer360.id);
      let res;
      if (action === "segunda_via") {
        res = await ixcApi({ action: "segunda_via", clientId });
        const faturas = res?.data?.data || res?.data || [];
        if (!Array.isArray(faturas) || faturas.length === 0) {
          setMessages((prev) => [...prev, { role: "assistant", content: `${customer360.name} não possui faturas em aberto no momento.` }]);
        } else {
          const f = faturas[0];
          setMessages((prev) => [...prev, { role: "assistant", content: `📄 Segunda via gerada para ${customer360.name}:\n\n• Vencimento: ${new Date(f.due_date).toLocaleDateString("pt-BR")}\n• Valor: R$ ${(f.value || 0).toFixed(2)}\n• Boleto: ${f.boleto || "—"}\n• Linha digitável: ${f.linha_digitavel || "—"}\n• PIX: ${f.pix_code ? "Disponível" : "—"}` }]);
        }
      } else if (action === "abrir_os") {
        res = await ixcApi({ action: "os_create", data: { id_cliente: clientId, assunto: "Chamado aberto via Lara (Assistente Virtual)", descricao: `Cliente: ${customer360.name}\nProtocolo gerado pela IA.`, status: "A", prioridade: "B" } });
        const osId = res?.data?.id || res?.data?.data?.id;
        setMessages((prev) => [...prev, { role: "assistant", content: `🔧 Ordem de serviço criada no IXCSoft para ${customer360.name}.\n\nOS #${osId || "—"}\nStatus: Aberta\nSetor: Suporte Técnico` }]);
      } else if (action === "faturas") {
        res = await ixcApi({ action: "faturas_cliente", clientId });
        const faturas = res?.data?.result?.registros || res?.data?.data || [];
        const total = faturas.length;
        const abertas = faturas.filter((f) => f.status === "A").length;
        setMessages((prev) => [...prev, { role: "assistant", content: `💳 Faturas de ${customer360.name}:\n\n• Total: ${total}\n• Em aberto: ${abertas}\n• Pagas: ${total - abertas}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Não consegui executar esta ação no IXCSoft agora. Tente novamente." }]);
    } finally {
      setActionLoading(null);
    }
  }, [customer360]);

  return (
    <PageContainer>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-120px)]">
        {/* Chat */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white">
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold font-heading">Lara — Assistente Virtual</h3>
              <p className="text-xs text-muted-foreground">Powered by AI Orchestrator</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Telefone:</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-36 h-9 px-3 bg-muted/60 rounded-lg text-sm focus:outline-none focus:bg-card focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {customer360 && (
            <div className="px-4 py-2 bg-primary/5 border-b border-border flex items-center gap-2 flex-wrap">
              <UserCheck className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-xs font-medium text-primary">{customer360.name}</span>
              <span className="text-xs text-muted-foreground">ID #{customer360.id}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${customer360.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {customer360.is_active ? "Ativo" : "Inativo"}
              </span>
              {customer360.financial_risk && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${customer360.financial_risk === "baixo" ? "bg-green-100 text-green-700" : customer360.financial_risk === "medio" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                  Risco {customer360.financial_risk}
                </span>
              )}
              <div className="flex-1" />
              <button onClick={() => runQuickAction("segunda_via")} disabled={!!actionLoading} className="text-xs px-2 py-1 rounded-md bg-card border border-border hover:bg-muted flex items-center gap-1 disabled:opacity-40">
                {actionLoading === "segunda_via" ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />} 2ª Via
              </button>
              <button onClick={() => runQuickAction("faturas")} disabled={!!actionLoading} className="text-xs px-2 py-1 rounded-md bg-card border border-border hover:bg-muted flex items-center gap-1 disabled:opacity-40">
                {actionLoading === "faturas" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />} Faturas
              </button>
              <button onClick={() => runQuickAction("abrir_os")} disabled={!!actionLoading} className="text-xs px-2 py-1 rounded-md bg-card border border-border hover:bg-muted flex items-center gap-1 disabled:opacity-40">
                {actionLoading === "abrir_os" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />} OS
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"}`}>
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-muted-foreground">
                  Processando...
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="p-4 border-t border-border flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Digite sua mensagem..."
              disabled={loading}
              className="flex-1 h-10 px-4 bg-muted/60 rounded-lg text-sm focus:outline-none focus:bg-card focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 flex items-center gap-2"
            >
              <Send className="w-4 h-4" /> Enviar
            </button>
          </div>
        </Card>

        {/* Right Panel — Tabs: Visão 360 / Análise IA */}
        <Card className="overflow-hidden flex flex-col">
          <div className="flex border-b border-border">
            <button
              onClick={() => setRightTab("360")}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${rightTab === "360" ? "bg-primary/5 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Eye className="w-4 h-4" /> Visão 360
            </button>
            <button
              onClick={() => setRightTab("analysis")}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${rightTab === "analysis" ? "bg-primary/5 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Zap className="w-4 h-4" /> Análise da IA
            </button>
          </div>

          <div className={`overflow-y-auto scrollbar-thin flex-1 ${rightTab === "360" ? "block" : "hidden"}`}>
            <div className="p-4">
              <p className="text-xs text-muted-foreground mb-3">Busque um cliente pelo CPF/CNPJ para ver todos os dados integrados do IXCSoft.</p>
              <Customer360Panel onCustomerFound={setCustomer360} />
            </div>
          </div>

          <div className={`overflow-y-auto scrollbar-thin flex-1 ${rightTab === "analysis" ? "block" : "hidden"}`}>
          {!lastResult ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Envie uma mensagem para ver a análise da IA.
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Specialist */}
              {lastResult.specialist && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Especialista</p>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${SPECIALIST_META[lastResult.specialist]?.color || "bg-muted text-muted-foreground"}`}>
                    {(() => {
                      const Icon = SPECIALIST_META[lastResult.specialist]?.icon || Bot;
                      return <Icon className="w-4 h-4" />;
                    })()}
                    {SPECIALIST_META[lastResult.specialist]?.label || lastResult.specialist}
                  </div>
                </div>
              )}

              {/* Classification */}
              {lastResult.classification && (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Intenção</p>
                    <p className="text-sm font-medium">{lastResult.classification.intent || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Resumo</p>
                    <p className="text-sm">{lastResult.classification.summary || "—"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Sentimento</p>
                      <p className="text-sm capitalize">{lastResult.classification.sentiment || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Urgência</p>
                      <p className="text-sm capitalize">{lastResult.classification.urgency || "—"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Confiança</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${(lastResult.classification.confidence || 0) >= 0.8 ? "bg-green-500" : (lastResult.classification.confidence || 0) >= 0.6 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${Math.round((lastResult.classification.confidence || 0) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{Math.round((lastResult.classification.confidence || 0) * 100)}%</span>
                    </div>
                  </div>
                  {lastResult.classification.escalation_needed && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 text-amber-700 text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Escalonamento recomendado</p>
                        <p className="text-xs mt-0.5">{lastResult.classification.escalation_reason || "—"}</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Specialist Data — dados REAIS do IXC */}
              {lastResult.specialist_data && lastResult.specialist_data.fetched && (
                <div className="border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">{lastResult.specialist_data.label}</p>
                  <SpecialistDataView specialist={lastResult.specialist} data={lastResult.specialist_data.data} />
                </div>
              )}

              {/* Behavior Report — relatório comportamental 360 */}
              {lastResult.behavior_report && lastResult.behavior_report.fetched && (
                <div className="border-t border-border pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <p className="text-xs text-muted-foreground uppercase font-semibold">{lastResult.behavior_report.label}</p>
                  </div>
                  <BehaviorReportView data={lastResult.behavior_report.data} />
                </div>
              )}

              {/* Transfer Summary — resumo automático para atendente humano */}
              {lastResult.transfer_summary && (
                <div className="border-t border-border pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Resumo de Transferência</p>
                  </div>
                  <pre className="text-[11px] whitespace-pre-wrap bg-amber-50/50 border border-amber-200 rounded-lg p-3 text-foreground/80 font-mono max-h-80 overflow-y-auto scrollbar-thin">
{lastResult.transfer_summary}
                  </pre>
                  <button
                    onClick={() => navigator.clipboard?.writeText(lastResult.transfer_summary)}
                    className="mt-2 text-xs px-2 py-1 rounded-md bg-card border border-border hover:bg-muted flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" /> Copiar resumo
                  </button>
                </div>
              )}

              {/* Response metadata */}
              {lastResult.response && (
                <>
                  <div className="border-t border-border pt-4">
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Ações</p>
                    {lastResult.response.actions_taken?.length > 0 ? (
                      lastResult.response.actions_taken.map((a, i) => (
                        <p key={i} className="text-sm text-muted-foreground">• {a}</p>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhuma ação executada.</p>
                    )}
                  </div>
                  {lastResult.response.actions_available?.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">Ações disponíveis</p>
                      {lastResult.response.actions_available.map((a, i) => (
                        <p key={i} className="text-sm text-muted-foreground">• {a}</p>
                      ))}
                    </div>
                  )}
                  {lastResult.response.needs_human && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Transferir para humano</p>
                        <p className="text-xs mt-0.5">{lastResult.response.human_reason || "—"}</p>
                      </div>
                    </div>
                  )}
                  {lastResult.response.protocol && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Protocolo</p>
                      <p className="text-sm font-mono">{lastResult.response.protocol}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}