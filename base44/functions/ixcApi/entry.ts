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

    const { cpfCnpj, action } = await req.json().catch(() => ({}));

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