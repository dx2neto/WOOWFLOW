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

    const { cpfCnpj } = await req.json().catch(() => ({}));

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

    return Response.json({ success: true, result: data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});