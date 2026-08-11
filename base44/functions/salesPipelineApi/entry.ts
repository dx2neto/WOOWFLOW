import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { secrets } from 'base44:runtime';
import { logError } from '../../shared/errorLogger.ts';
import { sendWhatsAppMessage } from '../../shared/evolutionSend.ts';
import { normalizePhoneBR, maskDocument, generateCorrelationId, buildTimelineEntry } from '../../shared/salesUtils.ts';
import { encrypt, decrypt, maskCpfCnpj } from '../../shared/crypto.ts';
import { fetchWithRetry } from '../../shared/fetchWithRetry.ts';

// ── Credit Check Provider Abstraction ─────────────────────────────────────
// Provider atual: ValidaCadastro. A abstracao permite futura substituicao
// por Serasa, Quod ou BoaVista sem alterar a esteira de vendas.

interface CreditCheckResult {
  success: boolean;
  status: 'approved' | 'approved_with_warning' | 'manual_review' | 'rejected' | 'error';
  has_restrictions: boolean;
  restriction_count: number;
  raw_summary: string;
}

async function runCreditCheck(cpfCnpj: string, saleId: string, correlationId: string, userId: string, userName: string): Promise<CreditCheckResult> {
  const apiUrl = secrets.get('CREDIT_API_URL') || '';
  const productCode = secrets.get('CREDIT_PRODUCT_CODE') || '630';
  const version = secrets.get('CREDIT_VERSION') || '20180521';
  const accessKey = secrets.get('CREDIT_ACCESS_KEY') || '';

  if (!apiUrl || !accessKey) {
    return { success: false, status: 'error', has_restrictions: false, restriction_count: 0, raw_summary: 'Credenciais do provider de credito nao configuradas' };
  }

  const doc = String(cpfCnpj).replace(/\D/g, '');
  const tipoPessoa = doc.length > 11 ? 'J' : 'F';

  const payload = {
    CodigoProduto: productCode,
    Versao: version,
    ChaveAcesso: accessKey,
    Info: { Solicitante: 'CONNECT_TELECOM' },
    Parametros: { TipoPessoa: tipoPessoa, CPFCNPJ: doc },
    WebHook: { UrlCallBack: '' },
  };

  try {
    const res = await fetchWithRetry(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { success: false, status: 'error', has_restrictions: false, restriction_count: 0, raw_summary: 'HTTP ' + res.status };
    }

    // Normaliza o resultado
    const raw = JSON.stringify(data).toLowerCase();
    let status: CreditCheckResult['status'] = 'approved';
    let hasRestrictions = false;
    let restrictionCount = 0;

    if (raw.includes('restricao') || raw.includes('negativado') || raw.includes('inadimplente')) {
      status = 'rejected';
      hasRestrictions = true;
      restrictionCount = 1;
    } else if (raw.includes('alerta') || raw.includes('atencao') || raw.includes('pendencia')) {
      status = 'approved_with_warning';
      hasRestrictions = true;
      restrictionCount = 1;
    } else if (raw.includes('analise') || raw.includes('revisao manual')) {
      status = 'manual_review';
    }

    const summary = JSON.stringify(data).slice(0, 500);

    return { success: true, status, has_restrictions: hasRestrictions, restriction_count: restrictionCount, raw_summary: summary };
  } catch (error) {
    return { success: false, status: 'error', has_restrictions: false, restriction_count: 0, raw_summary: (error as Error).message };
  }
}

// ── Decision Engine ───────────────────────────────────────────────────────
// Aplica regras administrativas configuraveis sobre o resultado da consulta.
// Nao usa o score diretamente como decisao fixa.

interface DecisionResult {
  decision: 'approved' | 'approved_with_warning' | 'manual_review' | 'rejected';
  reason: string;
}

function evaluateDecision(creditResult: CreditCheckResult, ixcRisk: string, ixcOverdueCount: number): DecisionResult {
  // Risco financeiro alto no IXC tem peso maior
  if (ixcRisk === 'alto' || ixcOverdueCount > 5) {
    return { decision: 'rejected', reason: 'Risco financeiro alto no IXC: ' + ixcOverdueCount + ' faturas vencidas' };
  }
  if (creditResult.status === 'rejected') {
    return { decision: 'rejected', reason: 'Restricoes encontradas na consulta cadastral' };
  }
  if (creditResult.status === 'error') {
    return { decision: 'manual_review', reason: 'Erro na consulta cadastral — requires analise manual' };
  }
  if (creditResult.status === 'manual_review') {
    return { decision: 'manual_review', reason: 'Resultado da consulta requer analise manual' };
  }
  // Risco medio no IXC + alerta no credito = analise manual
  if (ixcRisk === 'medio' && creditResult.status === 'approved_with_warning') {
    return { decision: 'manual_review', reason: 'Risco medio no IXC combinado com alerta cadastral' };
  }
  if (creditResult.status === 'approved_with_warning') {
    return { decision: 'approved_with_warning', reason: 'Aprovado com ressalvas — restricao leve encontrada' };
  }
  return { decision: 'approved', reason: 'Aprovado sem restricoes' };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const internalToken = secrets.get('INTERNAL_FUNCTION_TOKEN') || '';
    const internalOk = internalToken !== '' && req.headers.get('x-internal-token') === internalToken;
    if (!user && !internalOk) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── START SALE: cria uma nova venda com correlation_id ─────────────────
    if (action === 'start_sale') {
      const { customer_name, cpf_cnpj, phone, email, plan_name, monthly_fee, installation_address, city, neighborhood, reseller_id, reseller_name, vendor_name, notes, sale_type, commission_rate } = body;
      if (!customer_name || !cpf_cnpj || !phone) return Response.json({ error: 'customer_name, cpf_cnpj e phone sao obrigatorios' }, { status: 400 });

      const correlationId = generateCorrelationId();

      // Determina tipo de venda e busca dados do revendedor se aplicavel
      const isReseller = !!(reseller_id || sale_type === 'revenda');
      const finalSaleType = isReseller ? 'revenda' : 'direta';
      let finalResellerName = reseller_name || '';
      let finalCommissionRate = Number(commission_rate) || 0;

      if (isReseller && reseller_id) {
        const reseller = await base44.asServiceRole.entities.Reseller.get(reseller_id).catch(() => null);
        if (reseller) {
          finalResellerName = reseller.name;
          finalCommissionRate = finalCommissionRate || reseller.commission_rate || 0;
        }
      }

      const fee = Number(monthly_fee) || 0;
      const commissionAmount = isReseller && finalCommissionRate > 0 ? Math.round(fee * finalCommissionRate) / 100 : 0;

      const cpfCnpjClean = String(cpf_cnpj).replace(/\D/g, '');
      const cpfCnpjEncrypted = await encrypt(cpfCnpjClean);
      const cpfCnpjMasked = maskCpfCnpj(cpfCnpjClean);

      const sale = await base44.entities.Sale.create({
        correlation_id: correlationId,
        customer_name, cpf_cnpj: cpfCnpjEncrypted, cpf_cnpj_masked: cpfCnpjMasked, phone, email,
        plan_name, monthly_fee: fee, installation_address, city, neighborhood,
        reseller_id: isReseller ? reseller_id : undefined,
        reseller_name: isReseller ? finalResellerName : undefined,
        sale_type: finalSaleType,
        commission_rate: finalCommissionRate,
        commission_amount: commissionAmount,
        commission_paid: false,
        vendor_name, notes,
        stage: 'novo_lead',
        whatsapp_status: 'pending',
        credit_decision: 'pending',
        timeline: [buildTimelineEntry('novo_lead', isReseller ? 'Venda criada (Revenda: ' + finalResellerName + ')' : 'Venda criada (Direta)')],
        assigned_user_id: user?.id || undefined,
      });

      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'start_sale', status: 'sucesso', details: correlationId });
      return Response.json({ success: true, data: sale, message: 'Venda iniciada' });
    }

    // ── LIST SALES: lista vendas com filtros ──────────────────────────────
    if (action === 'list_sales') {
      const { stage, reseller_id, limit = 100 } = body;
      const filter: Record<string, unknown> = {};
      if (stage) filter.stage = stage;
      if (reseller_id) filter.reseller_id = reseller_id;
      const sales = await base44.asServiceRole.entities.Sale.filter(filter, '-created_date', Number(limit));
      const safeSales = sales.map((s: any) => ({ ...s, cpf_cnpj: s.cpf_cnpj_masked || s.cpf_cnpj }));
      return Response.json({ success: true, data: safeSales });
    }

    // ── GET SALE: detalhes completos de uma venda ──────────────────────────
    if (action === 'get_sale') {
      const { sale_id } = body;
      if (!sale_id) return Response.json({ error: 'sale_id e obrigatorio' }, { status: 400 });
      const sale = await base44.asServiceRole.entities.Sale.get(sale_id);
      if (!sale) return Response.json({ error: 'Venda nao encontrada' }, { status: 404 });
      const saleData = { ...sale, cpf_cnpj: (sale as any).cpf_cnpj_masked || (sale as any).cpf_cnpj };
      return Response.json({ success: true, data: saleData });
    }

    // ── VALIDATE DOCUMENT: valida CPF/CNPJ ─────────────────────────────────
    if (action === 'validate_document') {
      const { sale_id } = body;
      if (!sale_id) return Response.json({ error: 'sale_id e obrigatorio' }, { status: 400 });
      const sale = await base44.asServiceRole.entities.Sale.get(sale_id);
      if (!sale) return Response.json({ error: 'Venda nao encontrada' }, { status: 404 });

      const doc = (await decrypt(String(sale.cpf_cnpj))).replace(/\D/g, '');
      const isValid = doc.length === 11 || doc.length === 14;
      if (!isValid) return Response.json({ success: false, error: 'CPF/CNPJ invalido' }, { status: 400 });

      await base44.asServiceRole.entities.Sale.update(sale_id, {
        stage: 'cpf_validado',
        timeline: [...(sale.timeline || []), buildTimelineEntry('cpf_validado', 'Documento validado: ' + (doc.length === 11 ? 'PF' : 'PJ'))],
      });
      return Response.json({ success: true, message: 'Documento valido', document_type: doc.length === 11 ? 'F' : 'J' });
    }

    // ── CHECK IXC CUSTOMER: consulta IXC por CPF/CNPJ + contratos + debitos ─
    if (action === 'check_ixc_customer') {
      const { sale_id } = body;
      if (!sale_id) return Response.json({ error: 'sale_id e obrigatorio' }, { status: 400 });
      const sale = await base44.asServiceRole.entities.Sale.get(sale_id);
      if (!sale) return Response.json({ error: 'Venda nao encontrada' }, { status: 404 });

      // Chama o ixcApi existente para buscar cliente por documento
      const ixcResp = await base44.functions.invoke('ixcApi', {
        action: 'search_customer_by_document',
        cpfCnpj: await decrypt(String(sale.cpf_cnpj)),
      });
      const ixcData = ixcResp?.data || ixcResp;
      const customers = ixcData?.data || ixcData?.result?.registros || [];
      const customerExists = customers.length > 0;
      const ixcCustomer = customers[0] || null;
      const ixcCustomerId = ixcCustomer?.id || '';

      // Se cliente existe, busca contratos e risco financeiro
      let contracts: any[] = [];
      let financialRisk = 'baixo';
      let overdueCount = 0;

      if (ixcCustomerId) {
        const [contractsResp, riskResp] = await Promise.all([
          base44.functions.invoke('ixcApi', { action: 'search_contracts', clientId: ixcCustomerId }),
          base44.functions.invoke('ixcApi', { action: 'check_financial_risk', clientId: ixcCustomerId }),
        ]);
        contracts = contractsResp?.data?.data || contractsResp?.data || [];
        const riskData = riskResp?.data?.data || {};
        financialRisk = riskData.risk || 'baixo';
        overdueCount = riskData.overdue_count || 0;
      }

      await base44.asServiceRole.entities.Sale.update(sale_id, {
        stage: 'ixc_consultado',
        ixc_customer_id: ixcCustomerId || undefined,
        ixc_customer_exists: customerExists,
        ixc_financial_risk: financialRisk,
        ixc_overdue_count: overdueCount,
        timeline: [...(sale.timeline || []), buildTimelineEntry('ixc_consultado', customerExists ? 'Cliente encontrado no IXC (' + contracts.length + ' contrato(s))' : 'Cliente nao encontrado no IXC')],
      });

      return Response.json({
        success: true,
        customer_exists: customerExists,
        ixc_customer_id: ixcCustomerId,
        contracts_count: contracts.length,
        contracts,
        financial_risk: financialRisk,
        overdue_count: overdueCount,
      });
    }

    // ── RUN CREDIT CHECK: consulta cadastral via provider abstrato ─────────
    if (action === 'run_credit_check') {
      const { sale_id, lgpd_consent = true } = body;
      if (!sale_id) return Response.json({ error: 'sale_id e obrigatorio' }, { status: 400 });
      const sale = await base44.asServiceRole.entities.Sale.get(sale_id);
      if (!sale) return Response.json({ error: 'Venda nao encontrada' }, { status: 404 });

      const decryptedCpf = await decrypt(String(sale.cpf_cnpj));
      const creditResult = await runCreditCheck(decryptedCpf, sale_id, sale.correlation_id, user?.id || '', user?.full_name || 'Sistema');

      // Cria CreditCheckLog (LGPD)
      const creditLog = await base44.asServiceRole.entities.CreditCheckLog.create({
        sale_id,
        correlation_id: sale.correlation_id,
        cpf_cnpj_masked: (sale as any).cpf_cnpj_masked || maskDocument(decryptedCpf),
        customer_name: sale.customer_name,
        provider: 'validocadastro',
        tipo_pessoa: decryptedCpf.replace(/\D/g, '').length > 11 ? 'J' : 'F',
        result_status: creditResult.status,
        decision: creditResult.status === 'error' ? 'manual_review' : creditResult.status,
        decision_reason: creditResult.raw_summary.slice(0, 200),
        has_restrictions: creditResult.has_restrictions,
        restriction_count: creditResult.restriction_count,
        performed_by_user_id: user?.id || '',
        performed_by_name: user?.full_name || 'Sistema',
        performed_at: new Date().toISOString(),
        lgpd_consent,
        purpose: 'avaliacao_credito_venda',
        response_summary: creditResult.raw_summary,
      });

      await base44.asServiceRole.entities.Sale.update(sale_id, {
        stage: 'consulta_credito',
        credit_check_id: creditLog.id,
        credit_decision: creditResult.status === 'error' ? 'manual_review' : creditResult.status,
        credit_reason: creditResult.raw_summary.slice(0, 200),
        timeline: [...(sale.timeline || []), buildTimelineEntry('consulta_credito', 'Consulta cadastral realizada: ' + creditResult.status)],
      });

      return Response.json({
        success: creditResult.success,
        status: creditResult.status,
        has_restrictions: creditResult.has_restrictions,
        credit_check_id: creditLog.id,
      });
    }

    // ── MAKE DECISION: motor de decisao baseado em credito + IXC ────────────
    if (action === 'make_decision') {
      const { sale_id } = body;
      if (!sale_id) return Response.json({ error: 'sale_id e obrigatorio' }, { status: 400 });
      const sale = await base44.asServiceRole.entities.Sale.get(sale_id);
      if (!sale) return Response.json({ error: 'Venda nao encontrada' }, { status: 404 });

      const creditStatus = (sale.credit_decision || 'pending') as CreditCheckResult['status'];
      const decision = evaluateDecision(
        { success: true, status: creditStatus, has_restrictions: false, restriction_count: 0, raw_summary: sale.credit_reason || '' },
        sale.ixc_financial_risk || 'baixo',
        sale.ixc_overdue_count || 0
      );

      const newStage = decision.decision === 'approved' || decision.decision === 'approved_with_warning' ? 'aprovado' : decision.decision === 'rejected' ? 'reprovado' : 'analise_manual';

      await base44.asServiceRole.entities.Sale.update(sale_id, {
        stage: newStage,
        decision_reason: decision.reason,
        timeline: [...(sale.timeline || []), buildTimelineEntry(newStage, 'Decisao: ' + decision.decision + ' — ' + decision.reason)],
      });

      return Response.json({ success: true, decision: decision.decision, reason: decision.reason, stage: newStage });
    }

    // ── CREATE IXC CONTRACT: cria cliente + contrato no IXC ────────────────
    if (action === 'create_ixc_contract') {
      const { sale_id, plan_id, plan_name, monthly_fee } = body;
      if (!sale_id) return Response.json({ error: 'sale_id e obrigatorio' }, { status: 400 });
      const sale = await base44.asServiceRole.entities.Sale.get(sale_id);
      if (!sale) return Response.json({ error: 'Venda nao encontrada' }, { status: 404 });

      let ixcCustomerId = sale.ixc_customer_id;

      // Se cliente nao existe no IXC, cria
      if (!ixcCustomerId) {
        // Descriptografa o CPF/CNPJ antes de enviar ao IXC (era enviado cifrado — bug corrigido)
        const decryptedCpf = await decrypt(String(sale.cpf_cnpj));
        const createResp = await base44.functions.invoke('ixcApi', {
          action: 'create_customer',
          data: {
            razao: sale.customer_name,
            cnpj_cpf: decryptedCpf.replace(/\D/g, ''),
            telefone_celular: sale.phone,
            email: sale.email || '',
            endereco: sale.installation_address || '',
            bairro: sale.neighborhood || '',
            ativo: 'S',
          },
        });
        ixcCustomerId = createResp?.data?.data?.id || createResp?.data?.id || '';
        if (!ixcCustomerId) return Response.json({ success: false, error: 'Falha ao criar cliente no IXC' }, { status: 500 });
      }

      // Cria contrato
      const contractResp = await base44.functions.invoke('ixcApi', {
        action: 'create_contract',
        data: {
          id_cliente: ixcCustomerId,
          id_plano: plan_id || sale.plan_id || '',
          descricao_plano: plan_name || sale.plan_name || '',
          valor_mensalidade: monthly_fee || sale.monthly_fee || 0,
          endereco: sale.installation_address || '',
          bairro: sale.neighborhood || '',
          status: 'A',
          data_ativacao: new Date().toISOString().slice(0, 10),
        },
      });
      const ixcContractId = contractResp?.data?.data?.id || contractResp?.data?.id || '';

      await base44.asServiceRole.entities.Sale.update(sale_id, {
        stage: 'contrato_gerado',
        ixc_customer_id: ixcCustomerId,
        ixc_contract_id: ixcContractId,
        plan_name: plan_name || sale.plan_name,
        plan_id: plan_id || sale.plan_id,
        monthly_fee: monthly_fee || sale.monthly_fee,
        timeline: [...(sale.timeline || []), buildTimelineEntry('contrato_gerado', 'Cliente/contrato criado no IXC: cliente #' + ixcCustomerId + ', contrato #' + ixcContractId)],
      });

      return Response.json({ success: true, ixc_customer_id: ixcCustomerId, ixc_contract_id: ixcContractId });
    }

    // ── SEND FOR SIGNATURE: cria doc ZapSign + envia WhatsApp ──────────────
    if (action === 'send_for_signature') {
      const { sale_id, template_id } = body;
      if (!sale_id) return Response.json({ error: 'sale_id e obrigatorio' }, { status: 400 });
      const sale = await base44.asServiceRole.entities.Sale.get(sale_id);
      if (!sale) return Response.json({ error: 'Venda nao encontrada' }, { status: 404 });
      if (!sale.ixc_customer_id) return Response.json({ error: 'Venda sem ixc_customer_id — crie o contrato no IXC primeiro' }, { status: 400 });

      // Seleciona template: explicito ou o mais utilizado (fallback automatico)
      let templateId = template_id;
      if (!templateId) {
        const allTemplates = await base44.asServiceRole.entities.ContractTemplate.filter({ active: true });
        const top = (allTemplates || []).sort((a: { usage_count?: number }, b: { usage_count?: number }) => (b.usage_count || 0) - (a.usage_count || 0))[0];
        if (!top) return Response.json({ success: false, error: 'Nenhum template ativo encontrado' }, { status: 400 });
        templateId = top.id;
      }

      // Cria documento ZapSign via zapsignApi (ja envia WhatsApp internamente)
      const zapsignResp = await base44.functions.invoke('zapsignApi', {
        action: 'create_from_ixc',
        ixcCustomerId: sale.ixc_customer_id,
        ixcContractId: sale.ixc_contract_id,
        templateId,
        sendWhatsApp: true,
      });
      const zapsignData = zapsignResp?.data?.data || zapsignResp?.data || {};
      const docToken = zapsignData.zapsign_doc_token || zapsignData.token || '';
      const signUrl = zapsignData.sign_url || (zapsignData.open_id ? 'https://app.zapsign.com.br/sign/' + zapsignData.open_id : '');
      const whatsappSent = !!zapsignData.whatsapp_sent;

      if (!docToken) return Response.json({ success: false, error: 'Falha ao criar documento ZapSign' }, { status: 500 });

      await base44.asServiceRole.entities.Sale.update(sale_id, {
        stage: 'assinatura_enviada',
        signature_request_id: zapsignData.id || undefined,
        zapsign_doc_token: docToken,
        sign_url: signUrl,
        whatsapp_sent: whatsappSent,
        whatsapp_status: whatsappSent ? 'sent' : 'failed',
        timeline: [...(sale.timeline || []), buildTimelineEntry('assinatura_enviada', 'Documento ZapSign criado' + (whatsappSent ? ' e enviado via WhatsApp' : ' (WhatsApp falhou)'))],
      });

      return Response.json({
        success: true,
        zapsign_doc_token: docToken,
        sign_url: signUrl,
        whatsapp_sent: whatsappSent,
        whatsapp_status: whatsappSent ? 'sent' : 'failed',
      });
    }

    // ── UPDATE SALE STAGE: atualiza etapa manualmente ──────────────────────
    if (action === 'update_sale_stage') {
      const { sale_id, stage, notes } = body;
      if (!sale_id || !stage) return Response.json({ error: 'sale_id e stage sao obrigatorios' }, { status: 400 });
      const sale = await base44.asServiceRole.entities.Sale.get(sale_id);
      if (!sale) return Response.json({ error: 'Venda nao encontrada' }, { status: 404 });

      // Recalcula comissao se mensalidade mudou
      let updateData: Record<string, unknown> = { stage };
      if (notes) updateData.notes = notes;
      if (sale.sale_type === 'revenda' && sale.commission_rate > 0 && sale.monthly_fee) {
        updateData.commission_amount = Math.round(sale.monthly_fee * sale.commission_rate) / 100;
      }

      await base44.asServiceRole.entities.Sale.update(sale_id, {
        ...updateData,
        timeline: [...(sale.timeline || []), buildTimelineEntry(stage, 'Etapa atualizada manualmente')],
      });
      return Response.json({ success: true, message: 'Etapa atualizada' });
    }

    // ── MARK COMMISSION PAID: marca comissao como paga ─────────────────────
    if (action === 'mark_commission_paid') {
      const { sale_id, paid = true } = body;
      if (!sale_id) return Response.json({ error: 'sale_id e obrigatorio' }, { status: 400 });
      const sale = await base44.asServiceRole.entities.Sale.get(sale_id);
      if (!sale) return Response.json({ error: 'Venda nao encontrada' }, { status: 404 });
      if (sale.sale_type !== 'revenda') return Response.json({ error: 'Venda nao e do tipo revenda' }, { status: 400 });

      await base44.asServiceRole.entities.Sale.update(sale_id, {
        commission_paid: paid,
        timeline: [...(sale.timeline || []), buildTimelineEntry(sale.stage, paid ? 'Comissao marcada como paga' : 'Comissao marcada como pendente')],
      });

      // Atualiza totais do revendedor
      if (sale.reseller_id) {
        const allSales = await base44.asServiceRole.entities.Sale.filter({ reseller_id: sale.reseller_id }, '-created_date', 500);
        const totalCommission = allSales.filter(s => s.commission_paid).reduce((sum, s) => sum + (s.commission_amount || 0), 0);
        await base44.asServiceRole.entities.Reseller.update(sale.reseller_id, {
          total_sales: allSales.length,
          total_commission: totalCommission,
        });
      }

      return Response.json({ success: true, message: paid ? 'Comissao marcada como paga' : 'Comissao marcada como pendente' });
    }

    // ── HEALTH CHECK: verifica todas as integracoes ────────────────────────
    if (action === 'health_check') {
      const results: Record<string, any> = {};

      // IXC — teste de conectividade real
      try {
        const ixcResp = await base44.functions.invoke('ixcApi', { action: 'test_connection' });
        const ixcData = ixcResp?.data || ixcResp;
        results.ixc = { configured: true, status: ixcData.success ? 'ONLINE' : 'OFFLINE', response_ms: ixcData.response_ms, message: ixcData.message || ixcData.error || '' };
      } catch (e) {
        results.ixc = { configured: false, status: 'OFFLINE', error: (e as Error).message };
      }

      // Evolution — teste de conectividade real
      try {
        const evoResp = await base44.functions.invoke('evolutionApi', { action: 'server_health' });
        const evoData = evoResp?.data || evoResp;
        results.evolution = { configured: true, status: evoData.success ? 'ONLINE' : 'OFFLINE', instance: secrets.get('EVOLUTION_INSTANCE_NAME') || '' };
      } catch (e) {
        results.evolution = { configured: false, status: 'OFFLINE', error: (e as Error).message };
      }

      // Credit Provider — verifica se credenciais existem (não testa API para não consumir créditos)
      const creditUrl = secrets.get('CREDIT_API_URL') || '';
      const creditKey = secrets.get('CREDIT_ACCESS_KEY') || '';
      results.credit_provider = { configured: !!(creditUrl && creditKey), url: creditUrl, product: secrets.get('CREDIT_PRODUCT_CODE') || '', status: creditUrl && creditKey ? 'CONFIGURED' : 'OFFLINE' };

      // ZapSign — teste de conectividade real (GET /users/me)
      try {
        const zsToken = secrets.get('ZAPSIGN_API_TOKEN') || '';
        if (!zsToken) {
          results.zapsign = { configured: false, status: 'OFFLINE' };
        } else {
          const zsRes = await fetchWithRetry('https://api.zapsign.com.br/api/v1/users/me', {
            headers: { Authorization: `Bearer ${zsToken}` },
          });
          results.zapsign = { configured: true, status: zsRes.ok ? 'ONLINE' : 'OFFLINE', http_status: zsRes.status };
        }
      } catch (e) {
        results.zapsign = { configured: false, status: 'OFFLINE', error: (e as Error).message };
      }

      return Response.json({ success: true, data: results });
    }

    // ── TEST IXC: teste de conectividade real (somente leitura) ────────────
    if (action === 'test_ixc') {
      const ixcResp = await base44.functions.invoke('ixcApi', { action: 'test_connection' });
      const data = ixcResp?.data || ixcResp;
      return Response.json({ success: data.success, response_ms: data.response_ms, message: data.message || data.error });
    }

    return Response.json({ error: 'Action nao reconhecida: ' + action }, { status: 400 });
  } catch (error) {
    const base44 = createClientFromRequest(req);
    await logError(base44, 'salesPipelineApi', error, { action: body?.action || 'unknown', severity: 'alta' });
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}