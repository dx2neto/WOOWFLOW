import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { callWithLogging, getIntegration } from '../../shared/integrationHub.ts';

const ACTION_MAP: Record<string, { resourcePath: string; call: string }> = {
  listClientes: { resourcePath: 'geral/clientes', call: 'ListarClientes' },
  incluirCliente: { resourcePath: 'geral/clientes', call: 'IncluirCliente' },
  alterarCliente: { resourcePath: 'geral/clientes', call: 'AlterarCliente' },
  upsertCliente: { resourcePath: 'geral/clientes', call: 'UpsertCliente' },
  excluirCliente: { resourcePath: 'geral/clientes', call: 'ExcluirCliente' },
  listarContasReceber: { resourcePath: 'financas/contareceber', call: 'ListarContasReceber' },
  incluirContaReceber: { resourcePath: 'financas/contareceber', call: 'IncluirContaReceber' },
  listarServicos: { resourcePath: 'servicos/servico', call: 'ListarServicoCadastro' },
  incluirServico: { resourcePath: 'servicos/servico', call: 'IncluirServico' },
  incluirOS: { resourcePath: 'servicos/os', call: 'IncluirOS' },
  listarOS: { resourcePath: 'servicos/os', call: 'ListarOS' },
};

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const internalToken = Deno.env.get('INTERNAL_FUNCTION_TOKEN') || '';
    const internalOk = internalToken !== '' && req.headers.get('x-internal-token') === internalToken;
    if (!user && !internalOk) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const params = body.params || {};
    const slug = 'omie';

    const integration = await getIntegration(base44, slug);
    if (!integration || integration.enabled !== true) {
      return Response.json({ success: false, error: 'Integração desabilitada ou não cadastrada' }, { status: 409 });
    }

    const baseUrl = String(integration.base_url || 'https://app.omie.com.br/api/v1').replace(/\/+$/, '');
    const appKey = Deno.env.get('OMIE_APP_KEY') || '';
    const appSecret = Deno.env.get('OMIE_APP_SECRET') || '';
    if (!appKey || !appSecret) return Response.json({ success: false, error: 'OMIE_APP_KEY e OMIE_APP_SECRET não configurados' }, { status: 500 });

    const mapped = ACTION_MAP[action];
    if (!mapped && action !== 'call') {
      return Response.json({ error: `Action inválida: ${action}` }, { status: 400 });
    }

    const resourcePath = mapped ? mapped.resourcePath : params.resourcePath;
    const callName = mapped ? mapped.call : params.call;
    const url = `${baseUrl}/${resourcePath}/`;
    const omieBody = JSON.stringify({
      call: callName,
      app_key: appKey,
      app_secret: appSecret,
      param: params.param || [],
    });

    const result = await callWithLogging(base44, {
      slug, action, method: 'POST', url,
      headers: { 'Content-Type': 'application/json' }, body: omieBody,
    });
    return Response.json(result, { status: result.status });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}