import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Movimenta a etapa do Lead no funil do CRM conforme a interação (mensagem
// enviada/recebida) com o telefone do cliente, e agenda o próximo follow-up.
// Disparado pelo workflow "LeadStageOnMessage" (trigger: criação de Message).

const TERMINAL_STAGES = ['venda_fechada', 'venda_perdida'];
const FOLLOW_UP_DAYS = 2;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { phone, direction } = await req.json().catch(() => ({}));
    if (!phone || !direction) {
      return Response.json({ success: true, ignored: true, reason: 'phone e direction são obrigatórios' });
    }

    const digits = String(phone).replace(/\D/g, '').slice(-8);
    if (!digits) return Response.json({ success: true, ignored: true, reason: 'telefone inválido' });

    const leads = await base44.asServiceRole.entities.Lead.filter({});
    const lead = leads.find((l) => String(l.phone || '').replace(/\D/g, '').slice(-8) === digits);
    if (!lead) return Response.json({ success: true, ignored: true, reason: 'lead não encontrado' });

    if (TERMINAL_STAGES.includes(lead.stage)) {
      return Response.json({ success: true, ignored: true, reason: `lead já está em etapa final (${lead.stage})` });
    }

    const nextContactDate = new Date(Date.now() + FOLLOW_UP_DAYS * 86_400_000).toISOString().slice(0, 10);
    const updates: Record<string, unknown> = {};

    if (direction === 'in') {
      // Cliente respondeu
      if (lead.stage === 'novo_lead') { updates.stage = 'primeiro_contato'; updates.next_contact = null; }
      else if (lead.stage === 'aguardando_retorno') { updates.stage = 'agendamento'; updates.next_contact = null; }
    } else if (direction === 'out') {
      // Empresa entrou em contato — garante um follow-up agendado
      if (lead.stage === 'novo_lead') { updates.stage = 'primeiro_contato'; updates.next_contact = nextContactDate; }
      else if (['primeiro_contato', 'qualificacao', 'proposta_enviada', 'aguardando_retorno'].includes(lead.stage)) {
        updates.next_contact = nextContactDate;
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ success: true, ignored: true, reason: 'nenhuma transição aplicável' });
    }

    await base44.asServiceRole.entities.Lead.update(lead.id, updates);
    await base44.asServiceRole.entities.IntegrationLog.create({
      integration: 'crmApi',
      action: 'advance_lead_on_interaction',
      status: 'sucesso',
      details: `Lead ${lead.id} (${lead.name}): ${JSON.stringify(updates)} — direção: ${direction}`,
    }).catch(() => {});

    return Response.json({ success: true, lead_id: lead.id, updates });
  } catch (error) {
    await base44.asServiceRole.entities.ErrorLog.create({ function_name: 'advanceLeadOnInteraction', error_message: error.message }).catch(() => {});
    return Response.json({ error: error.message }, { status: 500 });
  }
});