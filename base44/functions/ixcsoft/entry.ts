import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { callWithLogging, getIntegration } from '../../shared/integrationHub.ts';

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
    const slug = 'ixcsoft';

    const integration = await getIntegration(base44, slug);
    if (!integration || integration.enabled !== true) {
      return Response.json({ success: false, error: 'Integração desabilitada ou não cadastrada' }, { status: 409 });
    }

    const baseUrl = String(integration.base_url || '').replace(/\/+$/, '');
    if (!baseUrl) return Response.json({ success: false, error: 'base_url não configurado para IXCsoft' }, { status: 500 });

    const token = Deno.env.get('IXC_API_TOKEN') || '';
    if (!token) return Response.json({ success: false, error: 'IXC_API_TOKEN não configurado' }, { status: 500 });

    const recurso = String(params.recurso || '');
    if (!recurso) return Response.json({ error: 'params.recurso é obrigatório' }, { status: 400 });

    const url = `${baseUrl}/${recurso}`;
    const headers: Record<string, string> = {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    };

    let method = 'POST';
    let reqBody: string | null = null;

    switch (action) {
      case 'listar':
        headers.ixcsoft = 'listar';
        reqBody = JSON.stringify({
          qtype: params.qtype || '', query: params.query || '', oper: params.oper || 'L',
          page: params.page || '1', rp: params.rp || '50', sortname: params.sortname || '', sortorder: params.sortorder || '',
        });
        break;
      case 'incluir':
        reqBody = JSON.stringify(params.data || params);
        break;
      case 'editar':
        headers.ixcsoft = 'editar';
        reqBody = JSON.stringify(params.data || params);
        break;
      case 'excluir':
        headers.ixcsoft = 'excluir';
        reqBody = JSON.stringify({ id: params.id });
        break;
      default: return Response.json({ error: `Action inválida: ${action}` }, { status: 400 });
    }

    const result = await callWithLogging(base44, { slug, action, method, url, headers, body: reqBody });
    return Response.json(result, { status: result.status });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}