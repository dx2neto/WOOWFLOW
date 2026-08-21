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
    const slug = 'pagcard';

    const integration = await getIntegration(base44, slug);
    if (!integration || integration.enabled !== true) {
      return Response.json({ success: false, error: 'Integração desabilitada ou não cadastrada' }, { status: 409 });
    }

    const extraConfig = (integration.extra_config || {}) as Record<string, unknown>;
    const baseUrl = String(extraConfig.base_url || integration.base_url || '').replace(/\/+$/, '');
    const paths = (extraConfig.paths || {}) as Record<string, string>;
    const authHeader = String(extraConfig.auth_header || 'Authorization');
    const authScheme = String(extraConfig.auth_scheme || 'Bearer');

    const apiKey = Deno.env.get('PAGCARD_API_KEY') || '';
    if (!apiKey) return Response.json({ success: false, error: 'PAGCARD_API_KEY não configurado' }, { status: 500 });
    if (!baseUrl) return Response.json({ success: false, error: 'base_url não configurado em Integration.extra_config.base_url' }, { status: 422 });

    const pathTemplate = paths[action];
    if (!pathTemplate) {
      return Response.json({ success: false, error: `Path não configurado para action '${action}'. Configure extra_config.paths.${action} na Integration.` }, { status: 422 });
    }

    const path = pathTemplate.replace(':id', String(params.id || ''));
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = { [authHeader]: `${authScheme} ${apiKey}`, 'Content-Type': 'application/json' };
    const method = action === 'getTransaction' ? 'GET' : action === 'refundTransaction' ? 'POST' : 'POST';
    const reqBody = method === 'GET' ? null : JSON.stringify(params);

    const result = await callWithLogging(base44, { slug, action, method, url, headers, body: reqBody });
    return Response.json(result, { status: result.status });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}