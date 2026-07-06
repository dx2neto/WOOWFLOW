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

    const { cpfCnpj, action, search, clientId } = await req.json().catch(() => ({}));

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
      const baseBody = {
        qtype: 'cliente_contrato.status',
        query: 'A',
        oper: '=',
        sortname: 'cliente_contrato.data_expiracao',
        sortorder: 'asc',
      };
      const { ok, data, registros: rawRegistros } = await fetchAllPages(contratoUrl, baseBody);
      if (!ok) {
        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'contratos', status: 'falha', details: JSON.stringify(data).slice(0, 500) });
        return Response.json({ error: 'Falha ao buscar contratos do IXC Provedor', details: data }, { status: 500 });
      }

      const clientIds = [...new Set(rawRegistros.map((r) => r.id_cliente).filter(Boolean))];
      let clientsById = {};
      if (clientIds.length > 0) {
        const clientRes = await fetch(baseUrl.replace(/\/$/, '') + '/cliente', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Basic ${token}`, ixcsoft: 'listar' },
          body: JSON.stringify({ qtype: 'cliente.id', query: clientIds.join(','), oper: 'IN', page: '1', rp: String(clientIds.length) }),
        });
        const clientData = await clientRes.json().catch(() => ({}));
        (clientData.registros || []).forEach((c) => { clientsById[c.id] = c; });
      }

      const contratos = rawRegistros.map((r) => {
        const cliente = clientsById[r.id_cliente] || {};
        return {
          id: r.id,
          customer_name: cliente.razao || cliente.fantasia || `Cliente #${r.id_cliente}`,
          phone: cliente.fone || cliente.telefone_celular || '',
          plan_name: r.contrato || r.plano || '',
          renewal_date: r.data_expiracao,
          status: r.status,
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