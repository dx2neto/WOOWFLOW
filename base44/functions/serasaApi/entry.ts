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

    const payload = {
      CodigoProduto: '630',
      Versao: '20180521',
      ChaveAcesso: chaveAcesso,
      Info: { Solicitante: 'Atendimento 360 ISP' },
      Parametros: {
        TipoPessoa: tipoPessoa || 'J',
        CPFCNPJ: cpfCnpj || '77973317000139',
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
      return Response.json({ error: 'Falha ao consultar o ValidaCadastro/Serasa', details: data }, { status: res.status });
    }

    return Response.json({ success: true, result: data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});