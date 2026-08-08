import React, { useState } from "react";
import { UserCheck, Tag, CheckCircle, ArrowRightLeft, Building2, Bot, Loader2 } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/Badges";
import { initials, statusTone, statusLabel, integrations, rightTabs, channelTabs } from "./inboxConstants";
import AgreementCheckPanel from "@/components/agreements/AgreementCheckPanel";
import QuickReplyPanel from "@/components/inbox/QuickReplyPanel";
import CustomerHistoryPanel from "@/components/inbox/CustomerHistoryPanel";
import ContractTemplatePicker from "@/components/inbox/ContractTemplatePicker";
import IxcPreAnalysisCard from "@/components/inbox/IxcPreAnalysisCard";
import SignatureAlertBanner from "@/components/inbox/SignatureAlertBanner";

export default function RightPanel({
  selected, rightTab, setRightTab, configs, selectedInstanceState,
  actionLoading, handleQuickIntegration,
  onFinalize, onTransfer,
  onSend, sending,
  onSelect,
  ixcAnalysis, ixcLoading, onRefetchIxc,
  convUpdate,
}) {
  const [togglingAI, setTogglingAI] = useState(false);

  const handleToggleAI = async (enabled) => {
    if (!selected || togglingAI) return;
    setTogglingAI(true);
    try {
      await convUpdate.mutateAsync({
        id: selected.id,
        data: { ai_enabled: enabled, ai_mode: enabled ? "auto" : "off", is_ai: enabled },
      });
    } catch { /* ignore */ }
    finally { setTogglingAI(false); }
  };
  return (
    <aside className="hidden min-h-0 border-l border-border bg-card xl:flex xl:flex-col">
      {selected ? (
        <>
          {/* Abas do painel direito */}
          <div className="flex border-b border-border overflow-x-auto scrollbar-thin flex-shrink-0">
            {rightTabs.map(({ key, label }) => (
              <button key={key} onClick={() => setRightTab(key)}
                className={`flex-1 py-3 text-xs font-bold whitespace-nowrap px-2 transition-colors ${rightTab === key ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Conteúdo das abas */}
          {rightTab === "modelos" ? (
            <QuickReplyPanel onSend={onSend} sending={sending} />
          ) : rightTab === "historico" ? (
            <CustomerHistoryPanel conversation={selected} onSelect={onSelect} />
          ) : rightTab === "contratos" ? (
            <ContractTemplatePicker conversation={selected} />
          ) : rightTab === "acordo" ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-thin">
              <AgreementCheckPanel conversation={selected} instance={selectedInstanceState} />
            </div>
          ) : rightTab === "ixc" ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
              <div className="mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <p className="text-xs font-bold uppercase text-muted-foreground tracking-wide">Pré-análise IXCSoft</p>
              </div>
              <IxcPreAnalysisCard data={ixcAnalysis} loading={ixcLoading} onRefetch={onRefetchIxc} />
              <SignatureAlertBanner phone={selected.phone} />
            </div>
          ) : (
            /* ABA: DADOS */
            <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin space-y-4">
              {/* Alerta de assinatura ZapSign */}
              <SignatureAlertBanner phone={selected.phone} />

              {/* Pré-análise IXC (auto) */}
              <IxcPreAnalysisCard data={ixcAnalysis} loading={ixcLoading} onRefetch={onRefetchIxc} />

              {/* Toggle IA — auto-atendimento */}
              <div className={`rounded-xl border p-4 ${selected.ai_enabled ? "border-primary bg-primary/5" : "border-border bg-background"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${selected.ai_enabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">IA — Auto-atender</p>
                      <p className="text-xs text-muted-foreground">
                        {selected.ai_enabled ? "Lara respondendo automaticamente" : "IA desativada"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleAI(!selected.ai_enabled)}
                    disabled={togglingAI}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${selected.ai_enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    {togglingAI ? (
                      <Loader2 className="w-3.5 h-3.5 absolute top-1 left-1 animate-spin text-white" />
                    ) : (
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${selected.ai_enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                    )}
                  </button>
                </div>
                {selected.ai_enabled && ixcAnalysis?.found && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-1 text-xs">
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">Cliente identificado:</span> {ixcAnalysis.cliente?.name || "—"}
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">Status:</span> {ixcAnalysis.cliente?.is_active ? "Ativo" : "Inativo"}
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-foreground">Contratos:</span> {(ixcAnalysis.contratos || []).length}
                    </p>
                    {ixcAnalysis.faturas && (
                      <p className="text-muted-foreground">
                        <span className="font-semibold text-foreground">Faturas vencidas:</span> {ixcAnalysis.faturas.vencidas || 0}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Card de perfil */}
              <div className="rounded-xl border border-border bg-background p-4 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xl font-bold text-white">
                  {initials(selected.customer_name)}
                </div>
                <p className="font-bold text-sm">{selected.customer_name}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{selected.phone || "Sem telefone"}</p>
                {selected.email && <p className="text-xs text-muted-foreground mt-0.5">{selected.email}</p>}
                <div className="mt-3 flex justify-center gap-2 flex-wrap">
                  <StatusBadge status={selected.status} />
                  <PriorityBadge priority={selected.priority} />
                </div>
              </div>

              {/* Informações do atendimento */}
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="mb-3 text-xs font-bold uppercase text-muted-foreground tracking-wide">Atendimento</p>
                <div className="space-y-2.5 text-sm">
                  {[
                    ["Setor",       selected.sector         || "Atendimento"    ],
                    ["Atendente",   selected.attendant_name || "Não atribuído"  ],
                    ["Protocolo",   selected.protocol       || "—"              ],
                    ["Cidade",      selected.city           || "—"              ],
                    ["Instância",   selected.instance || "—"],
                    ["Canal",       channelTabs.find((t) => t.key === selected.channel)?.label || selected.channel],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground flex-shrink-0">{label}</span>
                      <span className="font-medium text-right text-xs">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="mb-3 text-xs font-bold uppercase text-muted-foreground tracking-wide">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.tags?.length ? (
                    selected.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-semibold">
                        <Tag className="h-3 w-3" /> {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Nenhuma tag</span>
                  )}
                </div>
              </div>

              {/* Integrações rápidas */}
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="mb-3 text-xs font-bold uppercase text-muted-foreground tracking-wide">Integrações API</p>
                <div className="space-y-2">
                  {integrations.map((item) => {
                    const Icon = item.icon;
                    let configStatus = configs[item.service]?.status || "disconnected";
                    if (item.service === "evolution_api") configStatus = selectedInstanceState;
                    return (
                      <button key={item.service} onClick={() => handleQuickIntegration(item.service)}
                        disabled={Boolean(actionLoading)}
                        className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-muted/50 disabled:opacity-50 transition-colors">
                        <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-bold">{item.label}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {item.service === "evolution_api" && selected?.channel === "whatsapp" ? "Buscar histórico desta conversa" : item.actionLabel}
                          </span>
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold flex-shrink-0 ${statusTone[configStatus] || statusTone.disconnected}`}>
                          {actionLoading === item.service ? "…" : statusLabel(configStatus)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ações */}
              <div className="grid grid-cols-2 gap-2 pb-2">
                <button onClick={onFinalize}
                  disabled={["finalizado","resolvido"].includes(selected.status)}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors">
                  <CheckCircle className="h-4 w-4" /> Finalizar
                </button>
                <button onClick={onTransfer}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-muted px-3 py-2.5 text-sm font-bold hover:bg-muted/70 transition-colors">
                  <ArrowRightLeft className="h-4 w-4" /> Transferir
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div>
            <UserCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Selecione uma conversa para ver os detalhes</p>
          </div>
        </div>
      )}
    </aside>
  );
}