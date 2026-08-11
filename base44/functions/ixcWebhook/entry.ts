import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { logError } from '../../shared/errorLogger.ts';
import { validateWebhookRequest } from '../../shared/webhookSecurity.ts';

// Webhook handler para o IXCSoft (Provedor).
// O IXCSoft envia webhooks HTTP POST para eventos como:
//   - Atualização de ticket/OS (atendimento)
//   - Geração de boleto / fatura
//   - Alteração de status de contrato
//   - Bloqueio/desbloqueio de cliente
//
// Configure no IXCSoft: Configurações → Webhooks → URL:
//   https://<app>/functions/ixcWebhook?key=<IXC_WEBHOOK_SECRET>
//
// O secret IXC_WEBHOOK_SECRET deve ser definido nas variáveis de ambiente.
// Para validação de origem, configure IXC_API_URL com a URL base do seu IXCSoft.

type AnyRecord = Record<string, unknown>;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let action = 'unknown';

  try {
    // ── Validação de origem e segurança (fail-closed) ────────────────────────
    // Rate limiting + API key + validação de origem via módulo compartilhado.
    const security = validateWebhookRequest(req, {
      apiKeyEnv: 'IXC_WEBHOOK_SECRET',
      allowedOriginEnv: 'IXC_API_URL',
      rateLimitMax: 60, // IXC envia menos webhooks que WhatsApp
    });
    if (!security.ok) {
      await base44.asServiceRole.entities.IntegrationLog.create({
        integration: 'ixcApi',
        action: 'webhook_rejected',
        status: 'falha',
        details: `IP ${security.clientIp}: ${security.error}`,
      }).catch(() => {});
      return Response.json({ error: security.error }, { status: security.status });
    }

    const body = await req.json().catch(() => ({}));
    action = String(body.action || body.event || body.type || 'unknown');

    // ── Eventos do IXCSoft ─────────────────────────────────────────────────
    // O IXCSoft envia diferentes formatos de webhook. Normalizamos aqui.

    // Evento: Atualização de Ticket/OS (atendimento)
    if (action === 'ticket_update' || action === 'os_update' || action === 'atendimento') {
      const ticketId = String(body.id || body.ticket_id || body.os_id || '');
      const clientId = String(body.id_cliente || body.client_id || '');
      const status = String(body.status || '');
      const subject = String(body.assunto || body.subject || '');

      // Cria ou atualiza SupportTicket local
      if (clientId) {
        const existing = await base44.asServiceRole.entities.SupportTicket
          .filter({ ixc_os_id: ticketId }).catch(() => []);

        if (existing && existing.length > 0) {
          await base44.asServiceRole.entities.SupportTicket.update(existing[0].id, {
            status: mapIxcStatus(status),
            resolution: status === 'F' ? String(body.solucao || '') : undefined,
          });
        }
      }

      await base44.asServiceRole.entities.IntegrationLog.create({
        integration: 'ixcApi',
        action: 'webhook_ticket_update',
        status: 'sucesso',
        details: `OS #${ticketId} status=${status}`,
      });

      return Response.json({ received: true, action: 'ticket_update' });
    }

    // Evento: Atualização de contrato / status de cliente
    if (action === 'contract_update' || action === 'cliente_contrato') {
      const contractId = String(body.id || body.contract_id || '');
      const clientId = String(body.id_cliente || body.client_id || '');
      const status = String(body.status || '');
      const internetStatus = String(body.status_internet || '');

      // Atualiza IxcContract local se existir
      const existing = await base44.asServiceRole.entities.IxcContract
        .filter({ ixc_contract_id: contractId }).catch(() => []);

      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.IxcContract.update(existing[0].id, {
          status: status === 'A' ? 'ativo' : status === 'CA' ? 'cancelado' : status === 'S' ? 'suspenso' : 'outro',
          internet_status: internetStatus,
          last_synced_at: new Date().toISOString(),
        });
      }

      // Se contrato foi cancelado/suspenso, atualiza Customer local
      if (clientId && (status === 'CA' || status === 'S')) {
        const customers = await base44.asServiceRole.entities.Customer
          .filter({ phone: String(body.fone || body.telefone || '') }).catch(() => []);
        for (const c of customers) {
          await base44.asServiceRole.entities.Customer.update(c.id, {
            contract_status: status === 'CA' ? 'cancelado' : 'suspenso',
            connection_status: status === 'CA' ? 'bloqueado' : 'offline',
          });
        }
      }

      await base44.asServiceRole.entities.IntegrationLog.create({
        integration: 'ixcApi',
        action: 'webhook_contract_update',
        status: 'sucesso',
        details: `Contrato #${contractId} status=${status} internet=${internetStatus}`,
      });

      return Response.json({ received: true, action: 'contract_update' });
    }

    // Evento: Geração de fatura / boleto
    if (action === 'invoice_create' || action === 'fn_areceber' || action === 'fatura') {
      const invoiceId = String(body.id || body.invoice_id || '');
      const clientId = String(body.id_cliente || body.client_id || '');
      const value = parseFloat(body.valor || body.valor_aberto || '0');
      const dueDate = String(body.data_vencimento || body.due_date || '');

      // Cria Charge local se não existir
      if (clientId && value > 0) {
        const existing = await base44.asServiceRole.entities.Charge
          .filter({ phone: String(body.fone || body.telefone || '') }).catch(() => []);

        // Apenas registra log — o Charge será criado na próxima sincronização
        await base44.asServiceRole.entities.IntegrationLog.create({
          integration: 'ixcApi',
          action: 'webhook_invoice_create',
          status: 'sucesso',
          details: `Fatura #${invoiceId} cliente=${clientId} valor=${value} venc=${dueDate}`,
        });
      }

      return Response.json({ received: true, action: 'invoice_create' });
    }

    // Evento: Pagamento confirmado
    if (action === 'payment_confirmed' || action === 'pagamento') {
      const invoiceId = String(body.id || body.invoice_id || '');
      const clientId = String(body.id_cliente || body.client_id || '');

      // Atualiza status de cobrança local
      const charges = await base44.asServiceRole.entities.Charge
        .filter({ phone: String(body.fone || body.telefone || '') }).catch(() => []);

      for (const c of charges) {
        if (c.value === parseFloat(body.valor || '0')) {
          await base44.asServiceRole.entities.Charge.update(c.id, { status: 'paga' });
        }
      }

      // Atualiza status financeiro do cliente
      if (clientId) {
        const customers = await base44.asServiceRole.entities.Customer
          .filter({ phone: String(body.fone || body.telefone || '') }).catch(() => []);
        for (const c of customers) {
          await base44.asServiceRole.entities.Customer.update(c.id, {
            financial_status: 'em_dia',
            balance_due: 0,
          });
        }
      }

      await base44.asServiceRole.entities.IntegrationLog.create({
        integration: 'ixcApi',
        action: 'webhook_payment_confirmed',
        status: 'sucesso',
        details: `Fatura #${invoiceId} paga`,
      });

      return Response.json({ received: true, action: 'payment_confirmed' });
    }

    // Evento genérico — apenas registra log
    await base44.asServiceRole.entities.IntegrationLog.create({
      integration: 'ixcApi',
      action: 'webhook_generic',
      status: 'sucesso',
      details: `action=${action} payload_keys=${Object.keys(body).join(',')}`.slice(0, 500),
    });

    return Response.json({ received: true, action });
  } catch (error) {
    await logError(base44, 'ixcWebhook', error, { action, severity: 'alta' });
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

function mapIxcStatus(status: string): string {
  if (status === 'A') return 'em_atendimento';
  if (status === 'F') return 'fechado';
  if (status === 'C') return 'cancelado';
  if (status === 'R') return 'resolvido';
  return 'aberto';
}