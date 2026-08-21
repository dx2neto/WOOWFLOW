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
    const slug = 'claude';

    const integration = await getIntegration(base44, slug);
    if (!integration || integration.enabled !== true) {
      return Response.json({ success: false, error: 'Integração desabilitada ou não cadastrada' }, { status: 409 });
    }

    const baseUrl = String(integration.base_url || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY') || '';
    if (!apiKey) return Response.json({ success: false, error: 'ANTHROPIC_API_KEY não configurado' }, { status: 500 });

    const extraConfig = (integration.extra_config || {}) as Record<string, unknown>;
    const anthropicVersion = String(extraConfig.anthropic_version || '2023-06-01');

    const headers: Record<string, string> = {
      'x-api-key': apiKey,
      'anthropic-version': anthropicVersion,
      'Content-Type': 'application/json',
    };
    let url = ''; let method = 'GET'; let reqBody: string | null = null;

    switch (action) {
      case 'createMessage':
        url = `${baseUrl}/messages`; method = 'POST';
        reqBody = JSON.stringify(params);
        break;
      case 'countTokens':
        url = `${baseUrl}/messages/count_tokens`; method = 'POST';
        reqBody = JSON.stringify(params);
        break;
      case 'listModels':
        url = `${baseUrl}/models`;
        break;
      default: return Response.json({ error: `Action inválida: ${action}` }, { status: 400 });
    }

    const result = await callWithLogging(base44, { slug, action, method, url, headers, body: reqBody });
    return Response.json(result, { status: result.status });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}