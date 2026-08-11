import React, { useState } from "react";
import { PageContainer } from "@/components/ui/app-card";
import {
  UserPlus, FileCheck, Search, CreditCard, CheckCircle2, XCircle,
  FileText, PenTool, Send, Zap, ArrowRight, ArrowDown, Workflow,
  Database, MessageSquare, Bot, ShieldCheck, AlertTriangle, Clock,
  Phone, MapPin, DollarSign, FileSignature, Wifi, RefreshCw, Check,
  CircleDot, ChevronRight, Eye, Code2, GitBranch, Cpu, Webhook
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// DADOS DOS FLUXOS
// ═══════════════════════════════════════════════════════════════════════════

const STAGES = [
  {
    id: 1,
    name: "Entrada do Lead",
    icon: UserPlus,
    color: "blue",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    iconBg: "bg-blue-500",
    desc: "Lead chega ao sistema via WhatsApp, Instagram, site ou indicação",
    entities: ["Lead"],
    functions: [],
    workflows: ["LeadStageOnMessage (se via WhatsApp)"],
    details: [
      "Lead criado manualmente no CRM ou automaticamente via mensagem",
      "Stage inicial: novo_lead",
      "Dados: nome, telefone, origem, cidade, plano de interesse, valor estimado",
      "Atribuído a um usuário (vendedor) responsável",
    ],
  },
  {
    id: 2,
    name: "Primeiro Contato",
    icon: Phone,
    color: "indigo",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
    borderColor: "border-indigo-200 dark:border-indigo-800",
    iconBg: "bg-indigo-500",
    desc: "Atendente ou IA faz primeiro contato com o lead",
    entities: ["Lead", "Conversation", "Message"],
    functions: ["aiOrchestrator", "evolutionApi"],
    workflows: ["LeadStageOnMessage"],
    details: [
      "Lead movido para stage: primeiro_contato",
      "IA (Lara) pode fazer contato automático se ai_enabled",
      "Mensagens via Evolution API (WhatsApp)",
      "IA classifica intenção: sales → oferece planos",
    ],
  },
  {
    id: 3,
    name: "Qualificação",
    icon: Search,
    color: "purple",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    borderColor: "border-purple-200 dark:border-purple-800",
    iconBg: "bg-purple-500",
    desc: "Lead é qualificado — endereço, cobertura, necessidades",
    entities: ["Lead"],
    functions: ["aiOrchestrator (sales specialist)"],
    workflows: [],
    details: [
      "Stage: qualificacao",
      "Verifica cobertura na região do lead",
      "IA busca planos disponíveis no IXC (fetchSalesData)",
      "Apresenta 3 opções: econômico, recomendado, premium",
    ],
  },
  {
    id: 4,
    name: "Proposta Enviada",
    icon: FileText,
    color: "amber",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    iconBg: "bg-amber-500",
    desc: "Proposta formal enviada ao cliente",
    entities: ["Lead"],
    functions: ["aiOrchestrator"],
    workflows: [],
    details: [
      "Stage: proposta_enviada",
      "IA apresenta planos com dados REAIS do IXC",
      "Nunca inventa valores ou velocidades",
      "Aguarda aceite do cliente",
    ],
  },
  {
    id: 5,
    name: "Início da Venda",
    icon: GitBranch,
    color: "cyan",
    bgColor: "bg-cyan-50 dark:bg-cyan-950/30",
    borderColor: "border-cyan-200 dark:border-cyan-800",
    iconBg: "bg-cyan-500",
    desc: "Venda criada no pipeline com correlation_id único",
    entities: ["Sale"],
    functions: ["salesPipelineApi (start_sale)"],
    workflows: [],
    details: [
      "Gera correlation_id (UUID) — rastreia toda a jornada",
      "Criptografa CPF/CNPJ (AES-GCM) + máscara LGPD",
      "Determina tipo: direta ou revenda",
      "Busca dados do revendedor (se aplicável)",
      "Calcula comissão (monthly_fee × commission_rate / 100)",
      "Stage: novo_lead | Timeline registra início",
    ],
  },
  {
    id: 6,
    name: "Validação de Documento",
    icon: FileCheck,
    color: "teal",
    bgColor: "bg-teal-50 dark:bg-teal-950/30",
    borderColor: "border-teal-200 dark:border-teal-800",
    iconBg: "bg-teal-500",
    desc: "CPF/CNPJ validado e descriptografado",
    entities: ["Sale"],
    functions: ["salesPipelineApi (validate_document)"],
    workflows: [],
    details: [
      "Descriptografa CPF/CNPJ (AES-GCM)",
      "Valida: 11 dígitos (PF) ou 14 dígitos (PJ)",
      "Stage: cpf_validado",
      "Timeline registra tipo de documento",
    ],
  },
  {
    id: 7,
    name: "Consulta IXC",
    icon: Database,
    color: "blue",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    iconBg: "bg-blue-600",
    desc: "Verifica se cliente já existe no IXCSoft + contratos + débitos",
    entities: ["Sale"],
    functions: ["salesPipelineApi (check_ixc_customer) → ixcApi (search_customer_by_document, search_contracts, check_financial_risk)"],
    workflows: [],
    details: [
      "Busca cliente por CPF/CNPJ no IXC",
      "Se encontrado: busca contratos + risco financeiro",
      "Calcula: ixc_financial_risk (baixo/médio/alto)",
      "Conta: ixc_overdue_count (faturas vencidas)",
      "Stage: ixc_consultado",
    ],
  },
  {
    id: 8,
    name: "Consulta Cadastral",
    icon: CreditCard,
    color: "orange",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    borderColor: "border-orange-200 dark:border-orange-800",
    iconBg: "bg-orange-500",
    desc: "Consulta de crédito via ValidaCadastro/Serasa",
    entities: ["Sale", "CreditCheckLog"],
    functions: ["salesPipelineApi (run_credit_check)"],
    workflows: ["AutoCreditCheckOnNewLead (automático)"],
    details: [
      "Descriptografa CPF → envia para provider de crédito",
      "Provider: ValidaCadastro (CREDIT_API_URL + CREDIT_ACCESS_KEY)",
      "TipoPessoa: F (PF) ou J (PJ)",
      "Resultado: approved / approved_with_warning / manual_review / rejected",
      "Cria CreditCheckLog (LGPD: consent, purpose, masked doc)",
      "Stage: consulta_credito",
    ],
  },
  {
    id: 9,
    name: "Decisão de Crédito",
    icon: ShieldCheck,
    color: "emerald",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    iconBg: "bg-emerald-500",
    desc: "Motor de decisão aplica regras administrativas",
    entities: ["Sale"],
    functions: ["salesPipelineApi (make_decision)"],
    workflows: [],
    details: [
      "evaluateDecision(creditResult, ixcRisk, ixcOverdueCount):",
      "  • ixcRisk='alto' OR overdueCount>5 → REPROVADO",
      "  • creditResult='rejected' → REPROVADO",
      "  • creditResult='error' → ANÁLISE MANUAL",
      "  • ixcRisk='medio' + warning → ANÁLISE MANUAL",
      "  • creditResult='approved_with_warning' → APROVADO COM RESSALVAS",
      "  • else → APROVADO",
      "Stage: aprovado | reprovado | analise_manual",
    ],
  },
  {
    id: 10,
    name: "Criação de Contrato IXC",
    icon: FileText,
    color: "blue",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    iconBg: "bg-blue-700",
    desc: "Cliente + contrato criados no IXCSoft",
    entities: ["Sale"],
    functions: ["salesPipelineApi (create_ixc_contract) → ixcApi (create_customer, create_contract)"],
    workflows: ["AutoContractAfterCreditApproval"],
    details: [
      "Se cliente não existe no IXC: cria (POST /cliente)",
      "Cria contrato (POST /cliente_contrato)",
      "Dados: id_cliente, id_plano, endereco, data_ativacao, status='A'",
      "Stage: contrato_gerado",
      "Salva: ixc_customer_id, ixc_contract_id",
      "⚠️ Bug conhecido: cpf_cnpj enviado criptografado ao IXC",
    ],
  },
  {
    id: 11,
    name: "Envio para Assinatura",
    icon: PenTool,
    color: "violet",
    bgColor: "bg-violet-50 dark:bg-violet-950/30",
    borderColor: "border-violet-200 dark:border-violet-800",
    iconBg: "bg-violet-500",
    desc: "Documento ZapSign criado e enviado via WhatsApp",
    entities: ["Sale", "SignatureRequest", "ContractTemplate"],
    functions: ["salesPipelineApi (send_for_signature) → zapsignApi (create_from_ixc)"],
    workflows: ["ContractZapsignOnContratoStage"],
    details: [
      "Seleciona template (explícito ou mais utilizado)",
      "Busca dados cliente + contrato no IXC",
      "Preenche variáveis do template (fillVariables)",
      "Cria documento no ZapSign (POST /docs/)",
      "Salva SignatureRequest (status: pendente)",
      "Incrementa ContractTemplate.usage_count",
      "Envia link de assinatura via WhatsApp (Evolution API)",
      "Stage: assinatura_enviada",
    ],
  },
  {
    id: 12,
    name: "Assinatura do Contrato",
    icon: FileSignature,
    color: "green",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-200 dark:border-green-800",
    iconBg: "bg-green-600",
    desc: "Cliente assina documento eletronicamente",
    entities: ["SignatureRequest", "Sale", "Agreement", "Customer"],
    functions: ["zapsignApi (webhook → updateSignatureAndRelated)"],
    workflows: ["AdvanceCrmOnSignature", "ContractSignedWhatsApp"],
    details: [
      "ZapSign envia webhook quando assinado",
      "SignatureRequest.update(status: 'assinado', signed_date)",
      "updateSignatureAndRelated propaga:",
      "  → Agreement.update(status: 'active', zapsign_status: 'signed')",
      "  → Customer.update(contract_status: 'ativo')",
      "  → ixcApi update_contract (status: 'A', status_internet: 'A')",
      "notifyContractSigned: envia WhatsApp para cliente + comercial",
      "Stage: assinado",
    ],
  },
  {
    id: 13,
    name: "Ativação do Plano",
    icon: Zap,
    color: "yellow",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
    borderColor: "border-yellow-200 dark:border-yellow-800",
    iconBg: "bg-yellow-500",
    desc: "Plano ativado no IXCSoft — cliente provisionado",
    entities: ["Sale", "SignatureRequest"],
    functions: ["ixcApi (update_contract)"],
    workflows: ["AdvanceCrmOnSignature"],
    details: [
      "Contrato IXC atualizado: status='A', status_internet='A'",
      "PPPoE/RADIUS provisionado (se aplicável)",
      "Stage: concluido (via advanceCrmStage)",
      "Timeline registra conclusão",
      "Comissão do revendedor calculada (se revenda)",
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: StageCard
// ═══════════════════════════════════════════════════════════════════════════

function StageCard({ stage, isLast, onSelect, isSelected }) {
  const Icon = stage.icon;
  return (
    <div className="relative flex gap-4">
      {/* Linha conectora */}
      {!isLast && (
        <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-gradient-to-b from-border to-border/30" />
      )}

      {/* Círculo com número */}
      <div className="relative flex-shrink-0">
        <div className={`w-12 h-12 rounded-full ${stage.iconBg} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
          {stage.id}
        </div>
      </div>

      {/* Card de conteúdo */}
      <div
        onClick={() => onSelect(stage.id)}
        className={`flex-1 mb-6 rounded-xl border-2 ${stage.borderColor} ${stage.bgColor} p-5 cursor-pointer transition-all hover:shadow-md ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-lg ${stage.iconBg} flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-base">{stage.name}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{stage.desc}</p>
          </div>
        </div>

        {/* Detalhes */}
        {isSelected && (
          <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Entidades */}
            {stage.entities.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Database className="w-3 h-3" /> Entidades Envolvidas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {stage.entities.map((e) => (
                    <span key={e} className="px-2 py-0.5 rounded-md bg-card border border-border text-xs font-medium">
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Funções */}
            {stage.functions.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Code2 className="w-3 h-3" /> Funções Backend
                </p>
                <div className="space-y-1">
                  {stage.functions.map((f, i) => (
                    <p key={i} className="text-xs font-mono text-foreground bg-card border border-border rounded px-2 py-1">
                      {f}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Workflows */}
            {stage.workflows.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Workflow className="w-3 h-3" /> Workflows Automáticos
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {stage.workflows.map((w) => (
                    <span key={w} className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-xs font-medium text-primary flex items-center gap-1">
                      <Workflow className="w-3 h-3" /> {w}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Detalhes técnicos */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                <ChevronRight className="w-3 h-3" /> Fluxo de Execução
              </p>
              <ul className="space-y-1">
                {stage.details.map((d, i) => (
                  <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                    <CircleDot className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <span className="font-mono">{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {!isSelected && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Eye className="w-3 h-3" /> Clique para ver detalhes
          </p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: FluxoParalelo (caminhos alternativos)
// ═══════════════════════════════════════════════════════════════════════════

function DecisionBranch() {
  return (
    <div className="mb-8 rounded-xl border-2 border-dashed border-border p-5 bg-muted/30">
      <div className="flex items-center gap-2 mb-4">
        <GitBranch className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-base">Caminhos de Decisão de Crédito</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Aprovado */}
        <div className="rounded-lg border-2 border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="font-bold text-sm text-green-700 dark:text-green-400">APROVADO</span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">Sem restrições + risco IXC baixo</p>
          <div className="text-xs space-y-1">
            <p className="flex items-center gap-1"><ArrowDown className="w-3 h-3" /> Stage: <strong>aprovado</strong></p>
            <p className="flex items-center gap-1"><ArrowDown className="w-3 h-3" /> Cria contrato no IXC</p>
            <p className="flex items-center gap-1"><ArrowDown className="w-3 h-3" /> Envia para assinatura</p>
          </div>
        </div>

        {/* Aprovado com ressalvas */}
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="font-bold text-sm text-amber-700 dark:text-amber-400">RESSALVAS</span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">Restrição leve encontrada</p>
          <div className="text-xs space-y-1">
            <p className="flex items-center gap-1"><ArrowDown className="w-3 h-3" /> Stage: <strong>aprovado</strong></p>
            <p className="flex items-center gap-1"><ArrowDown className="w-3 h-3" /> Prossegue normalmente</p>
            <p className="flex items-center gap-1"><ArrowDown className="w-3 h-3" /> Marca credit_decision</p>
          </div>
        </div>

        {/* Reprovado / Manual */}
        <div className="rounded-lg border-2 border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="font-bold text-sm text-red-700 dark:text-red-400">REPROVADO/MANUAL</span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">Risco alto IXC ou restrição grave</p>
          <div className="text-xs space-y-1">
            <p className="flex items-center gap-1"><ArrowDown className="w-3 h-3" /> Stage: <strong>reprovado</strong> ou <strong>analise_manual</strong></p>
            <p className="flex items-center gap-1"><ArrowDown className="w-3 h-3" /> NÃO cria contrato</p>
            <p className="flex items-center gap-1"><ArrowDown className="w-3 h-3" /> Requer intervenção humana</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: IntegracoesDiagram
// ═══════════════════════════════════════════════════════════════════════════

function IntegracoesDiagram() {
  const integrations = [
    { name: "IXCSoft", icon: Database, color: "bg-blue-500", endpoints: ["/cliente", "/cliente_contrato", "/fn_areceber", "/atendimento", "/plano"], desc: "ERP do provedor — clientes, contratos, faturas, OS" },
    { name: "Evolution API", icon: MessageSquare, color: "bg-green-500", endpoints: ["/message/sendText", "/chat/findMessages", "/instance/connect"], desc: "WhatsApp — envio e recebimento de mensagens" },
    { name: "ZapSign", icon: FileSignature, color: "bg-violet-500", endpoints: ["POST /docs/", "GET /docs/{token}", "POST /docs/{token}/cancel"], desc: "Assinatura eletrônica de contratos" },
    { name: "ValidaCadastro", icon: CreditCard, color: "bg-orange-500", endpoints: ["POST {apiUrl} (consulta)"], desc: "Consulta cadastral (Serasa/bureau)" },
    { name: "Base44 SDK", icon: Cpu, color: "bg-primary", endpoints: ["entities.*", "functions.invoke", "auth.me"], desc: "Plataforma — banco de dados, auth, funções" },
    { name: "InvokeLLM", icon: Bot, color: "bg-purple-500", endpoints: ["prompt + response_json_schema"], desc: "IA — classificação e geração de respostas" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {integrations.map((int) => {
        const Icon = int.icon;
        return (
          <div key={int.name} className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${int.color} flex items-center justify-center`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <h4 className="font-bold text-sm">{int.name}</h4>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{int.desc}</p>
            <div className="space-y-1">
              {int.endpoints.map((ep) => (
                <p key={ep} className="text-xs font-mono text-foreground/70 bg-muted/50 rounded px-2 py-0.5">
                  {ep}
                </p>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: TimelineResumo
// ═══════════════════════════════════════════════════════════════════════════

function TimelineResumo() {
  const steps = [
    { label: "Lead", stage: "novo_lead", color: "bg-blue-500" },
    { label: "Contato", stage: "primeiro_contato", color: "bg-indigo-500" },
    { label: "Qualificação", stage: "qualificacao", color: "bg-purple-500" },
    { label: "Proposta", stage: "proposta_enviada", color: "bg-amber-500" },
    { label: "Venda", stage: "novo_lead", color: "bg-cyan-500" },
    { label: "CPF Validado", stage: "cpf_validado", color: "bg-teal-500" },
    { label: "IXC Consultado", stage: "ixc_consultado", color: "bg-blue-600" },
    { label: "Crédito", stage: "consulta_credito", color: "bg-orange-500" },
    { label: "Decisão", stage: "aprovado", color: "bg-emerald-500" },
    { label: "Contrato IXC", stage: "contrato_gerado", color: "bg-blue-700" },
    { label: "Assinatura", stage: "assinatura_enviada", color: "bg-violet-500" },
    { label: "Assinado", stage: "assinado", color: "bg-green-600" },
    { label: "Ativação", stage: "concluido", color: "bg-yellow-500" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-bold text-base mb-4 flex items-center gap-2">
        <GitBranch className="w-5 h-5 text-primary" /> Timeline de Stages (Sale entity)
      </h3>
      <div className="flex flex-wrap items-center gap-1">
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-3 h-3 rounded-full ${s.color}`} />
              <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">{s.label}</span>
            </div>
            {i < steps.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground mx-0.5" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: WorkflowsList
// ═══════════════════════════════════════════════════════════════════════════

function WorkflowsList() {
  const wfs = [
    { name: "LeadStageOnMessage", trigger: "Entity: Message (create)", action: "advanceLeadOnInteraction", desc: "Move lead no funil conforme interação" },
    { name: "AutoCreditCheckOnNewLead", trigger: "Entity: Lead (create)", action: "salesPipelineApi run_credit_check", desc: "Consulta cadastral automática ao criar lead" },
    { name: "ContractOnLeadStage", trigger: "Entity: Lead (update → preparar_contrato)", action: "zapsignApi create_from_lead", desc: "Cria documento ZapSign quando lead está em preparar_contrato" },
    { name: "AutoContractAfterCreditApproval", trigger: "Entity: Sale (update → aprovado)", action: "salesPipelineApi create_ixc_contract", desc: "Cria contrato no IXC automaticamente após aprovação" },
    { name: "ContractZapsignOnContratoStage", trigger: "Entity: Sale (update → contrato_gerado)", action: "zapsignApi create_from_ixc", desc: "Envia para assinatura quando contrato é gerado" },
    { name: "AdvanceCrmOnSignature", trigger: "Entity: SignatureRequest (update → assinado)", action: "advanceCrmStage", desc: "Move venda para concluido após assinatura" },
    { name: "ContractSignedWhatsApp", trigger: "Entity: SignatureRequest (update → assinado)", action: "notifyContractSigned", desc: "Notifica cliente e comercial via WhatsApp" },
    { name: "ZapSignStatusSync", trigger: "Cron diário", action: "zapsignApi sync_status", desc: "Sincroniza status de documentos pendentes" },
    { name: "SignatureReminder24h", trigger: "Cron diário", action: "sendSignatureReminders", desc: "Lembrete para documentos pendentes há +24h" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-bold text-base mb-4 flex items-center gap-2">
        <Workflow className="w-5 h-5 text-primary" /> Workflows Automáticos (Vendas)
      </h3>
      <div className="space-y-2">
        {wfs.map((w) => (
          <div key={w.name} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Workflow className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold">{w.name}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{w.desc}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Trigger:</span>
                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">{w.trigger}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">{w.action}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: MetricasRastreabilidade
// ═══════════════════════════════════════════════════════════════════════════

function MetricasRastreabilidade() {
  const metrics = [
    { label: "correlation_id", icon: GitBranch, value: "UUID único", desc: "Rastreia toda a jornada da venda entre IXC, crédito, ZapSign e Evolution" },
    { label: "timeline[]", icon: Clock, value: "Array de entradas", desc: "Histórico cronológico de mudanças de etapa dentro da Sale" },
    { label: "IntegrationLog", icon: Database, value: "Por função + action", desc: "Log de cada chamada a integração externa (sucesso/falha)" },
    { label: "CreditCheckLog", icon: ShieldCheck, value: "LGPD compliant", desc: "Consulta cadastral com consentimento, propósito e doc mascarado" },
    { label: "SignatureRequest", icon: FileSignature, value: "Por documento", desc: "Token ZapSign, sign_url, status, signers, datas" },
    { label: "AIInteraction", icon: Bot, value: "Por mensagem IA", desc: "Specialist, intent, confidence, protocol, needs_human" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div key={m.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-mono text-sm font-bold">{m.label}</p>
                <p className="text-[10px] text-muted-foreground">{m.value}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{m.desc}</p>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function FlowMap() {
  const [selectedStage, setSelectedStage] = useState(5); // Default: Início da Venda

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Workflow className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold font-heading">Mapa de Fluxos do Sistema</h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Mapeamento completo da jornada: desde a entrada de um lead no sistema até a assinatura do contrato
          e ativação do plano no IXCSoft. Clique em cada etapa para ver detalhes técnicos, entidades envolvidas,
          funções backend e workflows automáticos.
        </p>
      </div>

      {/* Timeline Resumo */}
      <div className="mb-8">
        <TimelineResumo />
      </div>

      {/* Fluxo Principal — Stages */}
      <div className="mb-8">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-primary" /> Jornada Completa — Lead → Ativação
        </h3>
        <div className="space-y-0">
          {STAGES.map((stage, idx) => (
            <StageCard
              key={stage.id}
              stage={stage}
              isLast={idx === STAGES.length - 1}
              onSelect={setSelectedStage}
              isSelected={selectedStage === stage.id}
            />
          ))}
        </div>
      </div>

      {/* Caminhos de Decisão */}
      <div className="mb-8">
        <DecisionBranch />
      </div>

      {/* Workflows Automáticos */}
      <div className="mb-8">
        <WorkflowsList />
      </div>

      {/* Integrações */}
      <div className="mb-8">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Webhook className="w-5 h-5 text-primary" /> Integrações Externas
        </h3>
        <IntegracoesDiagram />
      </div>

      {/* Rastreabilidade */}
      <div className="mb-8">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" /> Rastreabilidade e Auditoria
        </h3>
        <MetricasRastreabilidade />
      </div>

      {/* Resumo Estatístico */}
      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-primary" /> Resumo do Fluxo
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-2xl font-bold text-primary">13</p>
            <p className="text-xs text-muted-foreground">Etapas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">9</p>
            <p className="text-xs text-muted-foreground">Workflows automáticos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">6</p>
            <p className="text-xs text-muted-foreground">Integrações externas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">4</p>
            <p className="text-xs text-muted-foreground">Entidades principais</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-primary/10">
          <p className="text-xs text-muted-foreground">
            <strong>Entidades principais:</strong> Lead → Sale → SignatureRequest → Customer/Agreement
            <br />
            <strong> correlation_id</strong> rastreia toda a jornada entre IXC, crédito, ZapSign e Evolution API.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}