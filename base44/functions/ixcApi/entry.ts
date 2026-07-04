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

    const { cpfCnpj, action, search } = await req.json().catch(() => ({}));

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

      const clientes = rawRegistros.map((c) => ({
        id: c.id,
        name: c.razao || c.fantasia || `Cliente #${c.id}`,
        cpf_cnpj: c.cnpj_cpf,
        phone: c.telefone_celular || c.fone || '',
        email: c.email,
        city: c.cidade_nome || '',
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