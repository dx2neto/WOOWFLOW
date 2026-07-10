import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Não autenticado' } }, { status: 401 });

    const ixcBaseUrl    = Deno.env.get('IXC_API_URL');
    const ixcToken      = Deno.env.get('IXC_API_TOKEN');
    const evoBaseUrl    = Deno.env.get('EVOLUTION_API_URL') || '';
    const evoKey        = Deno.env.get('EVOLUTION_API_KEY') || '';
    const evoDefaultInst = Deno.env.get('EVOLUTION_INSTANCE_NAME') || '';
    const zapToken      = Deno.env.get('ZAPSIGN_API_TOKEN');

    const body = await req.json().catch(() => ({}));
    const {
      action,
      customerId,
      cpfCnpj,
      phone,
      contractId,
      conversationId,
      agreementId,
      data: payload,
      instance,
    } = body;

    // ── guards de configuração ────────────────────────────────────────────────
    // ZapSign: só valida na hora de usar (generate_zapsign)
    // IXC: valida na hora de usar (verify/check)
    // Evolution Go: URL e key obrigatórias via env (validadas em send_reminder)

    // ── helpers ──────────────────────────────────────────────────────────────
    const ok = (data: any, msg = 'OK') => Response.json({ success: true, data, message: msg });
    const fail = (code: string, msg: string, status = 400) =>
      Response.json({ success: false, error: { code, message: msg } }, { status });

    const ixcPost = async (endpoint: string, bodyObj: Record<string, string>) => {
      if (!ixcBaseUrl || !ixcToken) return { ok: false, data: { error: 'IXC não configurado' } };
      const url = ixcBaseUrl.replace(/\/$/, '') + '/' + endpoint.replace(/^\//, '');
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Basic ${ixcToken}`, ixcsoft: 'listar' },
          body: JSON.stringify(bodyObj),
          signal: AbortSignal.timeout(25_000),
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, data };
      } catch (e) {
        return { ok: false, data: { error: e.message } };
      }
    };

    const ixcFetchAll = async (endpoint: string, baseBody: Record<string, string>, max = 500) => {
      const all: any[] = [];
      let page = 1;
      let total = Infinity;
      while (all.length < total && all.length < max) {
        const { ok: isOk, data } = await ixcPost(endpoint, { ...baseBody, page: String(page), rp: '100' });
        if (!isOk) break;
        const regs = data.registros || [];
        all.push(...regs);
        total = parseInt(data.total || '0', 10) || all.length;
        if (regs.length === 0) break;
        page++;
      }
      return all;
    };

    // Classificar status do acordo baseado nos títulos IXC
    const classifyAgreementStatus = (
      faturas: any[],
      toleranceDays: number,
      brokenDays: number
    ): { status: string; overdueCount: number; paidCount: number; openCount: number } => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let overdueCount = 0;
      let paidCount = 0;
      let openCount = 0;
      let maxOverdueDays = 0;

      for (const f of faturas) {
        if (f.status === 'P') { paidCount++; continue; }
        const due = f.data_vencimento ? new Date(f.data_vencimento) : null;
        if (!due) { openCount++; continue; }
        const diffMs  = today.getTime() - due.getTime();
        const diffDays = Math.floor(diffMs / 86_400_000);
        if (diffDays > 0) {
          overdueCount++;
          if (diffDays > maxOverdueDays) maxOverdueDays = diffDays;
        } else {
          openCount++;
        }
      }

      if (faturas.length === 0) return { status: 'none', overdueCount: 0, paidCount: 0, openCount: 0 };
      if (paidCount === faturas.length) return { status: 'paid', overdueCount: 0, paidCount, openCount };
      if (overdueCount === 0) return { status: 'active', overdueCount: 0, paidCount, openCount };
      if (maxOverdueDays > brokenDays) return { status: 'broken', overdueCount, paidCount, openCount };
      if (maxOverdueDays > toleranceDays) return { status: 'overdue', overdueCount, paidCount, openCount };
      return { status: 'active', overdueCount, paidCount, openCount };
    };

    const determineRecommendedAction = (status: string, zapsignStatus: string): string => {
      if (status === 'none') return 'none';
      if (zapsignStatus === 'pending') return 'send_zapsign';
      if (status === 'active') return 'send_reminder';
      if (status === 'overdue') return 'request_payment';
      if (status === 'broken') return 'renegotiate';
      if (status === 'paid') return 'none';
      return 'none';
    };

    // Buscar configurações
    const getSettings = async () => {
      try {
        const settings = await base44.asServiceRole.entities.AgreementSettings.list('-created_date', 1);
        return settings[0] || {
          tolerance_days_overdue: 5,
          days_to_mark_broken: 15,
          require_zapsign: false,
          require_serasa: false,
          send_whatsapp_reminder: true,
          auto_message_active: 'Olá, {nome}. Verificamos que você possui um acordo ativo conosco.\n\nPróxima parcela:\nValor: R$ {valor}\nVencimento: {vencimento}\n\nPara evitar bloqueio ou quebra do acordo, mantenha o pagamento em dia.',
          auto_message_overdue: 'Olá, {nome}. Identificamos que existe uma parcela do seu acordo em atraso.\n\nValor: R$ {valor}\nVencimento: {vencimento}\n\nRegularize o quanto antes para evitar a quebra do acordo.',
          auto_message_broken: 'Olá, {nome}. Seu acordo consta como quebrado devido ao atraso das parcelas.\n\nPodemos te ajudar com uma nova renegociação. Deseja falar com o setor financeiro?',
        };
      } catch {
        return { tolerance_days_overdue: 5, days_to_mark_broken: 15, require_zapsign: false };
      }
    };

    // ── BUSCAR CLIENTE NO IXC (por CPF, telefone ou ID) ─────────────────────
    const findIxcCustomer = async (opts: { cpfCnpj?: string; phone?: string; clientId?: string; contractId?: string }) => {
      if (!ixcBaseUrl || !ixcToken) return null;
      let qtype = 'cliente.id'; let query = '1'; let oper = '>=';

      if (opts.clientId) { qtype = 'cliente.id'; query = String(opts.clientId); oper = '='; }
      else if (opts.cpfCnpj) { qtype = 'cliente.cnpj_cpf'; query = opts.cpfCnpj.replace(/\D/g, ''); oper = '='; }
      else if (opts.phone) {
        const digits = opts.phone.replace(/\D/g, '').slice(-8);
        const { ok, data } = await ixcPost('cliente', { qtype: 'cliente.telefone_celular', query: digits, oper: 'L', page: '1', rp: '1' });
        if (ok && data.registros?.length > 0) return data.registros[0];
        const { ok: ok2, data: data2 } = await ixcPost('cliente', { qtype: 'cliente.fone', query: digits, oper: 'L', page: '1', rp: '1' });
        if (ok2 && data2.registros?.length > 0) return data2.registros[0];
        return null;
      } else if (opts.contractId) {
        // buscar cliente pelo contrato
        const { ok, data } = await ixcPost('cliente_contrato', { qtype: 'cliente_contrato.id', query: String(opts.contractId), oper: '=', page: '1', rp: '1' });
        if (ok && data.registros?.length > 0) {
          const clientId = data.registros[0].id_cliente;
          const { ok: ok2, data: data2 } = await ixcPost('cliente', { qtype: 'cliente.id', query: String(clientId), oper: '=', page: '1', rp: '1' });
          if (ok2 && data2.registros?.length > 0) return data2.registros[0];
        }
        return null;
      }

      const { ok, data } = await ixcPost('cliente', { qtype, query, oper, page: '1', rp: '1' });
      if (ok && data.registros?.length > 0) return data.registros[0];
      return null;
    };

    // Normalizar cliente IXC
    const normalizeCustomer = (raw: any) => ({
      id: raw?.id || '',
      name: raw?.razao || raw?.fantasia || `Cliente #${raw?.id}`,
      cpf_cnpj: raw?.cnpj_cpf || '',
      phone: raw?.telefone_celular || raw?.fone || '',
      email: raw?.email || '',
      city: raw?.cidade_nome || '',
      active: raw?.ativo === 'S',
    });

    // ── GET SETTINGS ─────────────────────────────────────────────────────────
    if (action === 'get_settings') {
      const settings = await getSettings();
      return ok(settings);
    }

    // ── SAVE SETTINGS ────────────────────────────────────────────────────────
    if (action === 'save_settings') {
      if (!payload) return fail('MISSING_DATA', 'Dados das configurações são obrigatórios');
      try {
        const existing = await base44.asServiceRole.entities.AgreementSettings.list('-created_date', 1);
        let saved;
        if (existing.length > 0) {
          saved = await base44.asServiceRole.entities.AgreementSettings.update(existing[0].id, payload);
        } else {
          saved = await base44.asServiceRole.entities.AgreementSettings.create({ ...payload, singleton_key: 'global' });
        }
        return ok(saved, 'Configurações salvas com sucesso');
      } catch (e) {
        return fail('SAVE_ERROR', `Erro ao salvar configurações: ${e.message}`, 500);
      }
    }

    // ── LIST AGREEMENTS ───────────────────────────────────────────────────────
    if (action === 'list_agreements') {
      try {
        const agreements = await base44.asServiceRole.entities.Agreement.list('-created_date', 200);
        return ok(agreements);
      } catch (e) {
        return fail('LIST_ERROR', `Erro ao listar acordos: ${e.message}`, 500);
      }
    }

    // ── GET AGREEMENT ────────────────────────────────────────────────────────
    if (action === 'get_agreement') {
      if (!agreementId) return fail('MISSING_ID', 'agreementId é obrigatório');
      try {
        const agreement = await base44.asServiceRole.entities.Agreement.get(agreementId);
        if (!agreement) return fail('NOT_FOUND', 'Acordo não encontrado', 404);
        const installments = await base44.asServiceRole.entities.AgreementInstallment.filter({ agreement_id: agreementId }, 'installment_number');
        const logs = await base44.asServiceRole.entities.AgreementVerificationLog.filter({ customer_id: agreement.customer_id || '' }, '-created_date');
        return ok({ agreement, installments, logs: logs.slice(0, 20) });
      } catch (e) {
        return fail('GET_ERROR', `Erro ao buscar acordo: ${e.message}`, 500);
      }
    }

    // ── CREATE AGREEMENT ──────────────────────────────────────────────────────
    if (action === 'create_agreement') {
      if (!payload) return fail('MISSING_DATA', 'Dados do acordo são obrigatórios');
      try {
        const settings = await getSettings();
        if (settings.require_zapsign && !payload.zapsign_document_id) {
          payload.status = 'pending_signature';
        }
        const agreement = await base44.asServiceRole.entities.Agreement.create({
          ...payload,
          created_by: user.email || user.id,
        });

        // Criar parcelas se informado
        if (payload.installments > 1 && payload.next_due_date) {
          const startDate = new Date(payload.next_due_date);
          const installmentAmount = payload.negotiated_amount / payload.installments;
          const installmentData = Array.from({ length: payload.installments }, (_, i) => {
            const due = new Date(startDate);
            due.setMonth(due.getMonth() + i);
            return {
              agreement_id: agreement.id,
              installment_number: i + 1,
              amount: Math.round(installmentAmount * 100) / 100,
              due_date: due.toISOString().slice(0, 10),
              status: 'pending',
            };
          });
          await Promise.all(installmentData.map(inst => base44.asServiceRole.entities.AgreementInstallment.create(inst)));
        }

        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'agreementApi', action: 'create_agreement', status: 'sucesso', details: `Acordo ${agreement.id} criado por ${user.email}` });
        return ok(agreement, 'Acordo criado com sucesso');
      } catch (e) {
        return fail('CREATE_ERROR', `Erro ao criar acordo: ${e.message}`, 500);
      }
    }

    // ── UPDATE AGREEMENT ──────────────────────────────────────────────────────
    if (action === 'update_agreement') {
      if (!agreementId || !payload) return fail('MISSING_DATA', 'agreementId e dados são obrigatórios');
      try {
        const updated = await base44.asServiceRole.entities.Agreement.update(agreementId, payload);
        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'agreementApi', action: 'update_agreement', status: 'sucesso', details: `Acordo ${agreementId} atualizado` });
        return ok(updated, 'Acordo atualizado com sucesso');
      } catch (e) {
        return fail('UPDATE_ERROR', `Erro ao atualizar acordo: ${e.message}`, 500);
      }
    }

    // ── MARK BROKEN ───────────────────────────────────────────────────────────
    if (action === 'mark_broken') {
      if (!agreementId) return fail('MISSING_ID', 'agreementId é obrigatório');
      try {
        const updated = await base44.asServiceRole.entities.Agreement.update(agreementId, {
          status: 'broken',
          recommended_action: 'renegotiate',
        });
        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'agreementApi', action: 'mark_broken', status: 'sucesso', details: `Acordo ${agreementId} marcado como quebrado por ${user.email}` });
        return ok(updated, 'Acordo marcado como quebrado');
      } catch (e) {
        return fail('MARK_ERROR', `Erro ao marcar acordo: ${e.message}`, 500);
      }
    }

    // ── MARK PAID ─────────────────────────────────────────────────────────────
    if (action === 'mark_paid') {
      if (!agreementId) return fail('MISSING_ID', 'agreementId é obrigatório');
      try {
        const agreement = await base44.asServiceRole.entities.Agreement.get(agreementId);
        const updated = await base44.asServiceRole.entities.Agreement.update(agreementId, {
          status: 'paid',
          paid_amount: agreement?.negotiated_amount || 0,
          remaining_amount: 0,
          paid_installments: agreement?.installments || 0,
          overdue_installments: 0,
          recommended_action: 'none',
        });
        // Marcar todas as parcelas como pagas
        try {
          const installments = await base44.asServiceRole.entities.AgreementInstallment.filter({ agreement_id: agreementId });
          await Promise.all(installments.map(inst =>
            base44.asServiceRole.entities.AgreementInstallment.update(inst.id, { status: 'paid', paid_at: new Date().toISOString() })
          ));
        } catch { /* ignora falha nas parcelas */ }
        return ok(updated, 'Acordo marcado como quitado');
      } catch (e) {
        return fail('MARK_ERROR', `Erro ao marcar acordo: ${e.message}`, 500);
      }
    }

    // ── ADD INSTALLMENTS ──────────────────────────────────────────────────────
    if (action === 'add_installments') {
      if (!agreementId || !payload?.installments) return fail('MISSING_DATA', 'agreementId e installments são obrigatórios');
      try {
        const created = await Promise.all(
          payload.installments.map((inst: any) =>
            base44.asServiceRole.entities.AgreementInstallment.create({ ...inst, agreement_id: agreementId })
          )
        );
        return ok(created, 'Parcelas adicionadas com sucesso');
      } catch (e) {
        return fail('CREATE_ERROR', `Erro ao criar parcelas: ${e.message}`, 500);
      }
    }

    // ── DASHBOARD ─────────────────────────────────────────────────────────────
    if (action === 'dashboard') {
      try {
        const agreements = await base44.asServiceRole.entities.Agreement.list('-created_date', 500);
        const active    = agreements.filter((a: any) => a.status === 'active');
        const overdue   = agreements.filter((a: any) => a.status === 'overdue');
        const broken    = agreements.filter((a: any) => a.status === 'broken');
        const paid      = agreements.filter((a: any) => a.status === 'paid');
        const pending   = agreements.filter((a: any) => a.status === 'pending_signature');

        const totalNegotiated = agreements.reduce((s: number, a: any) => s + (a.negotiated_amount || 0), 0);
        const totalOverdue    = [...overdue, ...broken].reduce((s: number, a: any) => s + (a.remaining_amount || 0), 0);
        const totalRecovered  = paid.reduce((s: number, a: any) => s + (a.paid_amount || 0), 0);

        const today = new Date().toISOString().slice(0, 10);
        const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
        const nextDue = agreements.filter((a: any) =>
          a.status === 'active' && a.next_due_date && a.next_due_date >= today && a.next_due_date <= nextWeek
        );

        return ok({
          total: agreements.length,
          active: active.length,
          overdue: overdue.length,
          broken: broken.length,
          paid: paid.length,
          pending_signature: pending.length,
          total_negotiated: totalNegotiated,
          total_overdue_amount: totalOverdue,
          total_recovered: totalRecovered,
          next_due_7_days: nextDue.length,
        });
      } catch (e) {
        return fail('DASHBOARD_ERROR', `Erro ao gerar dashboard: ${e.message}`, 500);
      }
    }

    // ── RUN VERIFICATION (batch) ──────────────────────────────────────────────
    if (action === 'run_verification') {
      try {
        const settings = await getSettings();
        const toleranceDays = settings.tolerance_days_overdue || 5;
        const brokenDays    = settings.days_to_mark_broken || 15;
        const today = new Date(); today.setHours(0, 0, 0, 0);

        const activeAgreements = await base44.asServiceRole.entities.Agreement.filter({ status: 'active' });
        const overdueAgreements = await base44.asServiceRole.entities.Agreement.filter({ status: 'overdue' });
        const allToCheck = [...activeAgreements, ...overdueAgreements];

        let updated = 0; let broken = 0; let reminded = 0;

        for (const agreement of allToCheck) {
          if (!agreement.next_due_date) continue;
          const due = new Date(agreement.next_due_date); due.setHours(0, 0, 0, 0);
          const diffDays = Math.floor((today.getTime() - due.getTime()) / 86_400_000);

          if (diffDays <= 0) continue; // ainda não venceu

          let newStatus = agreement.status;
          if (diffDays > brokenDays) newStatus = 'broken';
          else if (diffDays > toleranceDays) newStatus = 'overdue';

          if (newStatus !== agreement.status) {
            await base44.asServiceRole.entities.Agreement.update(agreement.id, {
              status: newStatus,
              overdue_installments: Math.max((agreement.overdue_installments || 0), 1),
              recommended_action: newStatus === 'broken' ? 'renegotiate' : 'request_payment',
            });
            if (newStatus === 'broken') broken++;
            updated++;
          }
        }

        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'agreementApi', action: 'run_verification', status: 'sucesso', details: `${updated} atualizados, ${broken} quebrados, ${reminded} lembretes` });
        return ok({ checked: allToCheck.length, updated, broken, reminded }, 'Verificação concluída');
      } catch (e) {
        return fail('VERIFICATION_ERROR', `Erro na verificação: ${e.message}`, 500);
      }
    }

    // ── SEND REMINDER (WhatsApp via Evolution Go) ────────────────────────────
    if (action === 'send_reminder') {
      if (!agreementId) return fail('MISSING_ID', 'agreementId é obrigatório');
      try {
        const agreement = await base44.asServiceRole.entities.Agreement.get(agreementId);
        if (!agreement) return fail('NOT_FOUND', 'Acordo não encontrado', 404);
        const customerPhone = agreement.customer_phone;
        if (!customerPhone) return fail('NO_PHONE', 'Cliente sem telefone cadastrado');

        // Config obrigatória do Evolution Go (sem defaults embutidos).
        if (!evoBaseUrl || !evoKey) {
          return fail('EVOLUTION_NOT_CONFIGURED', 'Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no backend.', 503);
        }

        const settings = await getSettings();
        const fmtBRL = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

        let template = '';
        if (agreement.status === 'active')  template = settings.auto_message_active  || 'Olá {nome}, seu acordo está em dia. Próximo vencimento: {vencimento} no valor de {valor}.';
        if (agreement.status === 'overdue') template = settings.auto_message_overdue || 'Olá {nome}, sua parcela de {valor} com vencimento {vencimento} está em atraso.';
        if (agreement.status === 'broken')  template = settings.auto_message_broken  || 'Olá {nome}, seu acordo está quebrado. Entre em contato para renegociar.';
        if (!template) template = 'Olá {nome}, entre em contato conosco para tratar sobre seu acordo.';

        const message = template
          .replace(/\{nome\}/g,       agreement.customer_name || 'Cliente')
          .replace(/\{valor\}/g,      fmtBRL(agreement.next_installment_amount || 0))
          .replace(/\{vencimento\}/g, fmtDate(agreement.next_due_date || ''));

        // ── Evolution Go: lookup token da instância via /instance/all ──────────
        const instanceName = instance || evoDefaultInst;
        const base = evoBaseUrl.replace(/\/$/, '');

        let instanceToken = evoKey; // fallback: usa a global api key
        try {
          const allRes = await fetch(`${base}/instance/all`, {
            headers: { apikey: evoKey },
            signal: AbortSignal.timeout(10_000),
          });
          if (allRes.ok) {
            const allData = await allRes.json().catch(() => ({}));
            const list: any[] = allData.data || allData || [];
            const found = list.find((i: any) => (i.name || i.instance?.instanceName) === instanceName);
            if (found?.token) instanceToken = found.token;
          }
        } catch { /* usa apiKey global como fallback */ }

        // ── POST /send/text (Evolution Go) ──────────��─────────────────────────
        const number = customerPhone.replace(/\D/g, '');
        const evoRes = await fetch(`${base}/send/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: instanceToken },
          body: JSON.stringify({ number, text: message }),
          signal: AbortSignal.timeout(15_000),
        });
        const rawText = await evoRes.text();
        let evoData: any;
        try { evoData = JSON.parse(rawText); } catch { evoData = { raw: rawText }; }

        await base44.asServiceRole.entities.ReminderLog.create({
          customer_name: agreement.customer_name,
          phone: customerPhone,
          status: evoRes.ok ? 'enviado' : 'falha',
        }).catch(() => {});

        if (!evoRes.ok) {
          await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'evolutionApi', action: 'send_reminder_agreement', status: 'falha', details: JSON.stringify(evoData).slice(0, 500) });
          return fail('EVO_ERROR', `Evolution Go recusou o envio (HTTP ${evoRes.status}): ${JSON.stringify(evoData).slice(0, 200)}`, 500);
        }

        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'evolutionApi', action: 'send_reminder_agreement', status: 'sucesso', details: `Para: ${number} | Instância: ${instanceName}` });
        return ok({ sent: true, number, instance: instanceName, message }, 'Lembrete enviado com sucesso via Evolution Go');
      } catch (e) {
        return fail('SEND_ERROR', `Erro ao enviar lembrete: ${e.message}`, 500);
      }
    }

    // ── GENERATE ZAPSIGN ─────────────────────────────────────────────────────
    if (action === 'generate_zapsign') {
      if (!agreementId) return fail('MISSING_ID', 'agreementId é obrigatório');
      if (!zapToken)    return fail(
        'ZAPSIGN_NOT_CONFIGURED',
        'ZapSign não configurado. Configure a variável ZAPSIGN_API_TOKEN nas configurações de ambiente do Base44.',
        500
      );
      try {
        const agreement = await base44.asServiceRole.entities.Agreement.get(agreementId);
        if (!agreement) return fail('NOT_FOUND', 'Acordo não encontrado', 404);

        const fmtBRL  = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

        const zapBody = {
          name: `Acordo de Renegociação - ${agreement.customer_name}`,
          url_pdf: payload?.document_url || '',
          sandbox: Deno.env.get('ZAPSIGN_SANDBOX') === 'true',
          signers: [{
            name: agreement.customer_name,
            email: agreement.customer_email || '',
            phone_country: '55',
            phone_number: (agreement.customer_phone || '').replace(/\D/g, ''),
            send_automatic_email: true,
            send_automatic_whatsapp: !!(agreement.customer_phone),
            auth_mode: 'assinaturaTela',
          }],
          metadata: {
            agreement_id: agreementId,
            customer_id: agreement.customer_id || '',
          },
        };

        const zapRes = await fetch('https://api.zapsign.com.br/api/v1/docs/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${zapToken}` },
          body: JSON.stringify(zapBody),
          signal: AbortSignal.timeout(20_000),
        });
        const zapData = await zapRes.json().catch(() => ({}));

        if (!zapRes.ok) return fail('ZAPSIGN_ERROR', `Falha ao gerar documento ZapSign: ${JSON.stringify(zapData).slice(0, 200)}`, 500);

        const docToken = zapData.token || zapData.open_id || '';
        await base44.asServiceRole.entities.Agreement.update(agreementId, {
          status: 'pending_signature',
          zapsign_document_id: docToken,
          zapsign_status: 'pending',
          zapsign_url: zapData.signer_tokens?.[0]?.sign_url || zapData.url || '',
        });

        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'agreementApi', action: 'generate_zapsign', status: 'sucesso', details: `Doc ${docToken} para acordo ${agreementId}` });
        return ok({ document_id: docToken, url: zapData.signer_tokens?.[0]?.sign_url || zapData.url || '', status: 'pending_signature' }, 'Documento ZapSign gerado com sucesso');
      } catch (e) {
        return fail('ZAPSIGN_ERROR', `Erro ao gerar ZapSign: ${e.message}`, 500);
      }
    }

    // ── ZAPSIGN WEBHOOK ───────────────────────────────────────────────────────
    if (action === 'zapsign_webhook') {
      try {
        const docToken  = payload?.document?.token || payload?.open_id || '';
        const eventType = payload?.event_action || '';
        if (!docToken) return ok({ ignored: true }, 'Token ausente');

        // Buscar acordo pelo zapsign_document_id
        const agreements = await base44.asServiceRole.entities.Agreement.filter({ zapsign_document_id: docToken });
        if (agreements.length === 0) return ok({ ignored: true }, 'Acordo não encontrado para este documento');

        const agreement = agreements[0];
        let newStatus = 'pending_signature';
        let newZapStatus = 'pending';
        let signedAt = '';

        if (eventType === 'sign_ok' || payload?.document?.status === 'signed') {
          newStatus = 'active';
          newZapStatus = 'signed';
          signedAt = new Date().toISOString();
        } else if (eventType === 'refuse') {
          newZapStatus = 'refused';
        } else if (eventType === 'expired') {
          newZapStatus = 'expired';
        }

        await base44.asServiceRole.entities.Agreement.update(agreement.id, {
          status: newStatus,
          zapsign_status: newZapStatus,
          zapsign_signed_at: signedAt || undefined,
        });

        return ok({ updated: true, agreement_id: agreement.id }, 'Webhook processado');
      } catch (e) {
        return fail('WEBHOOK_ERROR', `Erro ao processar webhook: ${e.message}`, 500);
      }
    }

    // ── VERIFY AGREEMENT (main function) ──────────────────────────────────────
    if (action === 'verify' || action === 'check') {
      // Exigir IXC configurado — sem ele não há dados financeiros reais
      if (!ixcBaseUrl || !ixcToken) {
        return fail(
          'IXC_NOT_CONFIGURED',
          'IXC Provedor não configurado. Configure IXC_API_URL e IXC_API_TOKEN nas variáveis de ambiente do Base44.',
          500
        );
      }

      const settings = await getSettings();
      const toleranceDays = settings.tolerance_days_overdue || 5;
      const brokenDays    = settings.days_to_mark_broken || 15;

      // 1. Tentar encontrar acordo local (base44)
      let localAgreement: any = null;
      const searchKey = customerId || cpfCnpj || phone || contractId || conversationId;

      if (customerId) {
        const results = await base44.asServiceRole.entities.Agreement.filter({ customer_id: customerId });
        localAgreement = results.filter((a: any) => a.status !== 'paid').sort((a: any, b: any) =>
          new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime()
        )[0] || results[0] || null;
      }
      if (!localAgreement && conversationId) {
        const results = await base44.asServiceRole.entities.Agreement.filter({ conversation_id: conversationId });
        localAgreement = results[0] || null;
      }

      // 2. Buscar cliente no IXC — obrigatório
      const ixcCustomer: any = await findIxcCustomer({ cpfCnpj, phone, clientId: customerId, contractId });
      if (!ixcCustomer) {
        // Ainda tenta retornar acordo local se existir, mas marca a ausência do IXC
        let fallbackAgreements: any[] = [];
        if (customerId) fallbackAgreements = await base44.asServiceRole.entities.Agreement.filter({ customer_id: customerId });
        else if (conversationId) fallbackAgreements = await base44.asServiceRole.entities.Agreement.filter({ conversation_id: conversationId });
        const fallback = fallbackAgreements.filter((a: any) => a.status !== 'paid')[0] || fallbackAgreements[0];
        if (fallback) {
          const recAction = determineRecommendedAction(fallback.status, fallback.zapsign_status || 'none');
          return ok({
            hasAgreement: true,
            agreementStatus: fallback.status,
            customer: { id: customerId || '', name: fallback.customer_name, cpf_cnpj: fallback.customer_cpf_cnpj || '', phone: fallback.customer_phone || '' },
            agreement: {
              id: fallback.id, origin: fallback.origin || 'local',
              originalAmount: fallback.original_amount, negotiatedAmount: fallback.negotiated_amount,
              paidAmount: fallback.paid_amount, remainingAmount: fallback.remaining_amount,
              installments: fallback.installments, paidInstallments: fallback.paid_installments,
              overdueInstallments: fallback.overdue_installments,
              nextDueDate: fallback.next_due_date, nextInstallmentAmount: fallback.next_installment_amount,
              notes: fallback.notes || '',
            },
            invoices: { open: [], overdue: [], paid: [] },
            ixc_warning: 'Cliente não encontrado no IXCSoft. Dados financeiros indisponíveis.',
            recommendedAction: recAction,
          });
        }
        return fail('IXC_CUSTOMER_NOT_FOUND', `Cliente não encontrado no IXCSoft para o dado informado (${cpfCnpj || phone || customerId || contractId}). Verifique se o cadastro existe no IXC Provedor.`, 404);
      }

      // 3. Se não encontrou acordo local, buscar por CPF/CNPJ do IXC
      if (!localAgreement && ixcCustomer?.cnpj_cpf) {
        const results = await base44.asServiceRole.entities.Agreement.filter({ customer_cpf_cnpj: ixcCustomer.cnpj_cpf.replace(/\D/g, '') });
        localAgreement = results.filter((a: any) => a.status !== 'paid')[0] || results[0] || null;
      }

      // 4. Buscar títulos no IXC — obrigatório, erro se falhar
      let ixcInvoices: any[] = [];
      let ixcOpen: any[] = [];
      let ixcOverdue: any[] = [];
      let ixcPaid: any[] = [];

      const invoiceResult = await ixcPost('fn_areceber', {
        qtype: 'fn_areceber.id_cliente', query: String(ixcCustomer.id), oper: '=',
        sortname: 'fn_areceber.data_vencimento', sortorder: 'asc',
        page: '1', rp: '200',
      });
      if (!invoiceResult.ok) {
        return fail('IXC_INVOICES_ERROR', `Falha ao buscar títulos do IXCSoft para o cliente #${ixcCustomer.id}. Verifique a conexão com o IXC Provedor.`, 502);
      }
      ixcInvoices = invoiceResult.data.registros || [];

      const today = new Date().toISOString().slice(0, 10);
      ixcPaid    = ixcInvoices.filter((f: any) => f.status === 'P');
      ixcOverdue = ixcInvoices.filter((f: any) => f.status === 'A' && f.data_vencimento && f.data_vencimento < today);
      ixcOpen    = ixcInvoices.filter((f: any) => f.status === 'A' && (!f.data_vencimento || f.data_vencimento >= today));

      // 5. Classificar status financeiro real via IXC
      const customerInfo = normalizeCustomer(ixcCustomer);

      let agreementStatus = 'none';
      let agreementData: any = null;
      let zapsignData: any = null;

      if (localAgreement) {
        agreementStatus = localAgreement.status;
        agreementData = localAgreement;

        // ZapSign
        if (localAgreement.zapsign_document_id) {
          zapsignData = {
            documentId: localAgreement.zapsign_document_id,
            status: localAgreement.zapsign_status || 'pending',
            signedAt: localAgreement.zapsign_signed_at || null,
            url: localAgreement.zapsign_url || null,
          };
        }
      } else if (ixcInvoices.length > 0) {
        // Inferir acordo pelo histórico financeiro do IXC
        const { status } = classifyAgreementStatus(ixcInvoices, toleranceDays, brokenDays);
        agreementStatus = status;

        if (ixcInvoices.length > 0 && status !== 'none') {
          const today = new Date().toISOString().slice(0, 10);
          const nextInvoice = ixcOpen[0] || ixcOverdue[0];
          const totalAmount = ixcInvoices.reduce((s: number, f: any) => s + parseFloat(f.valor || f.valor_aberto || '0'), 0);
          const paidAmount  = ixcPaid.reduce((s: number, f: any) => s + parseFloat(f.valor || '0'), 0);

          agreementData = {
            id: null,
            origin: 'ixc',
            originalAmount: totalAmount,
            negotiatedAmount: totalAmount,
            paidAmount,
            remainingAmount: totalAmount - paidAmount,
            installments: ixcInvoices.length,
            paidInstallments: ixcPaid.length,
            overdueInstallments: ixcOverdue.length,
            nextDueDate: nextInvoice?.data_vencimento || null,
            nextInstallmentAmount: nextInvoice ? parseFloat(nextInvoice.valor_aberto || nextInvoice.valor || '0') : null,
            createdAt: null,
            updatedAt: null,
            notes: `Dados financeiros obtidos do IXCSoft. ${ixcOverdue.length} título(s) vencido(s).`,
          };
        }
      }

      const recommendedAction = determineRecommendedAction(agreementStatus, zapsignData?.status || 'none');

      // 6. Registrar log
      try {
        const inputType = customerId ? 'customer_id' : cpfCnpj ? 'cpf_cnpj' : phone ? 'phone' : contractId ? 'contract_id' : 'conversation';
        const inputValue = customerId || cpfCnpj || phone || contractId || conversationId || '';
        await base44.asServiceRole.entities.AgreementVerificationLog.create({
          customer_id: ixcCustomer?.id?.toString() || customerId || '',
          conversation_id: conversationId || '',
          input_type: inputType,
          input_value: inputValue,
          agreement_status: agreementStatus,
          has_agreement: agreementStatus !== 'none',
          status: 'success',
          result_summary: `Status: ${agreementStatus}. IXC: ${ixcInvoices.length} título(s). Local: ${localAgreement ? 'Sim' : 'Não'}.`,
        });
      } catch { /* log opcional */ }

      const responseData: any = {
        hasAgreement: agreementStatus !== 'none',
        agreementStatus,
        customer: customerInfo,
        invoices: {
          open:    ixcOpen.map((f: any) => ({ id: f.id, due_date: f.data_vencimento, value: parseFloat(f.valor_aberto || f.valor || '0'), status: 'open', boleto: f.boleto || '', pix: f.pix_qrcode || '' })),
          overdue: ixcOverdue.map((f: any) => ({ id: f.id, due_date: f.data_vencimento, value: parseFloat(f.valor_aberto || f.valor || '0'), status: 'overdue', boleto: f.boleto || '' })),
          paid:    ixcPaid.slice(0, 10).map((f: any) => ({ id: f.id, due_date: f.data_vencimento, payment_date: f.data_pagamento, value: parseFloat(f.valor || '0'), status: 'paid' })),
        },
        recommendedAction,
      };

      if (agreementData) {
        if (localAgreement) {
          responseData.agreement = {
            id: localAgreement.id,
            origin: localAgreement.origin || 'local',
            originalAmount: localAgreement.original_amount || 0,
            negotiatedAmount: localAgreement.negotiated_amount || 0,
            paidAmount: localAgreement.paid_amount || 0,
            remainingAmount: localAgreement.remaining_amount || 0,
            installments: localAgreement.installments || 1,
            paidInstallments: localAgreement.paid_installments || 0,
            overdueInstallments: localAgreement.overdue_installments || 0,
            nextDueDate: localAgreement.next_due_date || null,
            nextInstallmentAmount: localAgreement.next_installment_amount || null,
            createdAt: localAgreement.created_date || null,
            updatedAt: localAgreement.updated_date || null,
            notes: localAgreement.notes || '',
          };
        } else {
          responseData.agreement = agreementData;
        }
      }

      if (zapsignData) responseData.zapsign = zapsignData;

      return ok(responseData);
    }

    // ── GET AGREEMENTS BY CUSTOMER ────────────────────────────────────────────
    if (action === 'by_customer') {
      if (!customerId && !cpfCnpj && !phone) return fail('MISSING_PARAM', 'customerId, cpfCnpj ou phone são obrigatórios');
      try {
        let agreements: any[] = [];
        if (customerId) {
          agreements = await base44.asServiceRole.entities.Agreement.filter({ customer_id: customerId });
        } else if (cpfCnpj) {
          agreements = await base44.asServiceRole.entities.Agreement.filter({ customer_cpf_cnpj: cpfCnpj.replace(/\D/g, '') });
        } else if (phone) {
          agreements = await base44.asServiceRole.entities.Agreement.filter({ customer_phone: phone });
        }
        return ok(agreements.sort((a: any, b: any) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime()));
      } catch (e) {
        return fail('GET_ERROR', `Erro ao buscar acordos: ${e.message}`, 500);
      }
    }

    // ── GET INSTALLMENTS ──────────────────────────────────────────────────────
    if (action === 'get_installments') {
      if (!agreementId) return fail('MISSING_ID', 'agreementId é obrigatório');
      try {
        const installments = await base44.asServiceRole.entities.AgreementInstallment.filter({ agreement_id: agreementId }, 'installment_number');
        return ok(installments);
      } catch (e) {
        return fail('GET_ERROR', `Erro ao buscar parcelas: ${e.message}`, 500);
      }
    }

    return fail('UNKNOWN_ACTION', `Ação desconhecida: ${action}`);

  } catch (error) {
    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.ErrorLog.create({ function_name: 'agreementApi', error_message: error.message }).catch(() => {});
    return Response.json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
});
