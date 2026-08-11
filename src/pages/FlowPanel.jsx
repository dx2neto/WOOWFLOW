import React, { useState } from "react";
import { PageContainer } from "@/components/ui/app-card";
import {
  UserPlus, Phone, Search, FileText, GitBranch, FileCheck, Database,
  CreditCard, ShieldCheck, FileSignature, PenTool, CheckCircle2, Zap,
  ArrowRight, ArrowDown, Workflow, Database as DbIcon, Cpu, Bot,
  MessageSquare, Clock, AlertTriangle, XCircle, ChevronRight, Eye,
  Webhook, RefreshCw, Users, DollarSign, FileCode, Sparkles, Route,
  CircleCheck, CircleDot, Square
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// DADOS — ESTÁGIOS DO FLUXO COMPLETO
// ═══════════════════════════════════════════════════════════════════════════

const FLOW_STAGES = [
  {
    id: "lead-entry",
    num: 1,
    name: "Entrada do Lead",
    icon: UserPlus,
    color: "blue",
    phase: "CRM",
    stage_value: "novo_lead",
    desc: "Lead chega via WhatsApp, site ou indicação",
    duration: "Instantâneo",
    entities: ["Lead"],
    functions: [],
    workflows: ["LeadStageOnMessage"],
    details: [
      "Lead criado manualmente no CRM ou automaticamente via mensagem WhatsApp",
      "Dados capturados: nome, telefone, origem, cidade, plano de interesse, valor estimado",
      "Atribuído a um usuário (vendedor) responsável",
      "Stage inicial: novo_lead",
    ],
    next: "primeiro-contato",
  },
  {
    id: "primeiro-contato",
    num: 2,
    name: "Primeiro Contato",
    icon: Phone,
    color: "indigo",
    phase: "CRM",
    stage_value: "primeiro_contato",
    desc: "Atendente ou IA faz primeiro contato",
    duration: "Minutos",
    entities: ["Lead", "Conversation", "Message"],
    functions: ["aiOrchestrator", "evolutionApi"],
    workflows: ["LeadStageOnMessage"],
    details: [
      "Lead movido para stage: primeiro_contato",
      "IA (Lara) pode fazer contato automático se conversation.ai_enabled",
      "Mensagens enviadas via Evolution API (WhatsApp)",
      "IA classifica intenção: sales → oferece planos disponíveis",
    ],
    next: "qualificacao",
  },
  {
    id: "qualificacao",
    num: 3,
    name: "Qualificação",
    icon: Search,
    color: "purple",
    phase: "CRM",
    stage_value: "qualificacao",
    desc: "Endereço, cobertura e necessidades verificadas",
    duration: "Horas",
    entities: ["Lead"],
    functions: ["aiOrchestrator (sales specialist)"],
    workflows: [],
    details: [
      "Stage: qualificacao",
      "Verifica cobertura na região do lead",
      "IA busca planos disponíveis no IXC (fetchSalesData)",
      "Apresenta 3 opções: econômico, recomendado, premium",
    ],
    next: "proposta",
  },
  {
    id: "proposta",
    num: 4,
    name: "Proposta Enviada",
    icon: FileText,
    color: "amber",
    phase: "CRM",
    stage_value: "proposta_enviada",
    desc: "Proposta formal enviada ao cliente",
    duration: "Horas",
    entities: ["Lead"],
    functions: ["aiOrchestrator"],
    workflows: [],
    details: [
      "Stage: proposta_enviada",
      "IA apresenta planos com dados REAIS do IXC",
      "Nunca inventa valores ou velocidades",
      "Aguarda aceite do cliente para iniciar venda formal",
    ],
    next: "start-sale",
  },
  {
    id: "start-sale",
    num: 5,
    name: "Início da Venda",
    icon: GitBranch,
    color: "cyan",
    phase: "Pipeline",
    stage_value: "novo_lead (Sale)",
    desc: "Venda criada com correlation_id único",
    duration: "Instantâneo",
    entities: ["Sale"],
    functions: ["salesPipelineApi (start_sale)"],
    workflows: [],
    details: [
      "Gera correlation_id (UUID) — rastreia toda a jornada",
      "Criptografa CPF/CNPJ (AES-GCM) + gera máscara LGPD",
      "Determina tipo: direta (cliente final) ou revenda (via revendedor)",
      "Calcula comissão: monthly_fee × commission_rate / 100",
      "Cria Sale entity (stage: 'novo_lead', timeline: [entry])",
    ],
    next: "validate-doc",
  },
  {
    id: "validate-doc",
    num: 6,
    name: "Validação de Documento",
    icon: FileCheck,
    color: "teal",
    phase: "Pipeline",
    stage_value: "cpf_validado",
    desc: "CPF/CNPJ validado e descriptografado",
    duration: "Instantâneo",
    entities: ["Sale"],
    functions: ["salesPipelineApi (validate_document)"],
    workflows: [],
    details: [
      "Descriptografa CPF/CNPJ (AES-GCM com INTERNAL_FUNCTION_TOKEN)",
      "Valida: 11 dígitos (PF) ou 14 dígitos (PJ)",
      "Stage: cpf_validado",
      "Timeline registra tipo de documento (PF ou PJ)",
    ],
    next: "check-ixc",
  },
  {
    id: "check-ixc",
    num: 7,
    name: "Consulta IXC",
    icon: Database,
    color: "blue",
    phase: "Pipeline",
    stage_value: "ixc_consultado",
    desc: "Verifica se cliente já existe no IXC + contratos + débitos",
    duration: "Segundos",
    entities: ["Sale"],
    functions: ["salesPipelineApi → ixcApi (search_customer_by_document, search_contracts, check_financial_risk)"],
    workflows: [],
    details: [
      "Descriptografa CPF → busca no IXC por documento",
      "Se cliente existe: busca contratos + risco financeiro",
      "Calcula ixc_financial_risk: baixo / medio / alto",
      "Conta ixc_overdue_count: número de faturas vencidas",
      "Stage: ixc_consultado",
    ],
    next: "credit-check",
  },
  {
    id: "credit-check",
    num: 8,
    name: "Consulta Cadastral",
    icon: CreditCard,
    color: "orange",
    phase: "Pipeline",
    stage_value: "consulta_credito",
    desc: "Consulta de crédito via ValidaCadastro/Serasa",
    duration: "Segundos",
    entities: ["Sale", "CreditCheckLog"],
    functions: ["salesPipelineApi (run_credit_check)"],
    workflows: ["AutoCreditCheckOnNewLead"],
    details: [
      "Descriptografa CPF → envia para provider de crédito (CREDIT_API_URL)",
      "Provider: ValidaCadastro (CREDIT_ACCESS_KEY, CREDIT_PRODUCT_CODE)",
      "TipoPessoa: F (PF) ou J (PJ)",
      "Resultado: approved / approved_with_warning / manual_review / rejected",
      "Cria CreditCheckLog (LGPD: consent, purpose, masked doc)",
      "Stage: consulta_credito",
    ],
    next: "decision",
  },
  {
    id: "decision",
    num: 9,
    name: "Decisão de Crédito",
    icon: ShieldCheck,
    color: "emerald",
    phase: "Pipeline",
    stage_value: "aprovado / reprovado / analise_manual",
    desc: "Motor de decisão aplica regras administrativas",
    duration: "Instantâneo",
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
    ],
    next: "create-contract",
  },
  {
    id: "create-contract",
    num: 10,
    name: "Criação de Contrato IXC",
    icon: FileText,
    color: "blue",
    phase: "IXCSoft",
    stage_value: "contrato_gerado",
    desc: "Cliente + contrato criados no IXCSoft",
    duration: "Segundos",
    entities: ["Sale"],
    functions: ["salesPipelineApi → ixcApi (create_customer, create_contract)"],
    workflows: ["AutoContractAfterCreditApproval"],
    details: [
      "Se cliente não existe no IXC: cria (POST /cliente)",
      "  • Dados: razao, cnpj_cpf, telefone_celular, email, endereco, ativo='S'",
      "Cria contrato (POST /cliente_contrato)",
      "  • Dados: id_cliente, id_plano, valor_mensalidade, data_ativacao, status='A'",
      "Stage: contrato_gerado",
      "Salva: ixc_customer_id, ixc_contract_id",
    ],
    next: "send-signature",
  },
  {
    id: "send-signature",
    num: 11,
    name: "Envio para Assinatura",
    icon: PenTool,
    color: "violet",
    phase: "ZapSign",
    stage_value: "assinatura_enviada",
    desc: "Documento ZapSign criado e enviado via WhatsApp",
    duration: "Segundos",
    entities: ["Sale", "SignatureRequest", "ContractTemplate"],
    functions: ["salesPipelineApi → zapsignApi (create_from_ixc)"],
    workflows: ["ContractZapsignOnContratoStage"],
    details: [
      "Seleciona template (explícito ou mais utilizado)",
      "Busca dados cliente + contrato no IXC",
      "Preenche variáveis do template (fillVariables)",
      "Cria documento no ZapSign (POST /docs/)",
      "Salva SignatureRequest (status: 'pendente')",
      "Envia link de assinatura via WhatsApp (Evolution API)",
      "Stage: assinatura_enviada",
    ],
    next: "signed",
  },
  {
    id: "signed",
    num: 12,
    name: "Assinatura do Contrato",
    icon: FileSignature,
    color: "green",
    phase: "ZapSign",
    stage_value: "assinado",
    desc: "Cliente assina documento eletronicamente",
    duration: "Minutos a Dias",
    entities: ["SignatureRequest", "Sale", "Agreement", "Customer"],
    functions: ["zapsignApi (webhook → updateSignatureAndRelated)"],
    workflows: ["AdvanceCrmOnSignature", "ContractSignedWhatsApp"],
    details: [
      "ZapSign envia webhook (doc_signed) → zapsignApi action: webhook",
      "OU sync_status cron verifica pendentes",
      "updateSignatureAndRelated propaga:",
      "  → SignatureRequest.update(status: 'assinado', signed_date)",
      "  → Agreement.update(status: 'active', zapsign_status: 'signed')",
      "  → Customer.update(contract_status: 'ativo')",
      "  → ixcApi update_contract (status: 'A', status_internet: 'A')",
      "notifyContractSigned: WhatsApp para cliente + comercial",
      "Stage: assinado",
    ],
    next: "activation",
  },
  {
    id: "activation",
    num: 13,
    name: "Ativação do Plano",
    icon: Zap,
    color: "yellow",
    phase: "IXCSoft",
    stage_value: "concluido",
    desc: "Plano ativado no IXCSoft — cliente provisionado",
    duration: "Instantâneo",
    entities: ["Sale", "SignatureRequest"],
    functions: ["advanceCrmStage", "ixcApi (update_contract)"],
    workflows: ["AdvanceCrmOnSignature"],
    details: [
      "advanceCrmStage: Lead.update(stage: 'venda_fechada')",
      "Sale.update(stage: 'concluido')",
      "Contrato IXC ativado: status='A', status_internet='A'",
      "PPPoE/RADIUS provisionado (se aplicável)",
      "Timeline registra conclusão",
      "Comissão do revendedor calculada (se revenda)",
    ],
    next: null,
  },
];

const PHASES = [
  { name: "CRM", color: "bg-blue-500", lightColor: "bg-blue-50 dark:bg-blue-950/30", borderColor: "border-blue-300 dark:border-blue-700", textColor: "text-blue-700 dark:text-blue-300" },
  { name: "Pipeline", color: "bg-cyan-500", lightColor: "bg-cyan-50 dark:bg-cyan-950/30", borderColor: "border-cyan-300 dark:border-cyan-700", textColor: "text-cyan-700 dark:text-cyan-300" },
  { name: "IXCSoft", color: "bg-blue-700", lightColor: "bg-blue-50 dark:bg-blue-950/30", borderColor: "border-blue-300 dark:border-blue-700", textColor: "text-blue-700 dark:text-blue-300" },
  { name: "ZapSign", color: "bg-violet-500", lightColor: "bg-violet-50 dark:bg-violet-950/30", borderColor: "border-violet-300 dark:border-violet-700", textColor: "text-violet-700 dark:text-violet-300" },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: StageNode (nó do fluxograma)
// ═══════════════════════════════════════════════════════════════════════════

function StageNode({ stage, isLast, isSelected, onSelect }) {
  const Icon = stage.icon;
  const phase = PHASES.find((p) => p.name === stage.phase);

  const colorMap = {
    blue: { bg: "bg-blue-500", light: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300" },
    indigo: { bg: "bg-indigo-500", light: "bg-indigo-50 dark:bg-indigo-950/30", border: "border-indigo-200 dark:border-indigo-800", text: "text-indigo-700 dark:text-indigo-300" },
    purple: { bg: "bg-purple-500", light: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-300" },
    amber: { bg: "bg-amber-500", light: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300" },
    cyan: { bg: "bg-cyan-500", light: "bg-cyan-50 dark:bg-cyan-950/30", border: "border-cyan-200 dark:border-cyan-800", text: "text-cyan-700 dark:text-cyan-300" },
    teal: { bg: "bg-teal-500", light: "bg-teal-50 dark:bg-teal-950/30", border: "border-teal-200 dark:border-teal-800", text: "text-teal-700 dark:text-teal-300" },
    orange: { bg: "bg-orange-500", light: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300" },
    emerald: { bg: "bg-emerald-500", light: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300" },
    violet: { bg: "bg-violet-500", light: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-800", text: "text-violet-700 dark:text-violet-300" },
    green: { bg: "bg-green-600", light: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800", text: "text-green-700 dark:text-green-300" },
    yellow: { bg: "bg-yellow-500", light: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-200 dark:border-yellow-800", text: "text-yellow-700 dark:text-yellow-300" },
  };

  const c = colorMap[stage.color] || colorMap.blue;

  return (
    <div className="relative flex flex-col items-center">
      {/* Setas conectoras horizontais (desktop) */}
      {!isLast && (
        <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-border -z-0" />
      )}

      {/* Card do estágio */}
      <div
        onClick={() => onSelect(stage.id)}
        className={`relative z-10 w-full max-w-[200px] rounded-xl border-2 ${c.border} ${c.light} p-4 cursor-pointer transition-all hover:shadow-lg ${isSelected ? "ring-2 ring-primary ring-offset-2 scale-105" : "hover:scale-105"}`}
      >
        {/* Número + Ícone */}
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 rounded-full ${c.bg} flex items-center justify-center text-white font-bold shadow-md`}>
            {stage.num}
          </div>
          <Icon className={`w-6 h-6 ${c.text}`} />
        </div>

        {/* Nome */}
        <h4 className="font-bold text-sm mb-1 text-center">{stage.name}</h4>

        {/* Descrição curta */}
        <p className="text-[11px] text-muted-foreground text-center mb-2">{stage.desc}</p>

        {/* Badge de fase */}
        <div className="flex justify-center">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${phase.color} text-white`}>
            {stage.phase}
          </span>
        </div>

        {/* Stage value */}
        <p className="text-[10px] font-mono text-muted-foreground text-center mt-2 truncate">
          {stage.stage_value}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: StageDetail (detalhes do estágio selecionado)
// ═══════════════════════════════════════════════════════════════════════════

function StageDetail({ stage }) {
  if (!stage) return null;
  const Icon = stage.icon;

  return (
    <div className="rounded-xl border-2 border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-12 h-12 rounded-xl bg-primary flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-lg">{stage.num}. {stage.name}</h3>
          <p className="text-sm text-muted-foreground">{stage.desc}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Fase */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">Fase</p>
          <p className="text-sm font-bold">{stage.phase}</p>
        </div>
        {/* Duração */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Duração
          </p>
          <p className="text-sm font-bold">{stage.duration}</p>
        </div>
        {/* Stage */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">Stage (Entity)</p>
          <p className="text-sm font-mono font-bold">{stage.stage_value}</p>
        </div>
      </div>

      {/* Entidades */}
      {stage.entities.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
            <DbIcon className="w-3 h-3" /> Entidades Envolvidas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {stage.entities.map((e) => (
              <span key={e} className="px-2.5 py-1 rounded-md bg-card border border-border text-xs font-medium">
                {e}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Funções */}
      {stage.functions.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
            <Cpu className="w-3 h-3" /> Funções Backend
          </p>
          <div className="space-y-1">
            {stage.functions.map((f, i) => (
              <p key={i} className="text-xs font-mono text-foreground bg-muted/50 border border-border rounded px-2 py-1">
                {f}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Workflows */}
      {stage.workflows.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
            <Workflow className="w-3 h-3" /> Workflows Automáticos
          </p>
          <div className="flex flex-wrap gap-1.5">
            {stage.workflows.map((w) => (
              <span key={w} className="px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs font-medium text-primary flex items-center gap-1">
                <Workflow className="w-3 h-3" /> {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fluxo de execução */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
          <ChevronRight className="w-3 h-3" /> Fluxo de Execução
        </p>
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
          {stage.details.map((d, i) => {
            const isSubItem = d.trim().startsWith("•") || d.trim().startsWith("  •");
            return (
              <div key={i} className={`flex items-start gap-2 ${isSubItem ? "ml-4" : ""}`}>
                <ArrowRight className={`w-3 h-3 mt-0.5 flex-shrink-0 ${isSubItem ? "text-muted-foreground/50" : "text-primary"}`} />
                <span className={`text-xs font-mono ${isSubItem ? "text-muted-foreground" : "text-foreground"}`}>
                  {d.replace(/^  •\s*/, "• ").replace(/^•\s*/, "")}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: DecisionBranch (caminhos de decisão)
// ═══════════════════════════════════════════════════════════════════════════

function DecisionBranch() {
  return (
    <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Route className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-base">Caminhos de Decisão de Crédito (Etapa 9)</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Aprovado */}
        <div className="rounded-lg border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="font-bold text-sm text-green-700 dark:text-green-400">APROVADO</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Sem restrições + risco IXC baixo</p>
          <div className="text-xs space-y-1.5">
            <p className="flex items-center gap-1.5"><ArrowDown className="w-3 h-3 text-green-600" /> Stage: <strong>aprovado</strong></p>
            <p className="flex items-center gap-1.5"><ArrowDown className="w-3 h-3 text-green-600" /> Cria contrato no IXC</p>
            <p className="flex items-center gap-1.5"><ArrowDown className="w-3 h-3 text-green-600" /> Envia para assinatura ZapSign</p>
            <p className="flex items-center gap-1.5"><ArrowDown className="w-3 h-3 text-green-600" /> Ativa plano</p>
          </div>
        </div>

        {/* Ressalvas */}
        <div className="rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="font-bold text-sm text-amber-700 dark:text-amber-400">RESSALVAS</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Restrição leve encontrada</p>
          <div className="text-xs space-y-1.5">
            <p className="flex items-center gap-1.5"><ArrowDown className="w-3 h-3 text-amber-600" /> Stage: <strong>aprovado</strong></p>
            <p className="flex items-center gap-1.5"><ArrowDown className="w-3 h-3 text-amber-600" /> Prossegue normalmente</p>
            <p className="flex items-center gap-1.5"><ArrowDown className="w-3 h-3 text-amber-600" /> Marca credit_decision</p>
          </div>
        </div>

        {/* Reprovado */}
        <div className="rounded-lg border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="font-bold text-sm text-red-700 dark:text-red-400">REPROVADO</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Risco alto IXC ou restrição grave</p>
          <div className="text-xs space-y-1.5">
            <p className="flex items-center gap-1.5"><ArrowDown className="w-3 h-3 text-red-600" /> Stage: <strong>reprovado</strong></p>
            <p className="flex items-center gap-1.5"><ArrowDown className="w-3 h-3 text-red-600" /> NÃO cria contrato</p>
            <p className="flex items-center gap-1.5"><ArrowDown className="w-3 h-3 text-red-600" /> Requer intervenção humana</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: IntegracoesBar (barra de integrações)
// ═══════════════════════════════════════════════════════════════════════════

function IntegracoesBar() {
  const integrations = [
    { name: "IXCSoft", icon: Database, color: "bg-blue-500", desc: "ERP do provedor" },
    { name: "Evolution API", icon: MessageSquare, color: "bg-green-500", desc: "WhatsApp" },
    { name: "ZapSign", icon: FileSignature, color: "bg-violet-500", desc: "Assinatura digital" },
    { name: "ValidaCadastro", icon: CreditCard, color: "bg-orange-500", desc: "Consulta cadastral" },
    { name: "Base44 SDK", icon: Cpu, color: "bg-primary", desc: "Plataforma" },
    { name: "InvokeLLM", icon: Bot, color: "bg-purple-500", desc: "IA" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-bold text-base mb-4 flex items-center gap-2">
        <Webhook className="w-5 h-5 text-primary" /> Integrações Conectadas no Fluxo
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {integrations.map((int) => {
          const Icon = int.icon;
          return (
            <div key={int.name} className="rounded-lg border border-border bg-muted/30 p-3 text-center hover:shadow-md transition-shadow">
              <div className={`w-10 h-10 rounded-lg ${int.color} flex items-center justify-center mx-auto mb-2`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs font-bold">{int.name}</p>
              <p className="text-[10px] text-muted-foreground">{int.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: ProgressTracker (barra de progresso)
// ═══════════════════════════════════════════════════════════════════════════

function ProgressTracker({ currentStage, onSelect }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Route className="w-4 h-4 text-primary" />
        <h3 className="font-bold text-sm">Progresso da Jornada</h3>
      </div>
      <div className="flex items-center overflow-x-auto scrollbar-thin pb-2">
        {FLOW_STAGES.map((stage, idx) => (
          <React.Fragment key={stage.id}>
            <button
              onClick={() => onSelect(stage.id)}
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                currentStage === stage.id
                  ? "bg-primary text-primary-foreground scale-110 ring-2 ring-primary ring-offset-2"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
              title={stage.name}
            >
              {stage.num}
            </button>
            {idx < FLOW_STAGES.length - 1 && (
              <div className="flex-shrink-0 w-4 h-0.5 bg-border mx-0.5" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: PhaseLegend (legenda de fases)
// ═══════════════════════════════════════════════════════════════════════════

function PhaseLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {PHASES.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <div className={`w-3 h-3 rounded-full ${p.color}`} />
          <span className="text-xs font-medium text-muted-foreground">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function FlowPanel() {
  const [selectedStage, setSelectedStage] = useState("start-sale");

  const currentStage = FLOW_STAGES.find((s) => s.id === selectedStage);

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold font-heading">Painel Visual do Fluxo Completo</h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Jornada completa: desde a entrada do lead no CRM até a assinatura final do contrato no ZapSign
          e ativação do plano no IXCSoft. Clique em cada etapa para ver detalhes técnicos.
        </p>
      </div>

      {/* Legenda de fases */}
      <div className="mb-4">
        <PhaseLegend />
      </div>

      {/* Progress tracker */}
      <div className="mb-6">
        <ProgressTracker currentStage={selectedStage} onSelect={setSelectedStage} />
      </div>

      {/* Fluxograma visual — horizontal no desktop, vertical no mobile */}
      <div className="mb-6">
        {/* Desktop: horizontal */}
        <div className="hidden lg:block overflow-x-auto scrollbar-thin pb-4">
          <div className="flex items-start gap-0 min-w-max">
            {FLOW_STAGES.map((stage, idx) => (
              <React.Fragment key={stage.id}>
                <div className="flex-shrink-0 px-2">
                  <StageNode
                    stage={stage}
                    isLast={idx === FLOW_STAGES.length - 1}
                    isSelected={selectedStage === stage.id}
                    onSelect={setSelectedStage}
                  />
                </div>
                {idx < FLOW_STAGES.length - 1 && (
                  <div className="flex items-center pt-12">
                    <ArrowRight className="w-6 h-6 text-border" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Mobile: vertical */}
        <div className="lg:hidden space-y-3">
          {FLOW_STAGES.map((stage, idx) => (
            <React.Fragment key={stage.id}>
              <StageNode
                stage={stage}
                isLast={idx === FLOW_STAGES.length - 1}
                isSelected={selectedStage === stage.id}
                onSelect={setSelectedStage}
              />
              {idx < FLOW_STAGES.length - 1 && (
                <div className="flex justify-center">
                  <ArrowDown className="w-6 h-6 text-border" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Detalhes da etapa selecionada */}
      <div className="mb-6">
        <StageDetail stage={currentStage} />
      </div>

      {/* Caminhos de decisão */}
      <div className="mb-6">
        <DecisionBranch />
      </div>

      {/* Integrações */}
      <div className="mb-6">
        <IntegracoesBar />
      </div>

      {/* Resumo */}
      <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
        <h3 className="font-bold text-base mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-primary" /> Resumo da Jornada
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <div>
            <p className="text-2xl font-bold text-primary">13</p>
            <p className="text-xs text-muted-foreground">Etapas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">4</p>
            <p className="text-xs text-muted-foreground">Fases</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">6</p>
            <p className="text-xs text-muted-foreground">Integrações</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">9</p>
            <p className="text-xs text-muted-foreground">Workflows automáticos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">1</p>
            <p className="text-xs text-muted-foreground">correlation_id</p>
          </div>
        </div>
        <div className="pt-4 border-t border-primary/10 space-y-2">
          <p className="text-xs text-muted-foreground">
            <strong>Fase 1 — CRM:</strong> Lead entra (1), primeiro contato (2), qualificação (3), proposta (4)
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Fase 2 — Pipeline:</strong> Venda iniciada (5), validação doc (6), consulta IXC (7), crédito (8), decisão (9)
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Fase 3 — IXCSoft:</strong> Contrato criado (10)
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Fase 4 — ZapSign:</strong> Envio assinatura (11), assinatura (12)
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Fase 5 — Ativação:</strong> Plano ativado no IXCSoft (13) — jornada concluída
          </p>
        </div>
      </div>
    </PageContainer>
  );
}