import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const baseUrl = Deno.env.get('IXC_API_URL');
    const token = Deno.env.get('IXC_API_TOKEN');
    if (!baseUrl || !token) {
      return Response.json({ error: 'Credenciais do IXC Provedor não configuradas' }, { status: 500 });
    }

    const {
      cpfCnpj, action, search, clientId,
      contratoId, osId,
      page = 1, limit = 60,
      status, startDate, endDate, vendedorId, cidadeId,
      data: bodyData,
    } = await req.json().catch(() => ({}));

    // Helper para construir resposta paginada padronizada
    const paginate = (registros, total, pg = page, lim = limit) => ({
      success: true,
      data: registros,
      pagination: { page: Number(pg), limit: Number(lim), total: Number(total) },
      message: 'OK',
    });

    // Helper de fetch POST ao IXCSoft
    const ixcPost = async (endpoint, body) => {
      const url = baseUrl.replace(/\/$/, '') + '/' + endpoint.replace(/^\//, '');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${token}`, ixcsoft: 'listar' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      return { res, data: await res.json().catch(() => ({})) };
    };

    // Helper de PUT/PATCH ao IXCSoft (criar/atualizar recursos)
    const ixcWrite = async (endpoint, body, method = 'POST') => {
      const url = baseUrl.replace(/\/$/, '') + '/' + endpoint.replace(/^\//, '');
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${token}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      return { res, data: await res.json().catch(() => ({})) };
    };

    const fetchAllPages = async (url, baseBody, maxRecords = 2000) => {
      const rp = 200;
      let page = 1;
      let all = [];
      let total = Infinity;
      while (all.length < total && all.length < maxRecords) {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Basic ${token}`, ixcsoft: 'listar' },
          body: JSON.stringify({ ...baseBody, page: String(page), rp: String(rp) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, data, registros: all };
        const registros = data.registros || [];
        all = all.concat(registros);
        total = parseInt(data.total || '0', 10) || all.length;
        if (registros.length === 0) break;
        page += 1;
      }
      return { ok: true, registros: all };
    };

    // ── NOVO: resolve o nome das cidades ──────────────────────────────────
    // No IXC o campo cliente.cidade é um ID que referencia a tabela "cidade".
    // Sem isso, o nome da cidade chega em branco no sistema. Buscamos a tabela
    // uma vez e montamos { id_cidade: "Nome - UF" } para reaproveitar.
    const carregarMapaCidades = async () => {
      const cidadeUrl = baseUrl.replace(/\/$/, '') + '/cidade';
      const { ok, registros } = await fetchAllPages(
        cidadeUrl,
        { qtype: 'cidade.id', query: '1', oper: '>=', sortname: 'cidade.id', sortorder: 'asc' },
        20000, // há muitas cidades no Brasil; deixamos folga
      );
      const mapa = {};
      if (ok) {
        for (const c of registros) {
          // fallback de campo: varia por versão do IXC
          const nome = c.nome || c.cidade || c.descricao || '';
          const uf = c.uf_sigla || c.sigla_uf || c.uf || '';
          mapa[String(c.id)] = uf ? `${nome} - ${uf}` : nome;
        }
      }
      return { mapa, ok, total: registros.length };
    };

    // ── NOVO: action dedicada para listar cidades (ex.: alimentar dropdown) ─
    if (action === 'cidades') {
      const { mapa, ok, total } = await carregarMapaCidades();
      if (!ok) {
        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'cidades', status: 'falha' });
        return Response.json({ error: 'Falha ao buscar cidades do IXC Provedor' }, { status: 500 });
      }
      const cidades = Object.entries(mapa).map(([id, label]) => ({ id, label }));
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'cidades', status: 'sucesso', details: `${total} cidades carregadas` });
      return Response.json({ success: true, result: { total: cidades.length, registros: cidades } });
    }

    if (action === 'cliente_por_id') {
      if (!clientId) {
        return Response.json({ error: 'clientId é obrigatório' }, { status: 400 });
      }
      const clienteUrl = baseUrl.replace(/\/$/, '') + '/cliente';
      const res = await fetch(clienteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${token}`, ixcsoft: 'listar' },
        body: JSON.stringify({ qtype: 'cliente.id', query: String(clientId), oper: '=', page: '1', rp: '1' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'cliente_por_id', status: 'falha', details: JSON.stringify(data).slice(0, 500) });
        return Response.json({ error: 'Falha ao buscar cliente no IXC Provedor', details: data }, { status: res.status });
      }
      const { mapa: cidadesById } = await carregarMapaCidades();
      const raw = (data.registros || [])[0];
      if (!raw) {
        return Response.json({ success: true, result: { total: 0, registros: [] } });
      }
      const cliente = {
        id: raw.id,
        name: raw.razao || raw.fantasia || `Cliente #${raw.id}`,
        cpf_cnpj: raw.cnpj_cpf,
        phone: raw.telefone_celular || raw.fone || '',
        email: raw.email,
        city: cidadesById[String(raw.cidade)] || raw.cidade_nome || '',
        contract_status: raw.ativo === 'S' ? 'ativo' : 'cancelado',
      };
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'cliente_por_id', status: 'sucesso' });
      return Response.json({ success: true, result: { total: 1, registros: [cliente] } });
    }

    if (action === 'faturas') {
      const areceberUrl = baseUrl.replace(/\/$/, '') + '/fn_areceber';
      const res = await fetch(areceberUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${token}`,
          ixcsoft: 'listar',
        },
        body: JSON.stringify({
          qtype: 'fn_areceber.status',
          query: 'A',
          oper: '=',
          page: '1',
          rp: '60',
          sortname: 'fn_areceber.data_vencimento',
          sortorder: 'asc',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'faturas', status: 'falha', details: JSON.stringify(data).slice(0, 500) });
        return Response.json({ error: 'Falha ao buscar faturas do IXC Provedor', details: data }, { status: res.status });
      }

      const registros = data.registros || [];
      const clientIds = [...new Set(registros.map((r) => r.id_cliente).filter(Boolean))];
      let clientsById = {};

      if (clientIds.length > 0) {
        const clientRes = await fetch(baseUrl.replace(/\/$/, '') + '/cliente', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${token}`,
            ixcsoft: 'listar',
          },
          body: JSON.stringify({
            qtype: 'cliente.id',
            query: clientIds.join(','),
            oper: 'IN',
            page: '1',
            rp: String(clientIds.length),
          }),
        });
        const clientData = await clientRes.json().catch(() => ({}));
        (clientData.registros || []).forEach((c) => { clientsById[c.id] = c; });
      }

      const faturas = registros.map((r) => {
        const cliente = clientsById[r.id_cliente] || {};
        return {
          id: r.id,
          customer_name: cliente.razao || cliente.fantasia || `Cliente #${r.id_cliente}`,
          phone: cliente.fone || cliente.telefone_celular || '',
          due_date: r.data_vencimento,
          value: parseFloat(r.valor_aberto || r.valor || '0'),
          status: r.status,
          boleto: r.boleto,
          linha_digitavel: r.linha_digitavel,
        };
      });

      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'faturas', status: 'sucesso' });
      return Response.json({ success: true, result: { total: data.total, registros: faturas } });
    }

    if (action === 'faturas_cliente') {
      if (!clientId) {
        return Response.json({ error: 'clientId é obrigatório' }, { status: 400 });
      }
      const areceberUrl = baseUrl.replace(/\/$/, '') + '/fn_areceber';
      const baseBody = {
        qtype: 'fn_areceber.id_cliente',
        query: String(clientId),
        oper: '=',
        sortname: 'fn_areceber.data_vencimento',
        sortorder: 'desc',
      };
      const { ok, data, registros: rawRegistros } = await fetchAllPages(areceberUrl, baseBody, 500);
      if (!ok) {
        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'faturas_cliente', status: 'falha', details: JSON.stringify(data).slice(0, 500) });
        return Response.json({ error: 'Falha ao buscar faturas do cliente no IXC Provedor', details: data }, { status: 500 });
      }

      const faturas = rawRegistros.map((r) => ({
        id: r.id,
        due_date: r.data_vencimento,
        payment_date: r.data_pagamento,
        value: parseFloat(r.valor_aberto || r.valor || '0'),
        status: r.status,
        boleto: r.boleto,
        linha_digitavel: r.linha_digitavel,
      }));

      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'faturas_cliente', status: 'sucesso', details: `${faturas.length} registros carregados` });
      return Response.json({ success: true, result: { total: faturas.length, registros: faturas } });
    }

    if (action === 'contratos') {
      const contratoUrl = baseUrl.replace(/\/$/, '') + '/cliente_contrato';
      // Busca ativos e cancelados para permitir filtro no frontend
      // Se status foi passado pelo frontend, filtra; caso contrário traz todos
      const contratoBaseBody: Record<string, string> = {
        qtype: 'cliente_contrato.id',
        query: '1',
        oper: '>=',
        sortname: 'cliente_contrato.data_expiracao',
        sortorder: 'desc',
      };
      if (status) {
        contratoBaseBody.qtype = 'cliente_contrato.status';
        contratoBaseBody.query = status;
        contratoBaseBody.oper = '=';
      }
      if (search) {
        // busca por id_cliente se vier número, senão pelo contrato/plano
        contratoBaseBody.qtype = 'cliente_contrato.id_cliente';
        contratoBaseBody.query = search;
        contratoBaseBody.oper = 'L';
      }
      if (clientId) {
        contratoBaseBody.qtype = 'cliente_contrato.id_cliente';
        contratoBaseBody.query = String(clientId);
        contratoBaseBody.oper = '=';
      }
      const { ok, data: dataContratos, registros: rawRegistros } = await fetchAllPages(contratoUrl, contratoBaseBody);
      if (!ok) {
        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'contratos', status: 'falha', details: JSON.stringify(dataContratos).slice(0, 500) });
        return Response.json({ error: 'Falha ao buscar contratos do IXC Provedor', details: dataContratos }, { status: 500 });
      }

      const clientIds = [...new Set(rawRegistros.map((r: any) => r.id_cliente).filter(Boolean))];
      let clientsById: Record<string, any> = {};
      if (clientIds.length > 0) {
        const clientRes = await fetch(baseUrl.replace(/\/$/, '') + '/cliente', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Basic ${token}`, ixcsoft: 'listar' },
          body: JSON.stringify({ qtype: 'cliente.id', query: (clientIds as string[]).join(','), oper: 'IN', page: '1', rp: String(clientIds.length) }),
        });
        const clientData = await clientRes.json().catch(() => ({}));
        (clientData.registros || []).forEach((c: any) => { clientsById[c.id] = c; });
      }

      // Carrega mapa de cidades para resolver nomes
      const { mapa: cidadesById } = await carregarMapaCidades();

      const contratos = rawRegistros.map((r: any) => {
        const cliente = clientsById[r.id_cliente] || {};
        return {
          id: r.id,
          client_id: r.id_cliente,
          customer_name: cliente.razao || cliente.fantasia || `Cliente #${r.id_cliente}`,
          phone: cliente.fone || cliente.telefone_celular || '',
          plan_name: r.descricao_plano || r.plano || r.contrato || '',
          plan_id: r.id_plano || '',
          vendor_name: r.vendedor || r.nome_vendedor || '',
          vendor_id: r.id_vendedor || '',
          city: cidadesById[String(r.cidade || r.id_cidade || '')] || r.cidade_nome || cliente.cidade_nome || '',
          renewal_date: r.data_expiracao || r.data_vencimento_contrato || '',
          start_date: r.data_ativacao || '',
          status: r.status,
          internet_status: r.status_internet || '',
          download: r.velocidade_down || r.download || '',
          upload: r.velocidade_up || r.upload || '',
          ip: r.ip || '',
          mac: r.mac || '',
          olt: r.nome_olt || r.olt || '',
          cto: r.nome_cto || r.cto || '',
          address: [r.endereco, r.numero, r.bairro].filter(Boolean).join(', '),
        };
      });

      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'contratos', status: 'sucesso', details: `${contratos.length} registros carregados` });
      return Response.json({ success: true, result: { total: contratos.length, registros: contratos } });
    }

    if (action === 'clientes') {
      const clientesUrl = baseUrl.replace(/\/$/, '') + '/cliente';

      let baseBody;
      if (search) {
        baseBody = {
          qtype: 'cliente.razao',
          query: search,
          oper: 'L',
          sortname: 'cliente.id',
          sortorder: 'desc',
        };
      } else {
        baseBody = {
          qtype: 'cliente.id',
          query: '1',
          oper: '>=',
          sortname: 'cliente.id',
          sortorder: 'desc',
        };
      }

      const { ok, data, registros: rawRegistros } = await fetchAllPages(clientesUrl, baseBody);
      if (!ok) {
        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'clientes', status: 'falha', details: JSON.stringify(data).slice(0, 500) });
        return Response.json({ error: 'Falha ao buscar clientes do IXC Provedor', details: data }, { status: 500 });
      }

      // NOVO: carrega o mapa de cidades uma vez e resolve o nome por cliente.
      const { mapa: cidadesById } = await carregarMapaCidades();

      const clientes = rawRegistros.map((c) => ({
        id: c.id,
        name: c.razao || c.fantasia || `Cliente #${c.id}`,
        cpf_cnpj: c.cnpj_cpf,
        phone: c.telefone_celular || c.fone || '',
        email: c.email,
        // antes: c.cidade_nome (vinha vazio). Agora resolvemos pelo ID da cidade.
        city: cidadesById[String(c.cidade)] || c.cidade_nome || '',
        contract_status: c.ativo === 'S' ? 'ativo' : 'cancelado',
      }));

      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'clientes', status: 'sucesso', details: `${clientes.length} registros carregados` });
      return Response.json({ success: true, result: { total: clientes.length, registros: clientes } });
    }

    if (action === 'contatos') {
      const contatosUrl = baseUrl.replace(/\/$/, '') + '/cliente_contato';
      const baseBody = { qtype: 'cliente_contato.id', query: '1', oper: '>=', sortname: 'cliente_contato.id', sortorder: 'desc' };
      const { ok, data, registros: rawRegistros } = await fetchAllPages(contatosUrl, baseBody);
      if (!ok) {
        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'contatos', status: 'falha', details: JSON.stringify(data).slice(0, 500) });
        return Response.json({ error: 'Falha ao buscar contatos do IXC Provedor', details: data }, { status: 500 });
      }

      const contatos = rawRegistros.map((c) => ({
        id: c.id,
        client_id: c.id_cliente,
        name: c.contato || c.nome || '',
        phone: c.telefone || c.celular || '',
        email: c.email || '',
      }));

      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'contatos', status: 'sucesso', details: `${contatos.length} registros carregados` });
      return Response.json({ success: true, result: { total: contatos.length, registros: contatos } });
    }

    // ── TEST CONNECTION ────────────────────────────────────────────────────────
    if (action === 'test_connection') {
      const t0 = Date.now();
      const { res, data } = await ixcPost('cliente', { qtype: 'cliente.id', query: '1', oper: '>=', page: '1', rp: '1' });
      const ms = Date.now() - t0;
      if (!res.ok) {
        return Response.json({ success: false, error: 'Falha ao conectar ao IXC Provedor', details: `HTTP ${res.status}`, response_ms: ms });
      }
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'test_connection', status: 'sucesso', details: `${ms}ms` });
      return Response.json({ success: true, message: 'Conexão com IXCSoft estabelecida com sucesso', response_ms: ms, total_clientes: data.total || '?' });
    }

    // ── ALIASES DE BUSCA DE CLIENTE (nomes solicitados) ─────────────────────────
    if (action === 'search_customer' || action === 'search_customer_by_document') {
      const q = String(search || cpfCnpj || '').replace(/\D/g, '');
      if (!q) return Response.json({ success: false, error: 'search/cpfCnpj é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('cliente', { qtype: 'cliente.cnpj_cpf', query: q, oper: '=', page: '1', rp: '20', sortname: 'cliente.id', sortorder: 'desc' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar cliente', details: data }, { status: res.status });
      return Response.json({ success: true, data: data.registros || [], message: 'OK' });
    }

    if (action === 'search_customer_by_phone') {
      const q = String(search || '').replace(/\D/g, '');
      if (!q) return Response.json({ success: false, error: 'search é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('cliente', { qtype: 'cliente.telefone_celular', query: q, oper: 'L', page: '1', rp: '20', sortname: 'cliente.id', sortorder: 'desc' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar cliente por telefone', details: data }, { status: res.status });
      return Response.json({ success: true, data: data.registros || [], message: 'OK' });
    }

    if (action === 'search_customer_by_name') {
      const q = String(search || '');
      if (!q) return Response.json({ success: false, error: 'search é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('cliente', { qtype: 'cliente.razao', query: q, oper: 'L', page: '1', rp: '20', sortname: 'cliente.id', sortorder: 'desc' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar cliente por nome', details: data }, { status: res.status });
      return Response.json({ success: true, data: data.registros || [], message: 'OK' });
    }

    if (action === 'get_customer') {
      if (!clientId) return Response.json({ success: false, error: 'clientId é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('cliente', { qtype: 'cliente.id', query: String(clientId), oper: '=', page: '1', rp: '1' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar cliente', details: data }, { status: res.status });
      return Response.json({ success: true, data: (data.registros || [])[0] || null, message: 'OK' });
    }

    if (action === 'create_customer') {
      if (!bodyData) return Response.json({ success: false, error: 'Dados do cliente são obrigatórios' }, { status: 400 });
      const { res, data } = await ixcWrite('cliente', bodyData, 'POST');
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao criar cliente', details: data }, { status: res.status });
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'create_customer', status: 'sucesso' });
      return Response.json({ success: true, data, message: 'Cliente criado com sucesso' });
    }

    if (action === 'update_customer') {
      if (!clientId || !bodyData) return Response.json({ success: false, error: 'clientId e dados são obrigatórios' }, { status: 400 });
      const { res, data } = await ixcWrite(`cliente/${clientId}`, bodyData, 'PUT');
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao atualizar cliente', details: data }, { status: res.status });
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'update_customer', status: 'sucesso', details: `cliente ${clientId}` });
      return Response.json({ success: true, data, message: 'Cliente atualizado com sucesso' });
    }

    // ── ALIASES DE CONTRATOS ─────────────────────────────────────────────────────
    if (action === 'search_contracts' || action === 'get_customer_contracts') {
      if (!clientId) return Response.json({ success: false, error: 'clientId é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('cliente_contrato', { qtype: 'cliente_contrato.id_cliente', query: String(clientId), oper: '=', page: '1', rp: '50' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar contratos', details: data }, { status: res.status });
      return Response.json({ success: true, data: data.registros || [], message: 'OK' });
    }

    if (action === 'get_contract') {
      if (!contratoId) return Response.json({ success: false, error: 'contratoId é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('cliente_contrato', { qtype: 'cliente_contrato.id', query: String(contratoId), oper: '=', page: '1', rp: '1' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar contrato', details: data }, { status: res.status });
      return Response.json({ success: true, data: (data.registros || [])[0] || null, message: 'OK' });
    }

    // ── ALIASES DE PPPOE / RADIUS ─────────────────────────────────────────────────
    if (action === 'search_pppoe' || action === 'get_contract_pppoe') {
      const baseBody: Record<string, string> = { qtype: 'radusuarios.id', query: '1', oper: '>=', page: '1', rp: '50' };
      if (contratoId) { baseBody.qtype = 'radusuarios.id_contrato'; baseBody.query = String(contratoId); baseBody.oper = '='; }
      else if (clientId) { baseBody.qtype = 'radusuarios.id_cliente'; baseBody.query = String(clientId); baseBody.oper = '='; }
      const { res, data } = await ixcPost('radusuarios', baseBody);
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar PPPoE', details: data }, { status: res.status });
      return Response.json({ success: true, data: data.registros || [], message: 'OK' });
    }

    if (action === 'get_pppoe') {
      const { res, data } = await ixcPost('radusuarios', { qtype: 'radusuarios.id', query: String(bodyData?.id || ''), oper: '=', page: '1', rp: '1' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar PPPoE', details: data }, { status: res.status });
      return Response.json({ success: true, data: (data.registros || [])[0] || null, message: 'OK' });
    }

    // ── ALIASES DE FINANCEIRO ─────────────────────────────────────────────────────
    if (action === 'get_customer_invoices') {
      if (!clientId) return Response.json({ success: false, error: 'clientId é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('fn_areceber', { qtype: 'fn_areceber.id_cliente', query: String(clientId), oper: '=', page: '1', rp: '100', sortname: 'fn_areceber.data_vencimento', sortorder: 'desc' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar faturas', details: data }, { status: res.status });
      return Response.json({ success: true, data: data.registros || [], message: 'OK' });
    }

    if (action === 'get_open_invoices') {
      const baseBody: Record<string, string> = { qtype: 'fn_areceber.status', query: 'A', oper: '=', page: '1', rp: '100', sortname: 'fn_areceber.data_vencimento', sortorder: 'asc' };
      if (clientId) { baseBody.qtype = 'fn_areceber.id_cliente'; baseBody.query = String(clientId); baseBody.oper = '='; }
      const { res, data } = await ixcPost('fn_areceber', baseBody);
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar faturas em aberto', details: data }, { status: res.status });
      const abertas = clientId ? (data.registros || []).filter((r: any) => r.status === 'A') : (data.registros || []);
      return Response.json({ success: true, data: abertas, message: 'OK' });
    }

    if (action === 'get_overdue_invoices') {
      const hoje = new Date().toISOString().slice(0, 10);
      const baseBody: Record<string, string> = { qtype: 'fn_areceber.data_vencimento', query: hoje, oper: '<', page: '1', rp: '200', sortname: 'fn_areceber.data_vencimento', sortorder: 'asc' };
      if (clientId) { baseBody.qtype = 'fn_areceber.id_cliente'; baseBody.query = String(clientId); baseBody.oper = '='; }
      const { res, data } = await ixcPost('fn_areceber', baseBody);
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar faturas vencidas', details: data }, { status: res.status });
      const vencidas = (data.registros || []).filter((r: any) => r.status === 'A');
      return Response.json({ success: true, data: vencidas, message: 'OK' });
    }

    if (action === 'get_invoice') {
      const invoiceId = bodyData?.id || search;
      if (!invoiceId) return Response.json({ success: false, error: 'id da fatura é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('fn_areceber', { qtype: 'fn_areceber.id', query: String(invoiceId), oper: '=', page: '1', rp: '1' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar fatura', details: data }, { status: res.status });
      return Response.json({ success: true, data: (data.registros || [])[0] || null, message: 'OK' });
    }

    if (action === 'get_second_copy' || action === 'get_boleto' || action === 'get_pix' || action === 'get_payment_link') {
      if (!clientId) return Response.json({ success: false, error: 'clientId é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('fn_areceber', { qtype: 'fn_areceber.id_cliente', query: String(clientId), oper: '=', sortname: 'fn_areceber.data_vencimento', sortorder: 'desc', page: '1', rp: '10' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar fatura para segunda via', details: data }, { status: res.status });
      const abertos = (data.registros || []).filter((r: any) => r.status === 'A');
      const faturas = abertos.map((r: any) => ({
        id: r.id, due_date: r.data_vencimento, value: parseFloat(r.valor_aberto || r.valor || '0'),
        boleto: r.boleto || '', linha_digitavel: r.linha_digitavel || '', pix_code: r.pix_qrcode || r.pix || '',
      }));
      return Response.json({ success: true, data: faturas, message: `${faturas.length} fatura(s) em aberto` });
    }

    // ── ALIASES DE TICKETS / PROTOCOLOS (atendimento) ───────────────────────────
    if (action === 'search_tickets' || action === 'search_protocols') {
      const pg = Number(page) || 1; const lim = Number(limit) || 60;
      const baseBody: Record<string, string> = { qtype: 'atendimento.id', query: '1', oper: '>=', sortname: 'atendimento.data_abertura', sortorder: 'desc', page: String(pg), rp: String(lim) };
      if (status) { baseBody.qtype = 'atendimento.status'; baseBody.query = status; baseBody.oper = '='; }
      const { res, data } = await ixcPost('atendimento', baseBody);
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar tickets/protocolos', details: data }, { status: res.status });
      return Response.json({ success: true, data: data.registros || [], message: 'OK' });
    }

    if (action === 'get_ticket' || action === 'get_protocol') {
      if (!osId) return Response.json({ success: false, error: 'osId é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('atendimento', { qtype: 'atendimento.id', query: String(osId), oper: '=', page: '1', rp: '1' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar ticket/protocolo', details: data }, { status: res.status });
      return Response.json({ success: true, data: (data.registros || [])[0] || null, message: 'OK' });
    }

    if (action === 'open_ticket' || action === 'open_protocol') {
      if (!bodyData) return Response.json({ success: false, error: 'Dados são obrigatórios' }, { status: 400 });
      const { res, data } = await ixcWrite('atendimento', bodyData, 'POST');
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao abrir ticket/protocolo', details: data }, { status: res.status });
      return Response.json({ success: true, data, message: 'Aberto com sucesso' });
    }

    if (action === 'update_ticket' || action === 'update_protocol') {
      if (!osId || !bodyData) return Response.json({ success: false, error: 'osId e dados são obrigatórios' }, { status: 400 });
      const { res, data } = await ixcWrite(`atendimento/${osId}`, bodyData, 'PUT');
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao atualizar ticket/protocolo', details: data }, { status: res.status });
      return Response.json({ success: true, data, message: 'Atualizado com sucesso' });
    }

    if (action === 'close_ticket' || action === 'close_protocol') {
      if (!osId) return Response.json({ success: false, error: 'osId é obrigatório' }, { status: 400 });
      const { res, data } = await ixcWrite(`atendimento/${osId}`, { ...(bodyData || {}), status: 'F' }, 'PUT');
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao fechar ticket/protocolo', details: data }, { status: res.status });
      return Response.json({ success: true, data, message: 'Fechado com sucesso' });
    }

    if (action === 'get_customer_tickets') {
      if (!clientId) return Response.json({ success: false, error: 'clientId é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('atendimento', { qtype: 'atendimento.id_cliente', query: String(clientId), oper: '=', sortname: 'atendimento.data_abertura', sortorder: 'desc', page: '1', rp: '50' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar tickets do cliente', details: data }, { status: res.status });
      return Response.json({ success: true, data: data.registros || [], message: 'OK' });
    }

    // ── ALIASES DE PLANOS ────────────────────────────────────────────────────────
    if (action === 'get_plans' || action === 'search_plans') {
      const baseBody: Record<string, string> = { qtype: 'plano.id', query: '1', oper: '>=', sortname: 'plano.nome', sortorder: 'asc' };
      if (search) { baseBody.qtype = 'plano.nome'; baseBody.query = search; baseBody.oper = 'L'; }
      const { ok, registros } = await fetchAllPages(baseUrl.replace(/\/$/, '') + '/plano', baseBody, 500);
      if (!ok) return Response.json({ success: false, error: 'Falha ao buscar planos' }, { status: 500 });
      return Response.json({ success: true, data: registros, message: 'OK' });
    }

    if (action === 'get_plan') {
      const planId = bodyData?.id || search;
      if (!planId) return Response.json({ success: false, error: 'id do plano é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('plano', { qtype: 'plano.id', query: String(planId), oper: '=', page: '1', rp: '1' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar plano', details: data }, { status: res.status });
      return Response.json({ success: true, data: (data.registros || [])[0] || null, message: 'OK' });
    }

    // ── ALIASES DE ENDEREÇO / RISCO ──────────────────────────────────────────────
    if (action === 'search_address_history' || action === 'search_contracts_by_address' || action === 'search_last_customer_by_address') {
      const endereco = String(search || bodyData?.endereco || '');
      if (!endereco) return Response.json({ success: false, error: 'search (endereço) é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('cliente_contrato', { qtype: 'cliente_contrato.endereco', query: endereco, oper: 'L', sortname: 'cliente_contrato.data_ativacao', sortorder: 'desc', page: '1', rp: '20' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar histórico de endereço', details: data }, { status: res.status });
      const registros = data.registros || [];
      if (action === 'search_last_customer_by_address') {
        return Response.json({ success: true, data: registros[0] || null, message: registros.length ? 'OK' : 'Nenhum contrato encontrado para este endereço' });
      }
      return Response.json({ success: true, data: registros, message: 'OK' });
    }

    if (action === 'search_invoices_by_contract') {
      if (!contratoId) return Response.json({ success: false, error: 'contratoId é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('fn_areceber', { qtype: 'fn_areceber.id_contrato', query: String(contratoId), oper: '=', sortname: 'fn_areceber.data_vencimento', sortorder: 'desc', page: '1', rp: '100' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar faturas do contrato', details: data }, { status: res.status });
      return Response.json({ success: true, data: data.registros || [], message: 'OK' });
    }

    if (action === 'check_customer_is_active') {
      if (!clientId) return Response.json({ success: false, error: 'clientId é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('cliente', { qtype: 'cliente.id', query: String(clientId), oper: '=', page: '1', rp: '1' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao verificar cliente', details: data }, { status: res.status });
      const cliente = (data.registros || [])[0];
      return Response.json({ success: true, data: { is_active: cliente?.ativo === 'S' }, message: 'OK' });
    }

    if (action === 'check_customer_was_customer') {
      const q = String(search || cpfCnpj || '').replace(/\D/g, '');
      if (!q) return Response.json({ success: false, error: 'search/cpfCnpj é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('cliente', { qtype: 'cliente.cnpj_cpf', query: q, oper: '=', page: '1', rp: '1' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao verificar histórico do cliente', details: data }, { status: res.status });
      const cliente = (data.registros || [])[0];
      return Response.json({ success: true, data: { was_customer: !!cliente, is_active_now: cliente?.ativo === 'S' }, message: 'OK' });
    }

    if (action === 'check_financial_risk') {
      if (!clientId) return Response.json({ success: false, error: 'clientId é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('fn_areceber', { qtype: 'fn_areceber.id_cliente', query: String(clientId), oper: '=', sortname: 'fn_areceber.data_vencimento', sortorder: 'desc', page: '1', rp: '100' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao verificar risco financeiro', details: data }, { status: res.status });
      const hoje = new Date().setHours(0, 0, 0, 0);
      const vencidas = (data.registros || []).filter((r: any) => r.status === 'A' && r.data_vencimento && new Date(r.data_vencimento).getTime() < hoje);
      const risk = vencidas.length === 0 ? 'baixo' : vencidas.length <= 2 ? 'medio' : 'alto';
      return Response.json({ success: true, data: { risk, overdue_count: vencidas.length }, message: 'OK' });
    }

    // ── CONTRATO POR ID ────────────────────────────────────────────────────────
    if (action === 'contrato_por_id') {
      if (!contratoId) return Response.json({ success: false, error: 'contratoId é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('cliente_contrato', { qtype: 'cliente_contrato.id', query: String(contratoId), oper: '=', page: '1', rp: '1' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar contrato', details: data }, { status: res.status });
      const raw = (data.registros || [])[0];
      if (!raw) return Response.json({ success: true, data: null, message: 'Contrato não encontrado' });
      const { mapa: cidadesById } = await carregarMapaCidades();
      const contrato = {
        id: raw.id, client_id: raw.id_cliente,
        plan_name: raw.descricao_plano || raw.plano || '', plan_id: raw.id_plano,
        vendor_name: raw.vendedor || '', vendor_id: raw.id_vendedor,
        city: cidadesById[String(raw.cidade || raw.id_cidade)] || raw.cidade_nome || '',
        status: raw.status === 'A' ? 'ativo' : raw.status === 'CA' ? 'cancelado' : raw.status,
        internet_status: raw.status_internet || '',
        start_date: raw.data_ativacao, end_date: raw.data_vencimento_contrato || raw.data_expiracao,
        ip: raw.ip || '', mac: raw.mac || '',
        olt: raw.nome_olt || raw.olt || '', cto: raw.nome_cto || raw.cto || '',
        address: [raw.endereco, raw.numero, raw.bairro].filter(Boolean).join(', '),
        download: raw.download || '', upload: raw.upload || '',
      };
      return Response.json({ success: true, data: contrato, message: 'OK' });
    }

    // ── PLANOS ─────────────────────────────────────────────────────────────────
    if (action === 'planos') {
      const baseBody: Record<string, string> = { qtype: 'plano.id', query: '1', oper: '>=', sortname: 'plano.nome', sortorder: 'asc' };
      if (search) { baseBody.qtype = 'plano.nome'; baseBody.query = search; baseBody.oper = 'L'; }
      const { ok, registros } = await fetchAllPages(baseUrl.replace(/\/$/, '') + '/plano', baseBody, 500);
      if (!ok) return Response.json({ success: false, error: 'Falha ao buscar planos do IXC Provedor' }, { status: 500 });
      const planos = registros.map((r: any) => ({
        id: r.id,
        name: r.nome || r.descricao || `Plano #${r.id}`,
        download: r.velocidade_down || r.download || '',
        upload: r.velocidade_up || r.upload || '',
        price: parseFloat(r.valor || '0'),
        active: r.ativo === 'S',
        type: r.tipo_plano || r.tecnologia || '',
        fidelity: r.fidelidade || '',
        total_contratos: 0,
      }));
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'planos', status: 'sucesso', details: `${planos.length} planos` });
      return Response.json(paginate(planos, planos.length));
    }

    // ── VENDEDORES ─────────────────────────────────────────────────────────────
    if (action === 'vendedores') {
      const baseBody: Record<string, string> = { qtype: 'vendedor.id', query: '1', oper: '>=', sortname: 'vendedor.nome', sortorder: 'asc' };
      if (search) { baseBody.qtype = 'vendedor.nome'; baseBody.query = search; baseBody.oper = 'L'; }
      const { ok, registros } = await fetchAllPages(baseUrl.replace(/\/$/, '') + '/vendedor', baseBody, 500);
      if (!ok) return Response.json({ success: false, error: 'Falha ao buscar vendedores' }, { status: 500 });
      const vendedores = registros.map((r: any) => ({
        id: r.id, name: r.nome || `Vendedor #${r.id}`,
        email: r.email || '', phone: r.fone || r.telefone || '',
        active: r.ativo === 'S', cpf: r.cpf || '',
      }));
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'vendedores', status: 'sucesso', details: `${vendedores.length} vendedores` });
      return Response.json(paginate(vendedores, vendedores.length));
    }

    // ── TÍTULOS FINANCEIROS ────────────────────────────────────────────────────
    if (action === 'titulos') {
      const pg = Number(page) || 1; const lim = Number(limit) || 60;
      const baseBody: Record<string, string> = {
        qtype: 'fn_areceber.id', query: '1', oper: '>=',
        sortname: 'fn_areceber.data_vencimento', sortorder: 'desc',
        page: String(pg), rp: String(lim),
      };
      if (status) { baseBody.qtype = 'fn_areceber.status'; baseBody.query = status; baseBody.oper = '='; }
      if (startDate) { baseBody.qtype = 'fn_areceber.data_vencimento'; baseBody.query = startDate; baseBody.oper = '>='; }
      const { res, data } = await ixcPost('fn_areceber', baseBody);
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar títulos', details: data }, { status: res.status });
      const registros = (data.registros || []).map((r: any) => ({
        id: r.id, client_id: r.id_cliente, contract_id: r.id_contrato,
        value: parseFloat(r.valor_aberto || r.valor || '0'),
        due_date: r.data_vencimento, payment_date: r.data_pagamento,
        status: r.status === 'P' ? 'pago' : r.status === 'A' ? 'aberto' : r.status,
        boleto: r.boleto || '', linha_digitavel: r.linha_digitavel || '',
        pix_code: r.pix_qrcode || r.pix || '',
        nome_cliente: r.nome_cliente || `Cliente #${r.id_cliente}`,
      }));
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'titulos', status: 'sucesso' });
      return Response.json(paginate(registros, data.total || registros.length, pg, lim));
    }

    // ── INADIMPLENTES ──────────────────────────────────────────────────────────
    if (action === 'inadimplentes') {
      const hoje = new Date().toISOString().slice(0, 10);
      const pg = Number(page) || 1; const lim = Number(limit) || 60;
      const baseBody: Record<string, string> = {
        qtype: 'fn_areceber.data_vencimento',
        query: hoje, oper: '<',
        sortname: 'fn_areceber.data_vencimento', sortorder: 'asc',
        page: String(pg), rp: String(lim),
      };
      const { res, data } = await ixcPost('fn_areceber', baseBody);
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar inadimplentes', details: data }, { status: res.status });

      const rawList = (data.registros || []).filter((r: any) => r.status === 'A');
      const clientIds = [...new Set(rawList.map((r: any) => r.id_cliente).filter(Boolean))];
      let clientsById: Record<string, any> = {};
      if (clientIds.length > 0) {
        const cr = await ixcPost('cliente', { qtype: 'cliente.id', query: (clientIds as string[]).join(','), oper: 'IN', page: '1', rp: String(clientIds.length) });
        (cr.data.registros || []).forEach((c: any) => { clientsById[c.id] = c; });
      }

      const todayMs = new Date().setHours(0, 0, 0, 0);
      const inadimplentes = rawList.map((r: any) => {
        const c = clientsById[r.id_cliente] || {};
        const venc = r.data_vencimento ? new Date(r.data_vencimento).getTime() : 0;
        const dias = venc ? Math.floor((todayMs - venc) / 86_400_000) : 0;
        return {
          id: r.id, client_id: r.id_cliente,
          client_name: c.razao || c.fantasia || r.nome_cliente || `Cliente #${r.id_cliente}`,
          phone: c.telefone_celular || c.fone || '',
          city: c.cidade_nome || '',
          value: parseFloat(r.valor_aberto || r.valor || '0'),
          due_date: r.data_vencimento, days_late: dias,
          boleto: r.boleto || '', linha_digitavel: r.linha_digitavel || '',
          pix_code: r.pix_qrcode || r.pix || '',
          status: 'vencido',
          faixa: dias <= 7 ? '1-7d' : dias <= 15 ? '8-15d' : dias <= 30 ? '16-30d' : dias <= 60 ? '31-60d' : '+60d',
        };
      });

      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'inadimplentes', status: 'sucesso', details: `${inadimplentes.length} inadimplentes` });
      return Response.json(paginate(inadimplentes, data.total || inadimplentes.length, pg, lim));
    }

    // ── SEGUNDA VIA ────────────────────────────────────────────────────────────
    if (action === 'segunda_via') {
      if (!clientId) return Response.json({ success: false, error: 'clientId é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('fn_areceber', {
        qtype: 'fn_areceber.id_cliente', query: String(clientId), oper: '=',
        sortname: 'fn_areceber.data_vencimento', sortorder: 'desc', page: '1', rp: '10',
      });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar faturas para segunda via', details: data }, { status: res.status });
      const abertos = (data.registros || []).filter((r: any) => r.status === 'A');
      const faturas = abertos.map((r: any) => ({
        id: r.id, due_date: r.data_vencimento,
        value: parseFloat(r.valor_aberto || r.valor || '0'),
        boleto: r.boleto || '', linha_digitavel: r.linha_digitavel || '',
        pix_code: r.pix_qrcode || r.pix || '',
      }));
      return Response.json({ success: true, data: faturas, message: `${faturas.length} fatura(s) em aberto` });
    }

    // ── ORDENS DE SERVIÇO ──────────────────────────────────────────────────────
    if (action === 'os') {
      const pg = Number(page) || 1; const lim = Number(limit) || 60;
      const baseBody: Record<string, string> = {
        qtype: 'atendimento.id', query: '1', oper: '>=',
        sortname: 'atendimento.data_abertura', sortorder: 'desc',
        page: String(pg), rp: String(lim),
      };
      if (status) { baseBody.qtype = 'atendimento.status'; baseBody.query = status; baseBody.oper = '='; }
      if (search) { baseBody.qtype = 'atendimento.assunto'; baseBody.query = search; baseBody.oper = 'L'; }
      if (clientId) { baseBody.qtype = 'atendimento.id_cliente'; baseBody.query = String(clientId); baseBody.oper = '='; }
      const { res, data } = await ixcPost('atendimento', baseBody);
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar ordens de serviço', details: data }, { status: res.status });
      const os = (data.registros || []).map((r: any) => ({
        id: r.id, client_id: r.id_cliente, client_name: r.nome_cliente || `Cliente #${r.id_cliente}`,
        contract_id: r.id_contrato || '',
        subject: r.assunto || r.tipo || '', description: r.descricao || '',
        solution: r.solucao || '', status: r.status || '', tech_name: r.nome_tecnico || r.tecnico || '',
        open_date: r.data_abertura, scheduled_date: r.data_atendimento || r.data_agendamento || '',
        close_date: r.data_fechamento || '', priority: r.prioridade || '',
        city: r.cidade || '', address: [r.endereco, r.numero, r.bairro].filter(Boolean).join(', '),
        phone: r.fone_cliente || r.telefone || '',
      }));
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'os', status: 'sucesso' });
      return Response.json(paginate(os, data.total || os.length, pg, lim));
    }

    if (action === 'os_por_id') {
      if (!osId) return Response.json({ success: false, error: 'osId é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('atendimento', { qtype: 'atendimento.id', query: String(osId), oper: '=', page: '1', rp: '1' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar OS', details: data }, { status: res.status });
      const r = (data.registros || [])[0];
      if (!r) return Response.json({ success: false, error: 'OS não encontrada' }, { status: 404 });
      return Response.json({ success: true, data: r, message: 'OK' });
    }

    if (action === 'os_create') {
      if (!bodyData) return Response.json({ success: false, error: 'Dados da OS são obrigatórios' }, { status: 400 });
      const required = ['id_cliente', 'assunto'];
      const missing = required.filter(f => !bodyData[f]);
      if (missing.length > 0) return Response.json({ success: false, error: `Campos obrigatórios ausentes: ${missing.join(', ')}` }, { status: 400 });
      const { res, data } = await ixcWrite('atendimento', bodyData, 'POST');
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao criar OS', details: data }, { status: res.status });
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'os_create', status: 'sucesso', details: JSON.stringify(data).slice(0, 200) });
      return Response.json({ success: true, data, message: 'OS criada com sucesso' });
    }

    if (action === 'os_update') {
      if (!osId || !bodyData) return Response.json({ success: false, error: 'osId e dados são obrigatórios' }, { status: 400 });
      const { res, data } = await ixcWrite(`atendimento/${osId}`, bodyData, 'PUT');
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao atualizar OS', details: data }, { status: res.status });
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'os_update', status: 'sucesso', details: `OS ${osId}` });
      return Response.json({ success: true, data, message: 'OS atualizada com sucesso' });
    }

    // ── ATENDIMENTOS ───────────────────────────────────────────────────────────
    if (action === 'atendimentos') {
      const pg = Number(page) || 1; const lim = Number(limit) || 60;
      const baseBody: Record<string, string> = {
        qtype: 'atendimento.id', query: '1', oper: '>=',
        sortname: 'atendimento.data_abertura', sortorder: 'desc',
        page: String(pg), rp: String(lim),
      };
      if (status) { baseBody.qtype = 'atendimento.status'; baseBody.query = status; baseBody.oper = '='; }
      const { res, data } = await ixcPost('atendimento', baseBody);
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar atendimentos', details: data }, { status: res.status });
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'atendimentos', status: 'sucesso' });
      return Response.json(paginate(data.registros || [], data.total || 0, pg, lim));
    }

    // ── DASHBOARD ──────────────────────────────────────────────────────────────
    if (action === 'dashboard') {
      const hoje = new Date().toISOString().slice(0, 10);
      const mesAtual = hoje.slice(0, 7);

      // Todas as chamadas em paralelo para reduzir latência
      const [clientesRes, contratosRes, titulosRes, osAbertas] = await Promise.allSettled([
        ixcPost('cliente', { qtype: 'cliente.ativo', query: 'S', oper: '=', page: '1', rp: '1' }),
        ixcPost('cliente_contrato', { qtype: 'cliente_contrato.status', query: 'A', oper: '=', page: '1', rp: '1' }),
        ixcPost('fn_areceber', { qtype: 'fn_areceber.status', query: 'A', oper: '=', page: '1', rp: '1', sortname: 'fn_areceber.data_vencimento', sortorder: 'asc' }),
        ixcPost('atendimento', { qtype: 'atendimento.status', query: 'A', oper: '=', page: '1', rp: '1' }),
      ]);

      const totalAtivos    = (clientesRes.status === 'fulfilled' && clientesRes.value.res.ok) ? parseInt(clientesRes.value.data.total || '0') : 0;
      const totalContratos = (contratosRes.status === 'fulfilled' && contratosRes.value.res.ok) ? parseInt(contratosRes.value.data.total || '0') : 0;
      const titulosAbertos = (titulosRes.status === 'fulfilled' && titulosRes.value.res.ok) ? parseInt(titulosRes.value.data.total || '0') : 0;
      const osCount        = (osAbertas.status === 'fulfilled' && osAbertas.value.res.ok) ? parseInt(osAbertas.value.data.total || '0') : 0;

      // Valor vencido (faturas A com vencimento < hoje)
      const vencidoRes = await ixcPost('fn_areceber', { qtype: 'fn_areceber.data_vencimento', query: hoje, oper: '<', page: '1', rp: '200', sortname: 'fn_areceber.data_vencimento', sortorder: 'asc' });
      const vencidos = (vencidoRes.data.registros || []).filter((r: any) => r.status === 'A');
      const valorVencido = vencidos.reduce((s: number, r: any) => s + parseFloat(r.valor_aberto || r.valor || '0'), 0);

      // Novos clientes no mês
      const novosRes = await ixcPost('cliente', { qtype: 'cliente.data_cadastro', query: `${mesAtual}-01`, oper: '>=', page: '1', rp: '1' });
      const novosMes = (novosRes.res.ok) ? parseInt(novosRes.data.total || '0') : 0;

      const dashboard = {
        clientes_ativos:       totalAtivos,
        contratos_ativos:      totalContratos,
        novos_clientes_mes:    novosMes,
        titulos_abertos:       titulosAbertos,
        os_abertas:            osCount,
        valor_vencido:         valorVencido,
        inadimplentes:         vencidos.length,
        taxa_inadimplencia:    totalContratos > 0 ? Math.round((vencidos.length / totalContratos) * 100 * 10) / 10 : 0,
        // Campos que dependem de integrações externas (NOC, RADIUS, OLT) — aguardando
        clientes_offline:      null,
        clientes_sinal_ruim:   null,
      };

      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'dashboard', status: 'sucesso' });
      return Response.json({ success: true, data: dashboard, message: 'OK' });
    }

    // ── NOC — OFFLINE ──────────────────────────────────────────────────────────
    if (action === 'noc_offline') {
      // IXCSoft suspende contratos com status_internet = 'S' (suspenso por inadimplência)
      // ou status 'I' (inativo). Clientes tecnicamente offline dependem de integração RADIUS/OLT.
      // Por ora, retornamos contratos suspensos/inativos como proxy de "offline".
      const { res, data } = await ixcPost('cliente_contrato', {
        qtype: 'cliente_contrato.status_internet', query: 'S', oper: '=',
        sortname: 'cliente_contrato.id', sortorder: 'desc', page: String(page), rp: String(limit),
      });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar clientes offline', details: data }, { status: res.status });

      const clientIds = [...new Set((data.registros || []).map((r: any) => r.id_cliente).filter(Boolean))];
      let clientsById: Record<string, any> = {};
      if (clientIds.length > 0) {
        const cr = await ixcPost('cliente', { qtype: 'cliente.id', query: (clientIds as string[]).join(','), oper: 'IN', page: '1', rp: String(clientIds.length) });
        (cr.data.registros || []).forEach((c: any) => { clientsById[c.id] = c; });
      }

      const { mapa: cidadesById } = await carregarMapaCidades();
      const offline = (data.registros || []).map((r: any) => {
        const c = clientsById[r.id_cliente] || {};
        return {
          contract_id: r.id, client_id: r.id_cliente,
          client_name: c.razao || c.fantasia || `Cliente #${r.id_cliente}`,
          phone: c.telefone_celular || c.fone || '',
          city: cidadesById[String(r.cidade || r.id_cidade)] || r.cidade_nome || c.cidade_nome || '',
          plan_name: r.descricao_plano || r.plano || '',
          olt: r.nome_olt || r.olt || '',
          cto: r.nome_cto || r.cto || '',
          status_internet: r.status_internet || '',
          ip: r.ip || '', mac: r.mac || '',
          // tempo offline: requer integração RADIUS — pendente
          offline_since: null,
        };
      });

      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'noc_offline', status: 'sucesso', details: `${offline.length} contratos suspensos` });
      return Response.json(paginate(offline, data.total || offline.length));
    }

    if (action === 'noc_sinal_ruim') {
      // Sinal óptico ruim requer integração OLT/Zabbix.
      // Por enquanto retorna contratos com alerta de sinal (campo signal_level se disponível no IXC).
      // Documentado como pendente de integração OLT.
      return Response.json({
        success: true, data: [],
        pagination: { page: 1, limit: 60, total: 0 },
        message: 'Módulo NOC — sinal ruim requer integração com OLT/RADIUS/Zabbix. Pendente de configuração.',
        pending: true,
      });
    }

    if (action === 'noc_cliente') {
      if (!clientId) return Response.json({ success: false, error: 'clientId é obrigatório' }, { status: 400 });
      const [clienteRes, contratosRes2] = await Promise.all([
        ixcPost('cliente', { qtype: 'cliente.id', query: String(clientId), oper: '=', page: '1', rp: '1' }),
        ixcPost('cliente_contrato', { qtype: 'cliente_contrato.id_cliente', query: String(clientId), oper: '=', page: '1', rp: '10' }),
      ]);
      const cliente = (clienteRes.data.registros || [])[0] || null;
      const contratos = contratosRes2.data.registros || [];
      return Response.json({ success: true, data: { cliente, contratos }, message: 'OK' });
    }

    if (action === 'noc_contrato') {
      if (!contratoId) return Response.json({ success: false, error: 'contratoId é obrigatório' }, { status: 400 });
      const { res, data } = await ixcPost('cliente_contrato', { qtype: 'cliente_contrato.id', query: String(contratoId), oper: '=', page: '1', rp: '1' });
      if (!res.ok) return Response.json({ success: false, error: 'Falha ao buscar contrato NOC', details: data }, { status: res.status });
      const contrato = (data.registros || [])[0] || null;
      return Response.json({ success: true, data: contrato, message: 'OK' });
    }

    // ── FALLBACK (compatibilidade legada) ──────────────────────────────────────
    const body = cpfCnpj
      ? { qtype: 'cliente.cnpj_cpf', query: cpfCnpj, oper: '=', page: '1', rp: '1' }
      : { qtype: 'cliente.id', query: '1', oper: '>=', page: '1', rp: '1' };

    const url = baseUrl.replace(/\/$/, '') + '/cliente';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${token}`,
        ixcsoft: 'listar',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      return Response.json({ error: 'Falha ao conectar ao IXC Provedor', details: data }, { status: res.status });
    }

    await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: action || 'cliente', status: 'sucesso' });
    return Response.json({ success: true, result: data });
  } catch (error) {
    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.ErrorLog.create({ function_name: 'ixcApi', error_message: error.message }).catch(() => {});
    return Response.json({ error: error.message }, { status: 500 });
  }
});