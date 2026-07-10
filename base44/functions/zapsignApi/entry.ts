import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── helpers ────────────────────────────────────────────────────────────────
const ZAP_BASE = 'https://api.zapsign.com.br/api/v1';

function zapHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function zapFetch(token: string, path: string, opts: RequestInit = {}) {
  const res = await fetch(`${ZAP_BASE}${path}`, {
    ...opts,
    headers: { ...zapHeaders(token), ...(opts.headers || {}) },
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

function ixcHeaders(ixcToken: string) {
  return { Authorization: `Basic ${ixcToken}`, 'ixcsoft': 'listar', 'Content-Type': 'application/json' };
}

async function ixcFetch(baseUrl: string, token: string, endpoint: string, body = {}) {
  const url = `${baseUrl.replace(/\/$/, '')}/${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: ixcHeaders(token),
    body: JSON.stringify({ ...body, limit: '1', start: '0' }),
  });
  const text = await res.text();
  try { return { ok: res.ok, data: JSON.parse(text) }; }
  catch { return { ok: false, data: { raw: text } }; }
}

// Formata data br dd/mm/aaaa
function fmtDateBR(dateStr?: string) {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleDateString('pt-BR'); } catch { return dateStr; }
}

// Formata valor BRL
function fmtBRL(v?: number | string) {
  const n = Number(v || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Preenche variáveis do template com dados do contrato IXC
function fillVariables(
  variables: { key: string; source: string; default?: string }[],
  ixcData: Record<string, unknown>,
  manual: Record<string, string> = {},
): Record<string, string> {
  const IXC_MAP: Record<string, string> = {
    nome_cliente:      String(ixcData.nome_razao || ixcData.nome || ''),
    cpf_cnpj:         String(ixcData.cnpj_cpf || ''),
    rg:               String(ixcData.rg || ''),
    email:            String(ixcData.email || ''),
    telefone:         String(ixcData.telefone_celular || ixcData.fone || ''),
    endereco:         [ixcData.endereco, ixcData.numero, ixcData.bairro].filter(Boolean).join(', '),
    cidade:           String(ixcData.cidade || ''),
    estado:           String(ixcData.uf || ''),
    cep:              String(ixcData.cep || ''),
    plano:            String(ixcData.plano || ixcData.tipo_plano || ''),
    valor_mensalidade: fmtBRL(ixcData.valor_plano as number | undefined),
    valor_instalacao: fmtBRL(ixcData.valor_instalacao as number | undefined),
    id_contrato:      String(ixcData.id_contrato || ixcData.contrato_id || ''),
    data_inicio:      fmtDateBR(ixcData.data_ativacao as string | undefined || ixcData.data_criacao as string | undefined),
    data_hoje:        fmtDateBR(new Date().toISOString()),
    id_cliente:       String(ixcData.id || ''),
  };

  const result: Record<string, string> = {};
  for (const v of variables) {
    if (v.source === 'ixc') result[v.key] = IXC_MAP[v.key] ?? v.default ?? '';
    else result[v.key] = manual[v.key] ?? v.default ?? '';
  }
  return result;
}

// ─── main ────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const b44 = createClientFromRequest(req);

  try {
    const user = await b44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const zapToken  = Deno.env.get('ZAPSIGN_API_TOKEN');
    const ixcUrl    = Deno.env.get('IXC_API_URL');
    const ixcToken  = Deno.env.get('IXC_API_TOKEN');
    const evoBase   = Deno.env.get('EVOLUTION_API_URL') || 'https://evolution-go-9b1u.srv1772067.hstgr.cloud';
    const evoKey    = Deno.env.get('EVOLUTION_API_KEY') || '';
    const evoInst   = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'CONNECT';

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── get_check ──────────────────────────────────────────────────────────
    // GET /checks/{check_id}/ — consulta status de verificação (assinatura eletrônica avançada)
    if (action === 'get_check') {
      if (!zapToken) {
        return Response.json({ success: false, error: { code: 'ZAPSIGN_NOT_CONFIGURED', message: 'ZAPSIGN_API_TOKEN não configurado.' } }, { status: 500 });
      }
      const { checkId } = body;
      if (!checkId) return Response.json({ error: 'checkId é obrigatório' }, { status: 400 });
      const r = await zapFetch(zapToken, `/checks/${checkId}/`);
      if (!r.ok) return Response.json({ success: false, error: 'Falha ao consultar check no ZapSign', details: r.data }, { status: r.status || 502 });
      return Response.json({ success: true, data: r.data });
    }

    // ── dashboard ──────────────────────────────────────────────────────────
    if (action === 'dashboard') {
      const all = await b44.asServiceRole.entities.SignatureRequest.list('-created_date', 1000);
      const pending  = all.filter((s: { status: string }) => s.status === 'pendente').length;
      const signed   = all.filter((s: { status: string }) => s.status === 'assinado').length;
      const expired  = all.filter((s: { status: string }) => s.status === 'expirado').length;
      const cancelled= all.filter((s: { status: string }) => s.status === 'cancelado').length;
      return Response.json({ success: true, data: { pending, signed, expired, cancelled, total: all.length } });
    }

    // ── list_docs ──────────────────────────────────────────────────────────
    if (action === 'list_docs' || action === 'list_documents') {
      const { status, search, limit = 100 } = body;
      let docs = await b44.asServiceRole.entities.SignatureRequest.list('-created_date', limit);
      if (status && status !== 'all') docs = docs.filter((d: { status: string }) => d.status === status);
      if (search) {
        const q = search.toLowerCase();
        docs = docs.filter((d: { customer_name?: string; customer_cpf_cnpj?: string; plan_name?: string; ixc_contract_id?: string }) =>
          d.customer_name?.toLowerCase().includes(q) ||
          d.customer_cpf_cnpj?.includes(q) ||
          d.plan_name?.toLowerCase().includes(q) ||
          d.ixc_contract_id?.includes(q)
        );
      }
      return Response.json({ success: true, data: docs });
    }

    // ── get_doc ────────────────────────────────────────────────────────────
    if (action === 'get_doc' || action === 'get_document' || action === 'check_signature') {
      const { id } = body;
      if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 });
      const doc = await b44.asServiceRole.entities.SignatureRequest.get(id);
      if (!doc) return Response.json({ error: 'Documento não encontrado' }, { status: 404 });

      // Atualizar status do ZapSign em tempo real
      if (doc.zapsign_doc_token && zapToken && doc.status === 'pendente') {
        const zr = await zapFetch(zapToken, `/docs/${doc.zapsign_doc_token}/`);
        if (zr.ok && zr.data) {
          const zd = zr.data as Record<string, unknown>;
          const zapStatus = zd.status as string;
          const mapped = zapStatus === 'finished' ? 'assinado' : zapStatus === 'expired' ? 'expirado' : 'pendente';
          if (mapped !== doc.status) {
            await b44.asServiceRole.entities.SignatureRequest.update(id, {
              status: mapped,
              signed_date: mapped === 'assinado' ? new Date().toISOString().split('T')[0] : undefined,
              signers: JSON.stringify(zd.signers || []),
            });
            doc.status = mapped;
          }
        }
      }
      return Response.json({ success: true, data: doc });
    }

    // ── list_templates ─────────────────────────────────────────────────────
    if (action === 'list_templates') {
      const templates = await b44.asServiceRole.entities.ContractTemplate.list('-created_date', 200);
      return Response.json({ success: true, data: templates });
    }

    // ── save_template ──────────────────────────────────────────────────────
    if (action === 'save_template') {
      const { id, ...fields } = body;
      if (!fields.name) return Response.json({ error: 'name obrigatório' }, { status: 400 });
      let template;
      if (id) {
        template = await b44.asServiceRole.entities.ContractTemplate.update(id, { ...fields });
      } else {
        template = await b44.asServiceRole.entities.ContractTemplate.create({ ...fields, created_by: user.id });
      }
      return Response.json({ success: true, data: template });
    }

    // ── delete_template ────────────────────────────────────────────────────
    if (action === 'delete_template') {
      const { id } = body;
      if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 });
      await b44.asServiceRole.entities.ContractTemplate.delete(id);
      return Response.json({ success: true });
    }

    // ── lookup_ixc_customer ────────────────────────────────────────────────
    // Busca cliente IXC por CPF/CNPJ, telefone ou nome
    if (action === 'lookup_ixc_customer') {
      if (!ixcUrl || !ixcToken) {
        return Response.json({
          success: false,
          error: { code: 'IXC_NOT_CONFIGURED', message: 'IXC_API_URL e IXC_API_TOKEN são obrigatórios.' }
        }, { status: 500 });
      }
      const { query } = body;
      if (!query) return Response.json({ error: 'query obrigatória' }, { status: 400 });

      const q = String(query).replace(/\D/g, '');
      let results: unknown[] = [];

      // Tenta por CPF/CNPJ
      if (q.length >= 11) {
        const r = await ixcFetch(ixcUrl, ixcToken, 'cliente', { qtype: 'cliente.cnpj_cpf', query: q, oper: '=' });
        if (r.ok) results = r.data?.registros || [];
      }

      // Tenta por nome
      if (results.length === 0) {
        const r = await ixcFetch(ixcUrl, ixcToken, 'cliente', { qtype: 'cliente.nome_razao', query, oper: 'ilike' });
        if (r.ok) results = r.data?.registros || [];
      }

      return Response.json({ success: true, data: results.slice(0, 20) });
    }

    // ── get_ixc_contracts ──────────────────────────────────────────────────
    // Retorna contratos de um cliente IXC
    if (action === 'get_ixc_contracts') {
      if (!ixcUrl || !ixcToken) {
        return Response.json({
          success: false,
          error: { code: 'IXC_NOT_CONFIGURED', message: 'IXC_API_URL e IXC_API_TOKEN são obrigatórios.' }
        }, { status: 500 });
      }
      const { ixcCustomerId } = body;
      if (!ixcCustomerId) return Response.json({ error: 'ixcCustomerId obrigatório' }, { status: 400 });

      const r = await ixcFetch(ixcUrl, ixcToken, 'cliente_contrato', {
        qtype: 'cliente_contrato.id_cliente', query: String(ixcCustomerId), oper: '=', limit: '50'
      });
      if (!r.ok) {
        return Response.json({ success: false, error: { code: 'IXC_CONTRACTS_ERROR', message: 'Falha ao buscar contratos IXC.' } }, { status: 502 });
      }
      return Response.json({ success: true, data: r.data?.registros || [] });
    }

    // ── create_from_ixc ────────────────────────────────────────────────────
    if (action === 'create_from_ixc' || (action === 'create_document' && body.ixcCustomerId)) {
      if (!zapToken) {
        return Response.json({
          success: false,
          error: { code: 'ZAPSIGN_NOT_CONFIGURED', message: 'ZAPSIGN_API_TOKEN não configurado. Configure nas variáveis de ambiente do Base44.' }
        }, { status: 500 });
      }
      if (!ixcUrl || !ixcToken) {
        return Response.json({
          success: false,
          error: { code: 'IXC_NOT_CONFIGURED', message: 'IXC_API_URL e IXC_API_TOKEN são obrigatórios.' }
        }, { status: 500 });
      }

      const { ixcCustomerId, ixcContractId, templateId, manualVariables = {}, sendWhatsApp = true, whatsAppInstance = evoInst } = body;
      if (!templateId) return Response.json({ error: 'templateId obrigatório' }, { status: 400 });

      // Buscar template
      const template = await b44.asServiceRole.entities.ContractTemplate.get(templateId);
      if (!template) return Response.json({ error: 'Template não encontrado' }, { status: 404 });

      // Buscar dados do cliente IXC
      const custRes = await ixcFetch(ixcUrl, ixcToken, 'cliente', {
        qtype: 'cliente.id', query: String(ixcCustomerId), oper: '='
      });
      const customer = custRes.data?.registros?.[0];
      if (!customer) {
        return Response.json({ success: false, error: { code: 'IXC_CUSTOMER_NOT_FOUND', message: 'Cliente não encontrado no IXCSoft.' } }, { status: 404 });
      }

      // Buscar contrato IXC
      let contract: Record<string, unknown> = {};
      if (ixcContractId) {
        const cRes = await ixcFetch(ixcUrl, ixcToken, 'cliente_contrato', {
          qtype: 'cliente_contrato.id', query: String(ixcContractId), oper: '='
        });
        contract = cRes.data?.registros?.[0] || {};
      }

      // Merge de dados para preenchimento
      const mergedData: Record<string, unknown> = {
        ...customer,
        plano: contract.descricao || contract.plano || '',
        valor_plano: contract.valor || contract.valor_plano || 0,
        valor_instalacao: contract.valor_instalacao || 0,
        id_contrato: contract.id || ixcContractId || '',
        data_ativacao: contract.data_ativacao || '',
      };

      // Preencher variáveis do template
      const templateVars = JSON.parse(template.variables || '[]');
      const filledVars = fillVariables(templateVars, mergedData, manualVariables);

      // Construir payload para o ZapSign
      let zapPayload: Record<string, unknown>;

      if (template.zapsign_template_id) {
        // Usar template ZapSign
        zapPayload = {
          template_id: template.zapsign_template_id,
          template_data: filledVars,
          name: `${template.name} — ${customer.nome_razao || customer.nome}`,
          signers: [
            {
              name: customer.nome_razao || customer.nome,
              email: customer.email || '',
              phone: (customer.telefone_celular || customer.fone || '').replace(/\D/g, ''),
              send_automatic_email: !!customer.email,
              send_automatic_whatsapp: false, // gerenciamos via Evolution
            },
            ...JSON.parse(template.extra_signers || '[]'),
          ],
        };
      } else {
        // Criar documento básico (sem template ZapSign — o PDF precisa ser fornecido manualmente)
        return Response.json({
          success: false,
          error: {
            code: 'NO_ZAPSIGN_TEMPLATE',
            message: 'Este template não possui um ID de template ZapSign configurado. Adicione o zapsign_template_id nas configurações do template.'
          }
        }, { status: 400 });
      }

      // Criar documento no ZapSign
      const zapRes = await zapFetch(zapToken, '/docs/', {
        method: 'POST',
        body: JSON.stringify(zapPayload),
      });

      if (!zapRes.ok) {
        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'zapsignApi',
          action: 'create_from_ixc',
          status: 'falha',
          details: JSON.stringify(zapRes.data).slice(0, 500),
        });
        return Response.json({
          success: false,
          error: { code: 'ZAPSIGN_ERROR', message: 'Falha ao criar documento no ZapSign.', details: zapRes.data }
        }, { status: 502 });
      }

      const zd = zapRes.data as Record<string, unknown>;
      const firstSigner = (zd.signers as Record<string, unknown>[])?.[0];
      const signUrl = String(firstSigner?.sign_url || '');

      // Salvar na base local
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (template.expires_in_days || 30));

      const sigReq = await b44.asServiceRole.entities.SignatureRequest.create({
        customer_name: String(customer.nome_razao || customer.nome),
        customer_cpf_cnpj: String(customer.cnpj_cpf || ''),
        phone: String(customer.telefone_celular || customer.fone || ''),
        email: String(customer.email || ''),
        ixc_customer_id: String(ixcCustomerId),
        ixc_contract_id: String(ixcContractId || ''),
        plan_name: String(contract.descricao || contract.plano || ''),
        plan_value: Number(contract.valor || 0),
        contract_start_date: String(contract.data_ativacao || '').split('T')[0] || undefined,
        contract_city: String(customer.cidade || ''),
        ixc_data_snapshot: JSON.stringify(mergedData).slice(0, 2000),
        template_id: templateId,
        template_name: template.name,
        variables_used: JSON.stringify(filledVars),
        document_type: template.document_type || 'contrato',
        status: 'pendente',
        zapsign_doc_token: String(zd.token || ''),
        zapsign_open_id: String(zd.open_id || ''),
        document_url: String(zd.original_file || zd.signed_file || ''),
        sign_url: signUrl,
        signers: JSON.stringify(zd.signers || []),
        expires_at: expiresAt.toISOString().split('T')[0],
        sent_by_user_id: user.id,
        provider: 'ZapSign',
      });

      // Incrementar contador de uso do template
      await b44.asServiceRole.entities.ContractTemplate.update(templateId, {
        usage_count: (template.usage_count || 0) + 1,
      });

      // Enviar link via WhatsApp (Evolution Go)
      let whatsappSent = false;
      if (sendWhatsApp && signUrl && customer.telefone_celular) {
        try {
          const msgTemplate = template.whatsapp_message_template ||
            `Olá, {nome}! Seu {tipo_doc} está pronto para assinatura digital.\n\nClique no link para assinar:\n{link_assinatura}\n\nEm caso de dúvidas, entre em contato conosco.`;

          const msg = msgTemplate
            .replace('{nome}', String(customer.nome_razao || customer.nome))
            .replace('{link_assinatura}', signUrl)
            .replace('{plano}', String(contract.descricao || ''))
            .replace('{valor}', fmtBRL(Number(contract.valor || 0)))
            .replace('{tipo_doc}', template.document_type === 'contrato' ? 'contrato' : template.document_type);

          const number = (customer.telefone_celular || customer.fone || '').replace(/\D/g, '');

          // Descobrir token da instância Evolution Go
          const allRes = await fetch(`${evoBase.replace(/\/$/, '')}/instance/all`, { headers: { apikey: evoKey } });
          const allData = await allRes.json().catch(() => ({}));
          const instList = allData.data || allData || [];
          const targetInst = instList.find((i: Record<string, unknown>) => (i.name || (i.instance as Record<string, unknown>)?.instanceName) === whatsAppInstance);
          const instToken = targetInst?.token || evoKey;

          const wRes = await fetch(`${evoBase.replace(/\/$/, '')}/send/text`, {
            method: 'POST',
            headers: { apikey: instToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ number, text: msg }),
          });

          if (wRes.ok) {
            whatsappSent = true;
            await b44.asServiceRole.entities.SignatureRequest.update(sigReq.id, {
              whatsapp_sent: true,
              whatsapp_sent_at: new Date().toISOString(),
              whatsapp_instance: whatsAppInstance,
            });
          }
        } catch (_e) {
          // WhatsApp falhou mas o documento foi criado — não falhar o request todo
        }
      }

      await b44.asServiceRole.entities.IntegrationLog.create({
        integration: 'zapsignApi', action: 'create_from_ixc', status: 'sucesso',
        details: `doc_token=${zd.token} whatsapp=${whatsappSent}`,
      });

      return Response.json({ success: true, data: { ...sigReq, sign_url: signUrl, whatsapp_sent: whatsappSent } });
    }

    // ── create_manual ──────────────────────────────────────────────────────
    // Cria documento ZapSign sem IXC (dados informados manualmente)
    if (action === 'create_manual' || action === 'create_document') {
      if (!zapToken) {
        return Response.json({
          success: false,
          error: { code: 'ZAPSIGN_NOT_CONFIGURED', message: 'ZAPSIGN_API_TOKEN não configurado.' }
        }, { status: 500 });
      }

      const { templateId, customerName, customerEmail, customerPhone, cpfCnpj, manualVariables = {}, sendWhatsApp = true, whatsAppInstance = evoInst } = body;
      if (!templateId || !customerName || !customerPhone) {
        return Response.json({ error: 'templateId, customerName e customerPhone são obrigatórios' }, { status: 400 });
      }

      const template = await b44.asServiceRole.entities.ContractTemplate.get(templateId);
      if (!template) return Response.json({ error: 'Template não encontrado' }, { status: 404 });
      if (!template.zapsign_template_id) {
        return Response.json({ error: 'Template sem zapsign_template_id configurado' }, { status: 400 });
      }

      const templateVars = JSON.parse(template.variables || '[]');
      const filledVars: Record<string, string> = {};
      for (const v of templateVars) {
        filledVars[v.key] = manualVariables[v.key] ?? v.default ?? '';
      }
      // Sobrescreve variáveis-chave com dados do formulário
      if (filledVars.nome_cliente !== undefined) filledVars.nome_cliente = customerName;
      if (filledVars.cpf_cnpj !== undefined) filledVars.cpf_cnpj = cpfCnpj || '';
      if (filledVars.email !== undefined) filledVars.email = customerEmail || '';
      if (filledVars.telefone !== undefined) filledVars.telefone = customerPhone;
      if (filledVars.data_hoje !== undefined) filledVars.data_hoje = fmtDateBR(new Date().toISOString());

      const zapPayload = {
        template_id: template.zapsign_template_id,
        template_data: filledVars,
        name: `${template.name} — ${customerName}`,
        signers: [
          {
            name: customerName,
            email: customerEmail || '',
            phone: customerPhone.replace(/\D/g, ''),
            send_automatic_email: !!customerEmail,
            send_automatic_whatsapp: false,
          },
          ...JSON.parse(template.extra_signers || '[]'),
        ],
      };

      const zapRes = await zapFetch(zapToken, '/docs/', { method: 'POST', body: JSON.stringify(zapPayload) });
      if (!zapRes.ok) {
        return Response.json({ success: false, error: { code: 'ZAPSIGN_ERROR', message: 'Falha ao criar documento no ZapSign.', details: zapRes.data } }, { status: 502 });
      }

      const zd = zapRes.data as Record<string, unknown>;
      const firstSigner = (zd.signers as Record<string, unknown>[])?.[0];
      const signUrl = String(firstSigner?.sign_url || '');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (template.expires_in_days || 30));

      const sigReq = await b44.asServiceRole.entities.SignatureRequest.create({
        customer_name: customerName,
        customer_cpf_cnpj: cpfCnpj || '',
        phone: customerPhone,
        email: customerEmail || '',
        template_id: templateId,
        template_name: template.name,
        variables_used: JSON.stringify(filledVars),
        document_type: template.document_type || 'contrato',
        status: 'pendente',
        zapsign_doc_token: String(zd.token || ''),
        zapsign_open_id: String(zd.open_id || ''),
        document_url: String(zd.original_file || ''),
        sign_url: signUrl,
        signers: JSON.stringify(zd.signers || []),
        expires_at: expiresAt.toISOString().split('T')[0],
        sent_by_user_id: user.id,
        provider: 'ZapSign',
      });

      await b44.asServiceRole.entities.ContractTemplate.update(templateId, {
        usage_count: (template.usage_count || 0) + 1,
      });

      let whatsappSent = false;
      if (sendWhatsApp && signUrl && customerPhone) {
        try {
          const msg = (template.whatsapp_message_template || `Olá, {nome}! Seu documento está pronto para assinatura:\n{link_assinatura}`)
            .replace('{nome}', customerName)
            .replace('{link_assinatura}', signUrl);

          const number = customerPhone.replace(/\D/g, '');
          const allRes = await fetch(`${evoBase.replace(/\/$/, '')}/instance/all`, { headers: { apikey: evoKey } });
          const allData = await allRes.json().catch(() => ({}));
          const instList = allData.data || allData || [];
          const targetInst = instList.find((i: Record<string, unknown>) => (i.name || (i.instance as Record<string, unknown>)?.instanceName) === whatsAppInstance);
          const instToken = targetInst?.token || evoKey;

          const wRes = await fetch(`${evoBase.replace(/\/$/, '')}/send/text`, {
            method: 'POST',
            headers: { apikey: instToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ number, text: msg }),
          });
          if (wRes.ok) {
            whatsappSent = true;
            await b44.asServiceRole.entities.SignatureRequest.update(sigReq.id, {
              whatsapp_sent: true,
              whatsapp_sent_at: new Date().toISOString(),
              whatsapp_instance: whatsAppInstance,
            });
          }
        } catch (_e) { /* WhatsApp opcional */ }
      }

      return Response.json({ success: true, data: { ...sigReq, sign_url: signUrl, whatsapp_sent: whatsappSent } });
    }

    // ── resend ─────────────────────────────────────────────────────────────
    if (action === 'resend' || action === 'send_document') {
      const { id, whatsAppInstance = evoInst } = body;
      if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 });

      const doc = await b44.asServiceRole.entities.SignatureRequest.get(id);
      if (!doc) return Response.json({ error: 'Documento não encontrado' }, { status: 404 });
      if (!doc.sign_url && !doc.zapsign_doc_token) {
        return Response.json({ error: 'Este documento não possui link de assinatura.' }, { status: 400 });
      }

      const signUrl = doc.sign_url;
      const phone = doc.phone?.replace(/\D/g, '');
      if (!phone) return Response.json({ error: 'Telefone do cliente não cadastrado.' }, { status: 400 });

      const msg = `Olá, ${doc.customer_name}! Segue novamente o link para assinar seu ${doc.document_type || 'documento'}:\n${signUrl}`;

      const allRes = await fetch(`${evoBase.replace(/\/$/, '')}/instance/all`, { headers: { apikey: evoKey } });
      const allData = await allRes.json().catch(() => ({}));
      const instList = allData.data || allData || [];
      const targetInst = instList.find((i: Record<string, unknown>) => (i.name || (i.instance as Record<string, unknown>)?.instanceName) === whatsAppInstance);
      const instToken = targetInst?.token || evoKey;

      const wRes = await fetch(`${evoBase.replace(/\/$/, '')}/send/text`, {
        method: 'POST',
        headers: { apikey: instToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: phone, text: msg }),
      });

      if (!wRes.ok) {
        return Response.json({ success: false, error: { code: 'WHATSAPP_ERROR', message: 'Falha ao reenviar via WhatsApp.' } }, { status: 502 });
      }

      await b44.asServiceRole.entities.SignatureRequest.update(id, {
        whatsapp_sent: true,
        whatsapp_sent_at: new Date().toISOString(),
        whatsapp_instance: whatsAppInstance,
      });

      return Response.json({ success: true });
    }

    // ── cancel ─────────────────────────────────────────────────────────────
    if (action === 'cancel' || action === 'cancel_document') {
      const { id } = body;
      if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 });
      const doc = await b44.asServiceRole.entities.SignatureRequest.get(id);
      if (!doc) return Response.json({ error: 'Documento não encontrado' }, { status: 404 });

      // Cancelar no ZapSign se tiver token
      if (zapToken && doc.zapsign_doc_token) {
        await zapFetch(zapToken, `/docs/${doc.zapsign_doc_token}/cancel/`, { method: 'POST' });
      }

      await b44.asServiceRole.entities.SignatureRequest.update(id, { status: 'cancelado' });
      return Response.json({ success: true });
    }

    // ── webhook ────────────────────────────────────────────────────────────
    // ZapSign envia POST quando documento é assinado ou recusado
    if (action === 'webhook') {
      const { document_token, event, status: zapStatus } = body;
      if (!document_token) return Response.json({ error: 'document_token obrigatório' }, { status: 400 });

      const all = await b44.asServiceRole.entities.SignatureRequest.filter({ zapsign_doc_token: document_token });
      const doc = all?.[0];

      if (doc) {
        const newStatus = (event === 'doc_signed' || zapStatus === 'finished') ? 'assinado'
          : (event === 'doc_refused' || zapStatus === 'refused') ? 'cancelado'
          : 'pendente';

        await b44.asServiceRole.entities.SignatureRequest.update(doc.id, {
          status: newStatus,
          signed_date: newStatus === 'assinado' ? new Date().toISOString().split('T')[0] : undefined,
          signers: body.signers ? JSON.stringify(body.signers) : doc.signers,
        });

        await b44.asServiceRole.entities.IntegrationLog.create({
          integration: 'zapsignApi', action: 'webhook', status: 'sucesso',
          details: `doc_token=${document_token} event=${event} new_status=${newStatus}`,
        });
      }

      return Response.json({ received: true });
    }

    // ── sync_status (atualiza status de documentos pendentes em lote) ──────
    if (action === 'sync_status') {
      if (!zapToken) {
        return Response.json({ success: false, error: { code: 'ZAPSIGN_NOT_CONFIGURED', message: 'ZAPSIGN_API_TOKEN não configurado.' } }, { status: 500 });
      }
      const pending = await b44.asServiceRole.entities.SignatureRequest.filter({ status: 'pendente' });
      let updated = 0;
      for (const doc of (pending || [])) {
        if (!doc.zapsign_doc_token) continue;
        const zr = await zapFetch(zapToken, `/docs/${doc.zapsign_doc_token}/`);
        if (!zr.ok) continue;
        const zd = zr.data as Record<string, unknown>;
        const newStatus = zd.status === 'finished' ? 'assinado' : zd.status === 'expired' ? 'expirado' : null;
        if (newStatus) {
          await b44.asServiceRole.entities.SignatureRequest.update(doc.id, {
            status: newStatus,
            signed_date: newStatus === 'assinado' ? new Date().toISOString().split('T')[0] : undefined,
            signers: JSON.stringify(zd.signers || []),
          });
          updated++;
        }
      }
      return Response.json({ success: true, data: { synced: pending?.length || 0, updated } });
    }

    return Response.json({ error: `Action inválida: ${action}` }, { status: 400 });

  } catch (error) {
    await b44.asServiceRole.entities.ErrorLog.create({
      function_name: 'zapsignApi',
      error_message: (error as Error).message,
    }).catch(() => {});
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});