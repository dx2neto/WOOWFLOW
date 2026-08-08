import React from "react";
import { UserCheck, Tag, CheckCircle, ArrowRightLeft, Building2 } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/Badges";
import { initials, statusTone, statusLabel, integrations, rightTabs, channelTabs } from "./inboxConstants";
import AgreementCheckPanel from "@/components/agreements/AgreementCheckPanel";
import QuickReplyPanel from "@/components/inbox/QuickReplyPanel";
import CustomerHistoryPanel from "@/components/inbox/CustomerHistoryPanel";
import ContractTemplatePicker from "@/components/inbox/ContractTemplatePicker";
import IxcPreAnalysisCard from "@/components/inbox/IxcPreAnalysisCard";

export default function RightPanel({
  selected, rightTab, setRightTab, configs, selectedInstanceState,
  actionLoading, handleQuickIntegration,
  onFinalize, onTransfer,
  onSend, sending,
  onSelect,
  ixcAnalysis, ixcLoading, onRefetchIxc,
}) {
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
            </div>
          ) : (
            /* ABA: DADOS */
            <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin space-y-4">
              {/* Pré-análise IXC (auto) */}
              <IxcPreAnalysisCard data={ixcAnalysis} loading={ixcLoading} onRefetch={onRefetchIxc} />

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