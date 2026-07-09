import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Normaliza a resposta do ValidaCadastro/Serasa em um status interno padronizado.
function normalizeStatus(data: Record<string, unknown>): string {
  const raw = JSON.stringify(data).toLowerCase();
  if (raw.includes('restricao') || raw.includes('negativado') || raw.includes('inadimplente')) return 'rejected';
  if (raw.includes('alerta') || raw.includes('atencao') || raw.includes('pendencia')) return 'approved_with_warning';
  if (raw.includes('analise') || raw.includes('revisao manual')) return 'manual_review';
  return 'approved';
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiUrl = Deno.env.get('SERASA_API_URL');
    const chaveAcesso = Deno.env.get('SERASA_CHAVE_ACESSO');
    if (!apiUrl || !chaveAcesso) {
      return Response.json({ error: 'Credenciais do ValidaCadastro/Serasa não configuradas' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const { cpfCnpj, tipoPessoa, action } = body;

    const doc = String(cpfCnpj || '').replace(/\D/g, '');
    if (!doc) {
      return Response.json({ error: 'cpfCnpj é obrigatório' }, { status: 400 });
    }

    // Mapeia as actions solicitadas para o TipoPessoa correto do ValidaCadastro
    const actionType: Record<string, string> = {
      validate_cpf: 'F',
      validate_cnpj: 'J',
    };
    const resolvedTipoPessoa = tipoPessoa || actionType[action] || (doc.length > 11 ? 'J' : 'F');

    // Todas as actions (validate_document, validate_customer, check_document, get_credit_analysis)
    // usam o mesmo endpoint de consulta do ValidaCadastro — apenas variam no uso do resultado.
    const payload = {
      CodigoProduto: '630',
      Versao: '20180521',
      ChaveAcesso: chaveAcesso,
      Info: { Solicitante: 'CONNECT_TELECOM' },
      Parametros: {
        TipoPessoa: resolvedTipoPessoa,
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
      await base44.asServiceRole.entities.IntegrationLog.create({
        integration: 'serasaApi', action: action || 'validate_document', status: 'falha',
        details: `HTTP ${res.status}`,
      });
      return Response.json({ success: false, status: 'error', error: 'Falha ao consultar o ValidaCadastro/Serasa' }, { status: res.status });
    }

    const normalized = normalizeStatus(data);
    await base44.asServiceRole.entities.IntegrationLog.create({
      integration: 'serasaApi', action: action || 'validate_document', status: 'sucesso',
      details: `documento consultado — resultado: ${normalized}`,
    });
    return Response.json({ success: true, status: normalized, result: data });
  } catch (error) {
    await base44.asServiceRole.entities.ErrorLog.create({ function_name: 'serasaApi', error_message: (error as Error).message }).catch(() => {});
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});