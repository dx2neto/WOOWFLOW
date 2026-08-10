import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { logError } from '../../shared/errorLogger.ts';
import { sendWhatsAppMessage } from '../../shared/evolutionSend.ts';

const OPEN_STATUSES = ['aberto', 'em_contato', 'promessa_pagamento', 'negociando'];

Deno.serve(async (req) => {
  let action: string | undefined;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Não autenticado' } }, { status: 401 });

    const evoBase = Deno.env.get('EVOLUTION_API_URL') || '';
    const evoKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    const evoInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'woow';

    const body = await req.json().catch(() => ({}));
    ({ action } = body);
    const { caseId, status, search, data: payload } = body;

    const ok = (data: any, msg = 'OK') => Response.json({ success: true, data, message: msg });
    const fail = (code: string, msg: string, httpStatus = 400) =>
      Response.json({ success: false, error: { code, message: msg } }, { status: httpStatus });

    const todayStr = () => new Date().toISOString().slice(0, 10);
    const daysLate = (dueDate: string) => {
      if (!dueDate) return 0;
      const diff = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000);
      return diff > 0 ? diff : 0;
    };

    // ── DASHBOARD ─────────────────────────────────────────────────────────────
    if (action === 'dashboard') {
      try {
        const cases = await base44.asServiceRole.entities.CollectionCase.list('-days_late', 1000);
        const open = cases.filter((c: any) => OPEN_STATUSES.includes(c.status));
        const promises = cases.filter((c: any) => c.status === 'promessa_pagamento');
        const totalOpenAmount = open.reduce((s: number, c: any) => s + (c.current_amount || 0), 0);
        const totalOverdueAmount = open.filter((c: any) => (c.days_late || 0) > 0).reduce((s: number, c: any) => s + (c.current_amount || 0), 0);
        const today = todayStr();
        const followUpsToday = open.filter((c: any) => c.next_action_date && c.next_action_date <= today).length;

        return ok({
          total: cases.length,
          open: open.length,
          promises: promises.length,
          paid: cases.filter((c: any) => c.status === 'pago').length,
          lost: cases.filter((c: any) => c.status === 'perdido').length,
          total_open_amount: totalOpenAmount,
          total_overdue_amount: totalOverdueAmount,
          follow_ups_today: followUpsToday,
        });
      } catch (e) {
        return fail('DASHBOARD_ERROR', `Erro ao gerar dashboard: ${e.message}`, 500);
      }
    }

    // ── LIST CASES ────────────────────────────────────────────────────────────
    if (action === 'list_cases') {
      try {
        const cases = status
          ? await base44.asServiceRole.entities.CollectionCase.filter({ status }, '-days_late')
          : await base44.asServiceRole.entities.CollectionCase.list('-days_late', 1000);
        if (!search) return ok(cases);
        const q = String(search).toLowerCase();
        const filtered = cases.filter((c: any) =>
          c.customer_name?.toLowerCase().includes(q) ||
          c.customer_phone?.includes(search) ||
          c.customer_cpf_cnpj?.includes(search)
        );
        return ok(filtered);
      } catch (e) {
        return fail('LIST_ERROR', `Erro ao listar casos: ${e.message}`, 500);
      }
    }

    // ── GET CASE ──────────────────────────────────────────────────────────────
    if (action === 'get_case') {
      if (!caseId) return fail('MISSING_ID', 'caseId é obrigatório');
      try {
        const collectionCase = await base44.asServiceRole.entities.CollectionCase.get(caseId);
        if (!collectionCase) return fail('NOT_FOUND', 'Caso de cobrança não encontrado', 404);
        const attempts = await base44.asServiceRole.entities.CollectionAttempt.filter({ case_id: caseId }, '-created_date');
        return ok({ case: collectionCase, attempts });
      } catch (e) {
        return fail('GET_ERROR', `Erro ao buscar caso: ${e.message}`, 500);
      }
    }

    // ── SYNC FROM IXC ─────────────────────────────────────────────────────────
    if (action === 'sync_from_ixc') {
      try {
        const origin = new URL(req.url).origin;
        const faturasRes = await fetch(origin + '/functions/ixcApi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('Authorization') || '' },
          body: JSON.stringify({ action: 'faturas' }),
        });
        const faturasData = await faturasRes.json().catch(() => ({}));
        if (!faturasRes.ok || faturasData?.error) {
          return fail('IXC_ERROR', faturasData?.error || 'Falha ao buscar faturas do IXC Provedor', 502);
        }
        const registros = faturasData?.result?.registros || [];
        const today = todayStr();
        const overdue = registros.filter((r: any) => r.due_date && r.due_date < today);

        const existing = await base44.asServiceRole.entities.CollectionCase.list('-created_date', 2000);
        const existingByInvoice = new Map(existing.filter((c: any) => c.ixc_invoice_id).map((c: any) => [c.ixc_invoice_id, c]));

        let created = 0;
        let updated = 0;
        for (const inv of overdue) {
          const invoiceId = String(inv.id);
          const late = daysLate(inv.due_date);
          const found = existingByInvoice.get(invoiceId);
          if (found) {
            await base44.asServiceRole.entities.CollectionCase.update(found.id, {
              current_amount: inv.value,
              days_late: late,
            });
            updated++;
          } else {
            await base44.asServiceRole.entities.CollectionCase.create({
              ixc_invoice_id: invoiceId,
              customer_name: inv.customer_name,
              customer_phone: inv.phone || '',
              original_amount: inv.value,
              current_amount: inv.value,
              due_date: inv.due_date,
              days_late: late,
              status: 'aberto',
            });
            created++;
          }
        }

        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'collectionsApi', action: 'sync_from_ixc', status: 'sucesso', details: `${created} criados, ${updated} atualizados de ${overdue.length} faturas vencidas` });
        return ok({ created, updated, total_overdue: overdue.length }, 'Sincronização concluída');
      } catch (e) {
        return fail('SYNC_ERROR', `Erro ao sincronizar com o IXC: ${e.message}`, 500);
      }
    }

    // ── LOG ATTEMPT ───────────────────────────────────────────────────────────
    if (action === 'log_attempt') {
      if (!caseId || !payload?.channel || !payload?.result) return fail('MISSING_DATA', 'caseId, channel e result são obrigatórios');
      try {
        const collectionCase = await base44.asServiceRole.entities.CollectionCase.get(caseId);
        if (!collectionCase) return fail('NOT_FOUND', 'Caso de cobrança não encontrado', 404);

        let result = payload.result;
        if (payload.channel === 'whatsapp' && payload.send_whatsapp) {
          if (!collectionCase.customer_phone) return fail('NO_PHONE', 'Cliente sem telefone cadastrado');
          if (!payload.message) return fail('MISSING_MESSAGE', 'Mensagem é obrigatória para envio via WhatsApp');
          const waResult = await sendWhatsAppMessage({
            base: evoBase,
            apiKey: evoKey,
            instanceName: evoInstance,
            number: collectionCase.customer_phone.replace(/\D/g, ''),
            text: payload.message,
          });
          result = waResult.success ? 'enviado' : 'falha';
          await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'evolutionApi', action: 'collections_attempt', status: waResult.success ? 'sucesso' : 'falha', details: waResult.error || `Para: ${collectionCase.customer_phone}` });
        }

        const attempt = await base44.asServiceRole.entities.CollectionAttempt.create({
          case_id: caseId,
          channel: payload.channel,
          type: payload.type || 'contato_manual',
          message: payload.message || '',
          result,
          performed_by: user.email || user.id,
        });

        const caseUpdate: Record<string, any> = {
          attempts_count: (collectionCase.attempts_count || 0) + 1,
          last_attempt_at: new Date().toISOString(),
        };
        if (payload.new_status) caseUpdate.status = payload.new_status;
        else if (collectionCase.status === 'aberto') caseUpdate.status = 'em_contato';
        if (payload.next_action_date) caseUpdate.next_action_date = payload.next_action_date;

        const updatedCase = await base44.asServiceRole.entities.CollectionCase.update(caseId, caseUpdate);
        return ok({ attempt, case: updatedCase }, 'Tentativa registrada com sucesso');
      } catch (e) {
        return fail('LOG_ERROR', `Erro ao registrar tentativa: ${e.message}`, 500);
      }
    }

    // ── UPDATE CASE ───────────────────────────────────────────────────────────
    if (action === 'update_case') {
      if (!caseId || !payload) return fail('MISSING_DATA', 'caseId e dados são obrigatórios');
      try {
        const updated = await base44.asServiceRole.entities.CollectionCase.update(caseId, payload);
        return ok(updated, 'Caso atualizado com sucesso');
      } catch (e) {
        return fail('UPDATE_ERROR', `Erro ao atualizar caso: ${e.message}`, 500);
      }
    }

    return fail('UNKNOWN_ACTION', `Ação desconhecida: ${action}`);

  } catch (error) {
    const base44 = createClientFromRequest(req);
    await logError(base44, 'collectionsApi', error, { action: action || 'unknown', severity: 'alta' });
    return Response.json({ success: false, error: { code: 'INTERNAL_ERROR', message: (error as Error).message } }, { status: 500 });
  }
});
