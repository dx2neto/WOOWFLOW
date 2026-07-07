import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiUrl = Deno.env.get('SERASA_API_URL');
    const chaveAcesso = Deno.env.get('SERASA_CHAVE_ACESSO');
    if (!apiUrl || !chaveAcesso) {
      return Response.json({ error: 'Credenciais do ValidaCadastro/Serasa não configuradas' }, { status: 500 });
    }

    const { cpfCnpj, tipoPessoa } = await req.json().catch(() => ({}));

    const doc = String(cpfCnpj || '').replace(/\D/g, '');
    if (!doc) {
      return Response.json({ error: 'cpfCnpj é obrigatório' }, { status: 400 });
    }

    const payload = {
      CodigoProduto: '630',
      Versao: '20180521',
      ChaveAcesso: chaveAcesso,
      Info: { Solicitante: 'Atendimento 360 ISP' },
      Parametros: {
        TipoPessoa: tipoPessoa || (doc.length > 11 ? 'J' : 'F'),
        CPFCNPJ: doc,
      },
      WebHook: { UrlCallBack: '' },
    };

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'serasaApi', action: 'consulta', status: 'falha', details: JSON.stringify(data).slice(0, 500) });
      return Response.json({ error: 'Falha ao consultar o ValidaCadastro/Serasa', details: data }, { status: res.status });
    }

    await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'serasaApi', action: 'consulta', status: 'sucesso' });
    return Response.json({ success: true, result: data });
  } catch (error) {
    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.ErrorLog.create({ function_name: 'serasaApi', error_message: error.message }).catch(() => {});
    return Response.json({ error: error.message }, { status: 500 });
  }
});
