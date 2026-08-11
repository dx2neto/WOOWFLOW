import React, { useState } from "react";
import { PageContainer, Card } from "@/components/ui/app-card";
import {
  MessageSquare, GitBranch, DollarSign, ShieldCheck, RefreshCw, Bot,
  ChevronDown, ChevronRight, Workflow, ArrowRight, Database, Cpu,
  Webhook, Phone, FileText, FileSignature, CreditCard, Zap, Clock,
  AlertTriangle, CheckCircle, Users, Inbox, Send
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// DADOS DOS FLUXOS DOCUMENTADOS
// ═══════════════════════════════════════════════════════════════════════════

const FLOW_SECTIONS = [
  {
    id: "atendimento",
    title: "1. Fluxo de Atendimento Omnichannel",
    icon: MessageSquare,
    color: "blue",
    summary: "Mensagem recebida via WhatsApp → processamento → auto-resposta IA → escalation humano",
    steps: [
      {
        title: "1.1 Recebimento de Mensagem (Webhook)",
        trigger: "Evolution API envia POST para /functions/evolutionWebhook",
        actors: ["Evolution API", "evolutionWebhook"],
        entities: ["Conversation", "Message", "MessageSyncLog"],
        flow: [
          "Evolution API envia webhook (messages.upsert / messages.update / connection.update)",
          "Rate limiting: 120 req/min por IP",
          "Autenticação: key na URL (?key=EVOLUTION_API_KEY) ou header apikey",
          "Parse do payload: extrai phone, waId, fromMe, pushName, msgBody, msgType, textContent, timestamp",
          "Filtro: grupos e chats vazios são descartados (MessageSyncLog: filtered)",
          "Deduplicação: query Message.filter({ wa_message_id: { $in: waIds } }) para evitar duplicatas",
          "Pré-busca: Conversation.filter({ phone: { $in: phones } }) para upsert em lote",
        ],
      },
      {
        title: "1.2 Sincronização de Conversa",
        trigger: "Mensagem válida recebida",
        actors: ["evolutionWebhook"],
        entities: ["Conversation", "Message"],
        flow: [
          "Upsert Conversation: cria se não existe, atualiza se existe",
          "Pré-vinculação IXC: busca cliente por telefone no IXCSoft → preenche customer_name, city",
          "Atualiza last_message, last_message_time, unread=true",
          "Save Message: direction (in/out/ai), type (text/audio/image/document), status, timestamp",
          "MessageSyncLog: registra sync_status (synced/duplicate/error/filtered/rate_limited)",
          "Auto-tag via IA: InvokeLLM classifica a mensagem com tags disponíveis (Tag.list)",
        ],
      },
      {
        title: "1.3 Auto-resposta com IA (aiOrchestrator)",
        trigger: "Conversation.ai_enabled = true e mensagem é do cliente",
        actors: ["aiOrchestrator", "ixcApi", "InvokeLLM"],
        entities: ["AIInteraction", "SupportTicket"],
        flow: [
          "Detecta instância Evolution conectada (fetchInstances)",
          "Busca histórico: Message.filter({ conversation_id }) — últimas 12 mensagens",
          "Determina saudação por horário (bom dia/tarde/noite)",
          "Passo 1 — Roteamento por palavra-chave (instantâneo, sem LLM):",
          "  • finance: boleto, fatura, pix, vencimento, cobrança, negociar...",
          "  • tech: conexão, internet, offline, lento, wifi, roteador, sinal...",
          "  • sales: plano novo, contratar, upgrade, cobertura...",
          "  • retention: cancelar, concorrente, caro, vou trocar, procon...",
          "Passo 2 — Se keyword não encontra: LLM classifica (intent, specialist, sentiment, urgency, confidence)",
          "Passo 3 — Busca dados REAIS no IXC por especialista:",
          "  • finance → fetchPreAnalysis → faturas, débitos, risco financeiro",
          "  • tech → fetchPreAnalysis → contratos, PPPoE, status internet, equipamentos",
          "  • sales → fetchSalesData → planos disponíveis no IXC",
          "  • retention → fetchRetentionData → análise de churn (tempo, inadimplência, tickets)",
          "Passo 4 — Gera resposta com prompt do especialista + dados IXC + SYSTEM_GUARD (anti-injection)",
          "Passo 5 — Persiste AIInteraction (specialist, intent, confidence, needs_human, protocol)",
          "Passo 6 — Se specialist=tech e não é saudação: abre SupportTicket automático",
          "  • Deduplicação: não abre se já existe chamado aberto nas últimas 24h",
          "  • Se cliente identificado no IXC: cria OS no IXCSoft (os_create)",
          "Passo 7 — Envia resposta via Evolution API (sendWhatsAppMessage)",
          "Passo 8 — Salva mensagem AI (direction: 'ai') e atualiza Conversation",
        ],
      },
      {
        title: "1.4 Atendimento Humano (Inbox)",
        trigger: "Atendente abre Caixa de Entrada",
        actors: ["Atendente", "evolutionApi", "ixcApi"],
        entities: ["Conversation", "Message", "Lead"],
        flow: [
          "useConversations(100) carrega conversas (Conversation.list)",
          "useMessages(selectedId) carrega mensagens da conversa selecionada",
          "useEvolutionInbox: gerencia instâncias, sync history, contatos WhatsApp, envio de mídia",
          "useInboxRealtime: subscription realtime + invalidação de cache React Query",
          "useIxcPreAnalysis: pré-análise automática do cliente no IXC por telefone",
          "useInboxQuickActions: integrações rápidas (IXC, Serasa, ZapSign) direto do painel",
          "Atendente pode: enviar mensagem, áudio, arquivo, finalizar, transferir setor",
          "Finalizar: Conversation.update(status: 'finalizado') + mensagem interna de sistema",
          "Transferir: Conversation.update(assigned_user_id, sector) + mensagem interna",
        ],
      },
    ],
  },
  {
    id: "vendas",
    title: "2. Fluxo de Vendas (Lead → Ativação)",
    icon: GitBranch,
    color: "cyan",
    summary: "Lead entra no CRM → venda criada → crédito consultado → contrato IXC → ZapSign → ativação",
    steps: [
      {
        title: "2.1 Entrada do Lead",
        trigger: "Lead criado manualmente ou via mensagem WhatsApp",
        actors: ["Atendente", "IA (Lara)", "evolutionWebhook"],
        entities: ["Lead"],
        flow: [
          "Lead criado no CRM com: nome, telefone, origem, cidade, plano de interesse, valor estimado",
          "Stage inicial: novo_lead",
          "Atribuído a um usuário (vendedor) responsável",
          "Se via WhatsApp: evolutionWebhook cria Conversation + Lead automaticamente",
          "Workflow LeadStageOnMessage: advanceLeadOnInteraction move lead conforme interação",
        ],
      },
      {
        title: "2.2 Qualificação e Proposta",
        trigger: "Atendente ou IA avança lead no funil",
        actors: ["aiOrchestrator (sales specialist)", "ixcApi"],
        entities: ["Lead"],
        flow: [
          "Stage: primeiro_contato → qualificacao → proposta_enviada",
          "IA (sales specialist) busca planos disponíveis no IXC (fetchSalesData)",
          "Apresenta 3 opções: econômico, recomendado, premium",
          "Usa dados REAIS do IXC — nunca inventa valores ou velocidades",
          "Aguarda aceite do cliente para iniciar venda formal",
        ],
      },
      {
        title: "2.3 Início da Venda (salesPipelineApi)",
        trigger: "Atendente inicia venda formal",
        actors: ["salesPipelineApi"],
        entities: ["Sale"],
        flow: [
          "Gera correlation_id (UUID) — rastreia toda a jornada entre IXC, crédito, ZapSign, Evolution",
          "Criptografa CPF/CNPJ (AES-GCM com chave de INTERNAL_FUNCTION_TOKEN)",
          "Gera máscara LGPD: ***.***.***-45",
          "Determina tipo: direta (cliente final) ou revenda (via revendedor parceiro)",
          "Se revenda: busca dados do revendedor (Reseller entity)",
          "Calcula comissão: monthly_fee × commission_rate / 100",
          "Cria Sale entity (stage: 'novo_lead', timeline: [entry])",
        ],
      },
      {
        title: "2.4 Validação de Documento",
        trigger: "salesPipelineApi action: validate_document",
        actors: ["salesPipelineApi"],
        entities: ["Sale"],
        flow: [
          "Descriptografa CPF/CNPJ (AES-GCM)",
          "Valida: 11 dígitos (PF) ou 14 dígitos (PJ)",
          "Stage: cpf_validado",
          "Timeline registra tipo de documento (PF ou PJ)",
        ],
      },
      {
        title: "2.5 Consulta IXC (Cliente Existente)",
        trigger: "salesPipelineApi action: check_ixc_customer",
        actors: ["salesPipelineApi", "ixcApi"],
        entities: ["Sale"],
        flow: [
          "Descriptografa CPF → busca no IXC por documento (search_customer_by_document)",
          "Se cliente existe: busca contratos (search_contracts) e risco financeiro (check_financial_risk)",
          "Calcula ixc_financial_risk: baixo / medio / alto (baseado em faturas vencidas)",
          "Conta ixc_overdue_count: número de faturas vencidas",
          "Stage: ixc_consultado",
          "Salva: ixc_customer_id, ixc_customer_exists, ixc_financial_risk, ixc_overdue_count",
        ],
      },
      {
        title: "2.6 Consulta Cadastral (Crédito)",
        trigger: "salesPipelineApi action: run_credit_check OU workflow AutoCreditCheckOnNewLead",
        actors: ["salesPipelineApi", "ValidaCadastro API"],
        entities: ["Sale", "CreditCheckLog"],
        flow: [
          "Descriptografa CPF → envia para provider de crédito (CREDIT_API_URL)",
          "Provider atual: ValidaCadastro (pode ser Serasa, Quod, BoaVista no futuro)",
          "Payload: CodigoProduto, Versao, ChaveAcesso, TipoPessoa (F/J), CPFCNPJ",
          "Normaliza resultado: approved / approved_with_warning / manual_review / rejected",
          "Cria CreditCheckLog (LGPD: cpf_cnpj_masked, lgpd_consent, purpose, performed_by)",
          "Stage: consulta_credito",
          "Salva: credit_check_id, credit_decision, credit_reason",
        ],
      },
      {
        title: "2.7 Decisão de Crédito (Motor de Decisão)",
        trigger: "salesPipelineApi action: make_decision",
        actors: ["salesPipelineApi"],
        entities: ["Sale"],
        flow: [
          "evaluateDecision(creditResult, ixcRisk, ixcOverdueCount):",
          "  • ixcRisk='alto' OR ixcOverdueCount>5 → REPROVADO (risco IXC pesa mais)",
          "  • creditResult='rejected' → REPROVADO (restrições encontradas)",
          "  • creditResult='error' → ANÁLISE MANUAL (erro na consulta)",
          "  • ixcRisk='medio' + creditResult='approved_with_warning' → ANÁLISE MANUAL",
          "  • creditResult='approved_with_warning' → APROVADO COM RESSALVAS",
          "  • else → APROVADO",
          "Stage: aprovado / reprovado / analise_manual",
          "Salva: decision_reason",
        ],
      },
      {
        title: "2.8 Criação de Contrato no IXC",
        trigger: "salesPipelineApi action: create_ixc_contract OU workflow AutoContractAfterCreditApproval",
        actors: ["salesPipelineApi", "ixcApi"],
        entities: ["Sale"],
        flow: [
          "Se cliente não existe no IXC: cria cliente (ixcApi create_customer)",
          "  • Dados: razao, cnpj_cpf, telefone_celular, email, endereco, bairro, ativo='S'",
          "  • ⚠️ Bug conhecido: cpf_cnpj enviado criptografado ao IXC (deveria descriptografar)",
          "Cria contrato no IXC (ixcApi create_contract)",
          "  • Dados: id_cliente, id_plano, descricao_plano, valor_mensalidade, endereco, data_ativacao, status='A'",
          "Stage: contrato_gerado",
          "Salva: ixc_customer_id, ixc_contract_id, plan_name, plan_id, monthly_fee",
          "Workflow ContractZapsignOnContratoStage: dispara envio para assinatura automaticamente",
        ],
      },
      {
        title: "2.9 Envio para Assinatura (ZapSign)",
        trigger: "salesPipelineApi action: send_for_signature OU workflow ContractZapsignOnContratoStage",
        actors: ["salesPipelineApi", "zapsignApi", "evolutionApi"],
        entities: ["Sale", "SignatureRequest", "ContractTemplate"],
        flow: [
          "Seleciona template: explícito (template_id) ou mais utilizado (fallback automático)",
          "zapsignApi action: create_from_ixc",
          "Busca dados do cliente IXC (ixcFetch /cliente) + contrato (ixcFetch /cliente_contrato)",
          "Merge de dados: cliente + contrato → mergedData",
          "Preenche variáveis do template (fillVariables): nome, cpf, endereco, plano, valor, etc.",
          "Constrói payload ZapSign: template_id, template_data, signers, name",
          "Cria documento no ZapSign (POST /docs/)",
          "Salva SignatureRequest: status='pendente', zapsign_doc_token, sign_url, expires_at",
          "Incrementa ContractTemplate.usage_count",
          "Envia link de assinatura via WhatsApp (Evolution API sendWhatsAppMessage)",
          "  • Mensagem personalizada com {nome}, {link_assinatura}, {plano}, {valor}",
          "Stage: assinatura_enviada",
          "Salva: signature_request_id, zapsign_doc_token, sign_url, whatsapp_sent, whatsapp_status",
        ],
      },
      {
        title: "2.10 Assinatura do Contrato",
        trigger: "Cliente assina documento no ZapSign → webhook OU sync_status",
        actors: ["ZapSign", "zapsignApi", "evolutionApi"],
        entities: ["SignatureRequest", "Sale", "Agreement", "Customer"],
        flow: [
          "ZapSign envia webhook (doc_signed / doc_refused) → zapsignApi action: webhook",
          "OU sync_status cron diário verifica documentos pendentes",
          "updateSignatureAndRelated:",
          "  • SignatureRequest.update(status: 'assinado', signed_date)",
          "  • Se assinado: Agreement.update(status: 'active', zapsign_status: 'signed')",
          "  • Se assinado: Customer.update(contract_status: 'ativo')",
          "  • Se assinado: ixcApi update_contract (status: 'A', status_internet: 'A') — ativa no IXC",
          "notifyContractSigned: envia WhatsApp para cliente (confirmação) + comercial (notificação)",
          "Workflow AdvanceCrmOnSignature: advanceCrmStage → Sale.update(stage: 'concluido')",
          "Workflow ContractSignedWhatsApp: notifyContractSigned",
          "Stage: assinado → concluido",
        ],
      },
      {
        title: "2.11 Ativação do Plano no IXCSoft",
        trigger: "Assinatura concluída → workflow AdvanceCrmOnSignature",
        actors: ["advanceCrmStage", "ixcApi"],
        entities: ["Sale", "SignatureRequest"],
        flow: [
          "advanceCrmStage: busca Lead por telefone → Lead.update(stage: 'venda_fechada')",
          "Sale.update(stage: 'concluido')",
          "Contrato IXC já ativado no passo anterior (status: 'A', status_internet: 'A')",
          "PPPoE/RADIUS provisionado (se aplicável — depende de integração RADIUS)",
          "Timeline registra conclusão da venda",
          "Comissão do revendedor calculada (se venda tipo revenda)",
          "Se revenda: Reseller.total_sales e total_commission atualizados",
        ],
      },
    ],
  },
  {
    id: "cobranca",
    title: "3. Fluxo de Cobrança e Lembretes",
    icon: DollarSign,
    color: "amber",
    summary: "Faturas IXC → régua de cobrança → lembretes WhatsApp → negociação → acordo",
    steps: [
      {
        title: "3.1 Régua de Cobrança (BillingRule)",
        trigger: "Workflow BillingRuleWhatsApp (cron diário)",
        actors: ["sendBillingRuleReminders", "ixcApi", "evolutionApi"],
        entities: ["BillingRule", "ReminderLog"],
        flow: [
          "Autenticação: user OU internal_token (para chamadas agendadas)",
          "Busca todas as faturas em aberto no IXC (ixcApi action: faturas)",
          "Carrega regras ativas: BillingRule.filter({ active: true })",
          "Carrega lembretes já enviados: ReminderLog.filter({ status: 'enviado' })",
          "Para cada fatura: calcula daysDiff = (due_date - today)",
          "Para cada regra: se daysDiff === rule.days_offset:",
          "  • Verifica dedup: `${rule.name}:${inv.id}` já enviado?",
          "  • Preenche template: {customer_name}, {value}, {due_date}",
          "  • Envia WhatsApp: evolutionApi action: send_message",
          "  • Cria ReminderLog (status: enviado ou falha)",
        ],
      },
      {
        title: "3.2 Lembrete de Pagamento (+5 dias atraso)",
        trigger: "Workflow PaymentReminderWhatsApp (cron diário)",
        actors: ["sendPaymentReminders", "ixcApi", "evolutionApi"],
        entities: ["ReminderLog"],
        flow: [
          "Busca faturas vencidas há mais de 5 dias no IXC",
          "Filtra: status='A' (em aberto) + data_vencimento < hoje - 5 dias",
          "Para cada fatura: envia lembrete via WhatsApp",
          "Mensagem: nome, valor, data vencimento, dias de atraso",
          "Registra ReminderLog",
        ],
      },
      {
        title: "3.3 Oferta de Negociação",
        trigger: "Workflow NegotiationOfferWhatsApp (cron diário)",
        actors: ["sendNegotiationOffers", "ixcApi", "evolutionApi"],
        entities: ["NegotiationOfferLog", "Agreement"],
        flow: [
          "Busca clientes inadimplentes no IXC (faturas vencidas)",
          "Para cada cliente: verifica se já existe acordo ativo (Agreement entity)",
          "Se não existe acordo: envia oferta de negociação via WhatsApp",
          "Mensagem: proposta de parcelamento, desconto à vista, ou renegociação",
          "Registra NegotiationOfferLog",
          "Se cliente aceita: atendente cria Agreement manualmente",
        ],
      },
      {
        title: "3.4 Verificação de Acordo",
        trigger: "Atendente solicita verificação OU workflow AgreementVerification (cron diário)",
        actors: ["agreementApi", "ixcApi"],
        entities: ["Agreement", "AgreementVerificationLog", "AgreementInstallment"],
        flow: [
          "Busca cliente no IXC (findIxcCustomer): por clientId, cpfCnpj, phone ou contractId",
          "Busca títulos no IXC: fn_areceber.filter({ id_cliente })",
          "Classifica títulos: paid (status='P'), open (status='A' + futuro), overdue (status='A' + passado)",
          "Classifica status do acordo (classifyAgreementStatus):",
          "  • paid: todas pagas",
          "  • active: nenhuma vencida",
          "  • overdue: vencida mas dentro da tolerância (5 dias)",
          "  • broken: vencida além do limite (15 dias)",
          "  • none: sem faturas",
          "Determina ação recomendada (determineRecommendedAction):",
          "  • none → none",
          "  • zapsign pending → send_zapsign",
          "  • active → send_reminder",
          "  • overdue → request_payment",
          "  • broken → renegotiate",
          "Busca acordo local: Agreement.filter({ customer_id | customer_cpf_cnpj })",
          "Registra AgreementVerificationLog",
          "Retorna: hasAgreement, agreementStatus, invoices, recommendedAction",
        ],
      },
    ],
  },
  {
    id: "assinatura",
    title: "4. Fluxo de Assinatura Digital (ZapSign)",
    icon: FileSignature,
    color: "violet",
    summary: "Template → documento ZapSign → WhatsApp → assinatura → propagação IXC",
    steps: [
      {
        title: "4.1 Criação de Documento (create_from_ixc)",
        trigger: "salesPipelineApi send_for_signature OU workflow ContractZapsignOnContratoStage",
        actors: ["zapsignApi", "ixcApi"],
        entities: ["SignatureRequest", "ContractTemplate"],
        flow: [
          "Valida: ZAPSIGN_API_TOKEN + IXC_API_URL + IXC_API_TOKEN configurados",
          "Busca template: ContractTemplate.get(templateId)",
          "Busca dados cliente IXC: ixcFetch /cliente (qtype: cliente.id)",
          "Busca contrato IXC: ixcFetch /cliente_contrato (qtype: cliente_contrato.id)",
          "Merge de dados: cliente + contrato → mergedData",
          "Preenche variáveis (fillVariables): mapeia IXC_MAP → {nome, cpf, endereco, plano, valor, etc.}",
          "Constrói payload ZapSign:",
          "  • Se template.zapsign_template_id: usa template ZapSign + template_data",
          "  • Senão: erro (NO_ZAPSIGN_TEMPLATE)",
          "Adiciona signatários: cliente + extra_signers do template",
          "POST /docs/ no ZapSign → cria documento",
          "Salva SignatureRequest: zapsign_doc_token, sign_url, signers, expires_at",
          "Incrementa ContractTemplate.usage_count",
        ],
      },
      {
        title: "4.2 Envio via WhatsApp",
        trigger: "Documento criado e sendWhatsApp=true",
        actors: ["zapsignApi", "evolutionApi (sendWhatsAppMessage)"],
        entities: ["SignatureRequest"],
        flow: [
          "Mensagem personalizada: template.whatsapp_message_template",
          "Variáveis: {nome}, {link_assinatura}, {plano}, {valor}, {tipo_doc}",
          "Normaliza telefone: normalizePhoneBR()",
          "Envia via Evolution API (sendWhatsAppMessage)",
          "Se sucesso: SignatureRequest.update(whatsapp_sent: true, whatsapp_sent_at, whatsapp_instance)",
          "Se falha: documento foi criado, mas WhatsApp falhou — não bloqueia o fluxo",
        ],
      },
      {
        title: "4.3 Assinatura e Propagação",
        trigger: "ZapSign webhook (doc_signed) OU sync_status cron",
        actors: ["zapsignApi", "ixcApi", "notifyContractSigned"],
        entities: ["SignatureRequest", "Sale", "Agreement", "Customer"],
        flow: [
          "ZapSign envia webhook → zapsignApi action: webhook",
          "OU sync_status cron verifica documentos pendentes (GET /docs/{token}/)",
          "mapZapStatus: finished → assinado, expired → expirado, refused → cancelado",
          "updateSignatureAndRelated (se assinado):",
          "  • SignatureRequest.update(status: 'assinado', signed_date)",
          "  • Agreement.filter({ ixc_customer_id }) → update(status: 'active', zapsign_status: 'signed')",
          "  • Customer.filter({ phone }) → update(contract_status: 'ativo')",
          "  • ixcApi update_contract: status='A', status_internet='A' (ativa no IXC)",
          "notifyContractSigned: envia WhatsApp para cliente + comercial",
          "Workflow AdvanceCrmOnSignature: advanceCrmStage → Sale.update(stage: 'concluido')",
        ],
      },
      {
        title: "4.4 Sincronização de Status (Batch)",
        trigger: "Workflow ZapSignStatusSync (cron diário)",
        actors: ["zapsignApi"],
        entities: ["SignatureRequest"],
        flow: [
          "Busca documentos pendentes: SignatureRequest.filter({ status: 'pendente' })",
          "Para cada documento: GET /docs/{token}/ no ZapSign",
          "Se status mudou: updateSignatureAndRelated",
          "Retorna: synced (total verificado), updated (quantos mudaram)",
        ],
      },
    ],
  },
  {
    id: "sincronizacao",
    title: "5. Fluxo de Sincronização IXC (Diário)",
    icon: RefreshCw,
    color: "emerald",
    summary: "Sincronização automática de planos e contratos do IXCSoft para entidades locais",
    steps: [
      {
        title: "5.1 Sincronização de Planos",
        trigger: "Workflow SyncIxcPlans (cron 03:00 AM)",
        actors: ["ixcApi (sync_plans)"],
        entities: ["IxcPlan", "IntegrationLog"],
        flow: [
          "fetchAllPages('/plano', ...) — busca todas as páginas até 500 registros",
          "Busca IxcPlan.list() existentes (até 500)",
          "Para cada plano no IXC:",
          "  • Normaliza: ixc_plan_id, name, download, upload, price, active, type, fidelity",
          "  • Se existe (por ixc_plan_id): IxcPlan.update(normalized)",
          "  • Se não existe: IxcPlan.create(normalized)",
          "Salva raw_data (JSON snapshot) e last_synced_at",
          "IntegrationLog: action: sync_plans, status: sucesso, details: X novos, Y atualizados",
        ],
      },
      {
        title: "5.2 Sincronização de Contratos",
        trigger: "Workflow SyncIxcPlans (cron 03:00 AM) — passo 2",
        actors: ["ixcApi (sync_contratos)"],
        entities: ["IxcContract", "IntegrationLog"],
        flow: [
          "fetchAllPages('/cliente_contrato', ...) — busca todas as páginas até 500 registros",
          "Busca IxcContract.list() existentes (até 500)",
          "Busca nomes de clientes em lote: ixcPost /cliente (oper: IN)",
          "Carrega mapa de cidades: carregarMapaCidades() — resolve ID → nome",
          "Para cada contrato no IXC:",
          "  • Normaliza status: A→ativo, CA→cancelado, S→suspenso, outro→outro",
          "  • Normaliza: ixc_contract_id, ixc_customer_id, customer_name, plan_name, city, etc.",
          "  • Se existe (por ixc_contract_id): IxcContract.update(normalized)",
          "  • Se não existe: IxcContract.create(normalized)",
          "Salva raw_data (JSON snapshot) e last_synced_at",
          "IntegrationLog: action: sync_contratos, status: sucesso",
        ],
      },
    ],
  },
  {
    id: "ia",
    title: "6. Fluxo de Inteligência Artificial",
    icon: Bot,
    color: "purple",
    summary: "Orquestrador central: classificação → roteamento → dados IXC → resposta → escalonamento",
    steps: [
      {
        title: "6.1 Orquestrador Central (aiOrchestrator)",
        trigger: "Mensagem recebida com ai_enabled OU chamada manual",
        actors: ["aiOrchestrator", "ixcApi", "InvokeLLM"],
        entities: ["AIInteraction", "SupportTicket"],
        flow: [
          "Constrói contexto: histórico (últimas 12 mensagens) + customerInfo + saudação por horário",
          "Passo 1 — Roteamento por palavra-chave (instantâneo):",
          "  • routeByKeywords(message) — conta matches por especialista",
          "  • 2+ matches → confidence 0.95 | 1 match → confidence 0.80",
          "  • Especialistas: finance, tech, sales, retention",
          "Passo 2 — Se keyword não encontra: LLM classifica",
          "  • InvokeLLM com prompt de classificação + SYSTEM_GUARD",
          "  • Retorna: intent, specialist, sentiment, urgency, confidence, escalation_needed",
          "  • Se confidence < 0.6: escalation_needed = true",
          "Passo 3 — Busca dados REAIS no IXC (fetchSpecialistData):",
          "  • finance → fetchPreAnalysis → faturas, débitos, risco, total devido",
          "  • tech → fetchPreAnalysis → contratos, PPPoE, status internet, equipamentos",
          "  • sales → fetchSalesData → planos disponíveis (ixcApi action: planos)",
          "  • retention → fetchRetentionData → análise de churn (tempo, inadimplência, tickets)",
          "Passo 4 — Gera resposta com prompt do especialista + dados IXC + SYSTEM_GUARD",
          "  • InvokeLLM com response_json_schema: reply, actions_taken, confidence_reply, needs_human, protocol",
          "Passo 5 — Persiste AIInteraction para painel de monitoramento",
          "Passo 6 — Se specialist=tech e não é saudação: abre SupportTicket automático",
          "  • Deduplicação: não abre se já existe chamado nas últimas 24h",
          "  • Se cliente IXC identificado: cria OS no IXCSoft (os_create)",
          "Retorna: specialist, classification, specialist_data, response, mode, channel, timestamp",
        ],
      },
      {
        title: "6.2 Especialistas IA",
        trigger: "Orquestrador define especialista",
        actors: ["aiOrchestrator"],
        entities: ["AIInteraction"],
        flow: [
          "general: Lara — triagem, consultas gerais, direcionamento, informações de planos",
          "finance: IA Financeira — faturas, segunda via, PIX, boleto, negociação, desbloqueio",
          "tech: IA Técnica — diagnóstico de conectividade, status contrato, equipamentos, sinal óptico",
          "sales: IA de Vendas — lead → identificação → cobertura → planos → oferta → proposta → aceite",
          "retention: IA de Retenção — cancelamento, concorrente, risco de churn, ofertas de retenção",
          "copilot: Copiloto Técnico — sugestões internas para atendente humano (não envia ao cliente)",
          "Cada especialista tem prompt próprio + SYSTEM_GUARD (anti-injeção de prompt)",
        ],
      },
      {
        title: "6.3 Agentes IA (In-app)",
        trigger: "Configurados em base44/agents/",
        actors: ["lara", "finance_ai", "tech_support_ai", "retention_ai", "sales_ai"],
        entities: ["Conversation", "Lead", "Charge", "Agreement"],
        flow: [
          "lara: Atendimento geral via WhatsApp — pode criar/atualizar Lead, consultar IXC, chamar aiOrchestrator",
          "finance_ai: Financeiro — CRUD Charge/Agreement, chamar ixcApi, billingApi, evolutionApi",
          "tech_support_ai: Suporte técnico — read/update Conversation, chamar ixcApi, aiOrchestrator",
          "retention_ai: Retenção — análise de churn, ofertas de retenção",
          "sales_ai: Vendas — qualificação de leads, propostas, acompanhamento",
          "Cada agente tem permissões específicas de entidades e funções backend",
        ],
      },
    ],
  },
  {
    id: "notificacoes",
    title: "7. Fluxo de Notificações e Lembretes",
    icon: Send,
    color: "rose",
    summary: "Lembretes automáticos diários via WhatsApp para diferentes cenários",
    steps: [
      {
        title: "7.1 Lembrete de Instalação",
        trigger: "Workflow InstallationReminderWhatsApp (cron diário)",
        actors: ["sendInstallationReminders", "ixcApi", "evolutionApi"],
        entities: ["ReminderLog"],
        flow: [
          "Busca OS de instalação agendadas para o dia no IXC",
          "Para cada OS: envia confirmação via WhatsApp ao cliente",
          "Mensagem: data, horário, endereço, técnico responsável",
        ],
      },
      {
        title: "7.2 Lembrete de Assinatura (+24h)",
        trigger: "Workflow SignatureReminder24h (cron diário)",
        actors: ["sendSignatureReminders", "evolutionApi"],
        entities: ["SignatureRequest"],
        flow: [
          "Busca SignatureRequest.filter({ status: 'pendente' })",
          "Filtra: documentos pendentes há mais de 24 horas",
          "Para cada documento: reenvia link de assinatura via WhatsApp",
          "Mensagem: nome, link_assinatura, tipo_doc",
        ],
      },
      {
        title: "7.3 Renovação de Contrato",
        trigger: "Workflow ContractRenewalWhatsApp (cron diário)",
        actors: ["sendContractRenewalReminders", "ixcApi", "evolutionApi"],
        entities: ["ReminderLog"],
        flow: [
          "Busca contratos no IXC com data de expiração próxima (30 dias)",
          "Para cada contrato: envia lembrete de renovação via WhatsApp",
          "Mensagem: nome, plano, data de expiração, opções de renovação",
        ],
      },
      {
        title: "7.4 Resumo Diário de Vendas",
        trigger: "Workflow DailySalesSummary (cron diário)",
        actors: ["sendDailySalesSummary", "evolutionApi"],
        entities: ["Sale"],
        flow: [
          "Busca vendas do dia: Sale.filter({ created_date: hoje })",
          "Calcula: total de vendas, valor total, vendas por tipo (direta/revenda)",
          "Calcula: comissões totais (se revenda)",
          "Envia resumo via WhatsApp para o telefone comercial (COMMERCIAL_SECTOR_PHONE)",
          "Mensagem: resumo executivo com números e valores",
        ],
      },
      {
        title: "7.5 Follow-up de Leads",
        trigger: "Workflow LeadFollowUpCheck (cron diário)",
        actors: ["checkLeadFollowUps", "evolutionApi"],
        entities: ["Lead"],
        flow: [
          "Busca leads em stage: aguardando_retorno",
          "Filtra: next_contact <= hoje (follow-up atrasado)",
          "Para cada lead: envia mensagem de follow-up via WhatsApp",
          "Mensagem: nome, proposta anterior, próximo passo",
        ],
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: FlowSection (acordeão)
// ═══════════════════════════════════════════════════════════════════════════

function FlowSection({ section, isOpen, onToggle }) {
  const Icon = section.icon;
  const colorMap = {
    blue: "bg-blue-500",
    cyan: "bg-cyan-500",
    amber: "bg-amber-500",
    violet: "bg-violet-500",
    emerald: "bg-emerald-500",
    purple: "bg-purple-500",
    rose: "bg-rose-500",
  };

  return (
    <Card className="overflow-hidden">
      {/* Header clicável */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-5 hover:bg-muted/30 transition-colors text-left"
      >
        <div className={`w-10 h-10 rounded-lg ${colorMap[section.color]} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base">{section.title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{section.summary}</p>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {/* Conteúdo expandível */}
      {isOpen && (
        <div className="border-t border-border divide-y divide-border">
          {section.steps.map((step, idx) => (
            <div key={idx} className="p-5 space-y-4">
              {/* Título do passo */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">{idx + 1}</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm">{step.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> <strong>Trigger:</strong> {step.trigger}
                  </p>
                </div>
              </div>

              {/* Atores */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> Atores / Funções
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {step.actors.map((a, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-xs font-mono font-medium text-primary">
                      {a}
                    </span>
                  ))}
                </div>
              </div>

              {/* Entidades */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Database className="w-3 h-3" /> Entidades Envolvidas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {step.entities.map((e, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-card border border-border text-xs font-medium">
                      {e}
                    </span>
                  ))}
                </div>
              </div>

              {/* Fluxo de execução */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                  <Workflow className="w-3 h-3" /> Fluxo de Execução
                </p>
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                  {step.flow.map((line, i) => {
                    const isSubItem = line.trim().startsWith("•") || line.trim().startsWith("  •");
                    const isIndented = line.startsWith("  ");
                    return (
                      <div key={i} className={`flex items-start gap-2 ${isIndented ? "ml-4" : ""}`}>
                        <ArrowRight className={`w-3 h-3 mt-0.5 flex-shrink-0 ${isSubItem ? "text-muted-foreground/50" : "text-primary"}`} />
                        <span className={`text-xs font-mono ${isSubItem ? "text-muted-foreground" : "text-foreground"}`}>
                          {line.replace(/^  •\s*/, "• ").replace(/^•\s*/, "")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE: ConexoesDiagram (como os fluxos se conectam)
// ═══════════════════════════════════════════════════════════════════════════

function ConexoesDiagram() {
  const conexoes = [
    { from: "Mensagem WhatsApp", to: "Atendimento", desc: "evolutionWebhook cria Conversation + Message", icon: MessageSquare },
    { from: "Atendimento", to: "IA (Lara)", desc: "Se ai_enabled: aiOrchestrator responde", icon: Bot },
    { from: "IA (Lara)", to: "CRM (Lead)", desc: "Se intenção=vendas: cria/atualiza Lead", icon: Users },
    { from: "CRM (Lead)", to: "Vendas (Sale)", desc: "Lead aceita → salesPipelineApi start_sale", icon: GitBranch },
    { from: "Vendas (Sale)", to: "IXCSoft", desc: "Cria cliente + contrato no IXC", icon: Database },
    { from: "Vendas (Sale)", to: "ZapSign", desc: "Envia contrato para assinatura", icon: FileSignature },
    { from: "ZapSign", to: "IXCSoft", desc: "Assinado → ativa contrato no IXC", icon: CheckCircle },
    { from: "ZapSign", to: "WhatsApp", desc: "Notifica cliente + comercial", icon: Send },
    { from: "IXCSoft", to: "Cobrança", desc: "Faturas → régua de cobrança", icon: DollarSign },
    { from: "Cobrança", to: "Acordos", desc: "Inadimplente → negociação → acordo", icon: ShieldCheck },
    { from: "IXCSoft", to: "Sync Diário", desc: "Planos + contratos sincronizados", icon: RefreshCw },
    { from: "Sync Diário", to: "Dashboard", desc: "Dados atualizados para visualização", icon: Inbox },
  ];

  return (
    <Card className="p-5">
      <h3 className="font-bold text-base mb-4 flex items-center gap-2">
        <Webhook className="w-5 h-5 text-primary" /> Como os Fluxos se Conectam
      </h3>
      <div className="space-y-2">
        {conexoes.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-bold">
                  {c.from}
                </span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span className="px-2 py-0.5 rounded bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 text-xs font-bold">
                  {c.to}
                </span>
              </div>
              <p className="text-xs text-muted-foreground hidden md:block">{c.desc}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function FlowDocumentation() {
  const [openSection, setOpenSection] = useState("vendas"); // Default: Fluxo de Vendas

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold font-heading">Documentação Central de Fluxos</h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Documento centralizado descrevendo todos os fluxos de trabalho do sistema ConnectFlow Hub.
          Cada fluxo detalha trigger, atores, entidades envolvidas e o passo-a-passo da execução,
          mostrando como cada etapa do atendimento e da venda se conecta no sistema.
        </p>
      </div>

      {/* Índice */}
      <Card className="p-5 mb-6">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <ChevronRight className="w-4 h-4" /> Índice de Fluxos
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {FLOW_SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setOpenSection(s.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors ${
                  openSection === s.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{s.title}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Diagrama de conexões */}
      <div className="mb-6">
        <ConexoesDiagram />
      </div>

      {/* Seções de fluxo */}
      <div className="space-y-4">
        {FLOW_SECTIONS.map((section) => (
          <FlowSection
            key={section.id}
            section={section}
            isOpen={openSection === section.id}
            onToggle={() => setOpenSection(openSection === section.id ? null : section.id)}
          />
        ))}
      </div>

      {/* Rodapé */}
      <div className="mt-8 rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
        <h3 className="font-bold text-base mb-2 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-primary" /> Resumo do Sistema
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-2xl font-bold text-primary">7</p>
            <p className="text-xs text-muted-foreground">Fluxos documentados</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">31</p>
            <p className="text-xs text-muted-foreground">Passos detalhados</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">20+</p>
            <p className="text-xs text-muted-foreground">Workflows automáticos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">6</p>
            <p className="text-xs text-muted-foreground">Integrações externas</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          O sistema opera como uma esteira integrada: mensagens chegam via Evolution API, são processadas
          pelo webhook, a IA (aiOrchestrator) classifica e responde automaticamente, vendas fluem pelo
          salesPipelineApi com rastreabilidade via correlation_id, contratos são criados no IXCSoft e
          assinados via ZapSign, e tudo é sincronizado diariamente para o Dashboard.
        </p>
      </div>
    </PageContainer>
  );
}