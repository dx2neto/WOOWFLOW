import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { logError } from '../../shared/errorLogger.ts';

// ═══════════════════════════════════════════════════════════════════════════
// SEND CLOSING SUMMARY TO CRM
// Quando uma conversa é encerrada no Inbox, a Lara gera automaticamente um
// resumo do atendimento com os dados da Visão 360 do cliente e envia para o CRM.
//
// Fluxo:
// 1. Busca mensagens recentes da conversa encerrada
// 2. Busca dados 360 do cliente no IXCSoft (contratos, financeiro, tickets, sinal)
// 3. Gera resumo consolidado via LLM com histórico + dados 360
// 4. Cria ou atualiza um Lead no CRM com o resumo em notes
// ═══════════════════════════════════════════════════════════════════════════

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const internalToken = Deno.env.get('INTERNAL_FUNCTION_TOKEN') || '';
    const internalOk = internalToken !== '' && req.headers.get('x-internal-token') === internalToken;
    if (!user && !internalOk) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const {
      conversation_id,
      phone,
      customer_name,
      attendant_note = '',
      finalize_note = '',
    } = body;

    if (!conversation_id) return Response.json({ success: false, error: 'conversation_id é obrigatório' }, { status: 400 });

    // ── 1. Buscar mensagens recentes da conversa ──────────────────────────────
    const messages = await base44.asServiceRole.entities.Message.filter(
      { conversation_id },
      'timestamp',
      100
    ).catch(() => []);

    const conversationHistory = (messages as any[])
      .filter((m) => m.direction === 'in' || m.direction === 'out' || m.direction === 'ai')
      .slice(-50)
      .map((m) => {
        const who = m.direction === 'in' ? 'Cliente' : m.direction === 'ai' ? 'Lara IA' : 'Atendente';
        return `${who}: ${m.content}`;
      }).join('\n');

    // ── 2. Buscar dados 360 do cliente no IXC ─────────────────────────────────
    let customer360: any = null;
    const rawPhone = String(phone || '').replace(/\D/g, '');
    if (rawPhone.length >= 8) {
      try {
        const preResp = await base44.asServiceRole.functions.invoke('ixcApi', { action: 'pre_analise', search: rawPhone });
        const pre = preResp?.data?.data || preResp?.data || preResp;
        if (pre?.found) {
          const clienteCpf = pre.cliente?.cpf_cnpj ? String(pre.cliente.cpf_cnpj).replace(/\D/g, '') : '';
          if (clienteCpf.length >= 11) {
            try {
              const resp360 = await base44.asServiceRole.functions.invoke('ixcApi', { action: 'customer_360', cpfCnpj: clienteCpf });
              const d360 = resp360?.data?.data || resp360?.data || resp360;
              if (d360?.found) customer360 = d360;
            } catch { customer360 = pre; }
          } else {
            customer360 = pre;
          }
        }
      } catch { /* cliente não encontrado no IXC */ }
    }

    // ── 3. Construir contexto 360 para o prompt ───────────────────────────────
    let context360 = 'Cliente não identificado na base IXC.';
    if (customer360) {
      const c = customer360.cliente || {};
      const contratos = customer360.contratos || [];
      const faturas = customer360.faturas || {};
      const tickets = customer360.tickets || [];
      const summary = customer360.summary || {};

      context360 = [
        `CLIENTE: ${c.name || customer_name || 'N/A'} (ID: ${c.id || 'N/A'})`,
        `CPF/CNPJ: ${c.cpf_cnpj || 'N/A'}`,
        `Telefone: ${c.phone || phone || 'N/A'}`,
        `Cidade: ${c.city || 'N/A'}`,
        `Status: ${c.is_active ? 'Ativo' : 'Inativo'}`,
        '',
        'FINANCEIRO:',
        `- Faturas em aberto: ${faturas.abertas || 0}`,
        `- Faturas vencidas: ${faturas.vencidas || 0}`,
        `- Total devido: R$ ${(faturas.total_devido || 0).toFixed(2)}`,
        `- Risco financeiro: ${faturas.risk || 'N/A'}`,
        '',
        'CONTRATOS:',
        contratos.length > 0
          ? contratos.map((ct: any, i: number) => `  #${i + 1}: ${ct.plan_name || 'N/A'} | ${ct.status} | ${ct.internet_status || 'N/A'}${ct.download ? ` | ↓${ct.download}↑${ct.upload || 'N/A'} Mbps` : ''}${ct.monthly_fee ? ` | R$ ${ct.monthly_fee}/mês` : ''}`).join('\n')
          : '  Nenhum contrato encontrado.',
        '',
        `Tickets: ${summary.tickets_count || tickets.length || 0} (abertos: ${summary.overdue_count || 0})`,
      ].join('\n');
    }

    // ── 4. Gerar resumo via LLM ───────────────────────────────────────────────
    const closingNote = attendant_note || finalize_note || '';
    const summaryPrompt = [
      'Você é a Lara, assistente virtual de um provedor de internet.',
      'Gere um resumo de encerramento de atendimento para o CRM.',
      '',
      'Dados da Visão 360 do cliente:',
      context360,
      '',
      'Histórico da conversa:',
      conversationHistory || 'Sem histórico disponível.',
      '',
      closingNote ? `Nota do atendente: ${closingNote}` : '',
      '',
      'Gere um resumo estruturado contendo:',
      '1. Resumo do atendimento (o que foi solicitado e resolvido)',
      '2. Dados do cliente (nome, plano, status)',
      '3. Situação financeira (faturas, débitos, risco)',
      '4. Próximos passos / follow-up necessário',
      '',
      'Responda em JSON:',
      '{',
      '  "summary": "texto do resumo estruturado",',
      '  "needs_followup": true|false,',
      '  "followup_reason": "motivo do follow-up se aplicável",',
      '  "lead_stage": "novo_lead|primeiro_contato|qualificacao|proposta_enviada|aguardando_retorno|agendamento|preparar_contrato|venda_fechada|venda_perdida"',
      '}',
    ].join('\n');

    const llmResult = await base44.integrations.Core.InvokeLLM({
      prompt: summaryPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          needs_followup: { type: 'boolean' },
          followup_reason: { type: 'string' },
          lead_stage: { type: 'string' },
        },
      },
    });

    // ── 5. Criar ou atualizar Lead no CRM ─────────────────────────────────────
    const now = new Date().toISOString();
    const leadName = customer360?.cliente?.name || customer_name || 'Cliente';
    const leadPhone = customer360?.cliente?.phone || phone || '';
    const leadCity = customer360?.cliente?.city || '';
    const leadEmail = customer360?.cliente?.email || '';

    // Busca Lead existente pelo telefone
    const existingLeads = await base44.asServiceRole.entities.Lead.filter(
      { phone: leadPhone },
      '-updated_date',
      5
    ).catch(() => []);

    const crmSummary = [
      `═══ RESUMO DE ENCERRAMENTO — LARA IA ═══`,
      `Data: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
      closingNote ? `Nota do atendente: ${closingNote}` : '',
      '',
      llmResult.summary || 'Resumo não disponível.',
      '',
      llmResult.needs_followup ? `⚠️ FOLLOW-UP NECESSÁRIO: ${llmResult.followup_reason || 'Não especificado'}` : '✅ Atendimento concluído sem follow-up.',
      '',
      `Próxima etapa sugerida: ${llmResult.lead_stage || 'novo_lead'}`,
      `═══ FIM DO RESUMO ═══`,
    ].filter(Boolean).join('\n');

    let lead;
    if (existingLeads && (existingLeads as any[]).length > 0) {
      // Atualiza Lead existente
      lead = (existingLeads as any[])[0];
      const existingNotes = lead.notes ? `${lead.notes}\n\n---\n\n` : '';
      await base44.asServiceRole.entities.Lead.update(lead.id, {
        notes: existingNotes + crmSummary,
        stage: llmResult.lead_stage || lead.stage,
        ...(llmResult.needs_followup ? { next_contact: new Date(Date.now() + 86400000).toISOString().slice(0, 10) } : {}),
      }).catch(() => {});
    } else {
      // Cria novo Lead
      lead = await base44.asServiceRole.entities.Lead.create({
        name: leadName,
        phone: leadPhone,
        email: leadEmail || undefined,
        city: leadCity,
        origin: 'whatsapp',
        stage: llmResult.lead_stage || 'novo_lead',
        notes: crmSummary,
        ...(llmResult.needs_followup ? { next_contact: new Date(Date.now() + 86400000).toISOString().slice(0, 10) } : {}),
        assigned_user_id: user?.id || null,
      }).catch(() => null);
    }

    // ── 6. Adicionar mensagem de sistema na conversa ─────────────────────────
    await base44.asServiceRole.entities.Message.create({
      conversation_id,
      content: `[CRM] Resumo de encerramento enviado para o CRM.\n${llmResult.needs_followup ? `⚠️ Follow-up necessário: ${llmResult.followup_reason || ''}` : '✅ Atendimento concluído.'}`,
      direction: 'system',
      type: 'system',
      timestamp: now,
      sender_name: 'Lara IA',
    }).catch(() => {});

    // ── 7. Log de integração ─────────────────────────────────────────────────
    await base44.asServiceRole.entities.IntegrationLog.create({
      integration: 'crmApi',
      action: 'closing_summary_sent',
      status: 'sucesso',
      details: `Conversa: ${conversation_id} | Cliente: ${leadName} | Lead: ${lead?.id || 'N/A'} | Follow-up: ${llmResult.needs_followup ? 'sim' : 'não'}`,
    }).catch(() => {});

    return Response.json({
      success: true,
      lead_id: lead?.id || null,
      summary: llmResult.summary,
      needs_followup: llmResult.needs_followup || false,
      followup_reason: llmResult.followup_reason || null,
      lead_stage: llmResult.lead_stage || 'novo_lead',
    });
  } catch (error) {
    const base44 = createClientFromRequest(req);
    await logError(base44, 'sendClosingSummaryToCrm', error, { action: 'closing_summary', severity: 'media' });
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}