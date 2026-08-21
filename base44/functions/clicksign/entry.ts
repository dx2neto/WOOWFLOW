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
    const slug = 'clicksign';

    const integration = await getIntegration(base44, slug);
    if (!integration || integration.enabled !== true) {
      return Response.json({ success: false, error: 'Integração desabilitada ou não cadastrada' }, { status: 409 });
    }

    const env = String(integration.environment || 'sandbox');
    const defaultBase = env === 'sandbox' ? 'https://sandbox.clicksign.com/api/v3' : 'https://app.clicksign.com/api/v3';
    const baseUrl = String(integration.base_url || defaultBase).replace(/\/+$/, '');
    const token = Deno.env.get('CLICKSIGN_ACCESS_TOKEN') || '';
    if (!token) return Response.json({ success: false, error: 'CLICKSIGN_ACCESS_TOKEN não configurado' }, { status: 500 });

    const headers: Record<string, string> = { Authorization: token, 'Content-Type': 'application/vnd.api+json' };
    let url = ''; let method = 'GET'; let reqBody: string | null = null;

    switch (action) {
      case 'createEnvelope':
        url = `${baseUrl}/envelopes`; method = 'POST';
        reqBody = JSON.stringify({ data: { type: 'envelopes', attributes: params } });
        break;
      case 'listEnvelopes': url = `${baseUrl}/envelopes`; break;
      case 'getEnvelope': url = `${baseUrl}/envelopes/${params.id}`; break;
      case 'activateEnvelope':
        url = `${baseUrl}/envelopes/${params.id}`; method = 'PATCH';
        reqBody = JSON.stringify({ data: { id: params.id, type: 'envelopes', attributes: { status: 'running' } } });
        break;
      case 'addDocument':
        url = `${baseUrl}/envelopes/${params.id}/documents`; method = 'POST';
        reqBody = JSON.stringify({ data: { type: 'documents', attributes: params.attributes || params } });
        break;
      case 'listDocuments': url = `${baseUrl}/envelopes/${params.id}/documents`; break;
      case 'addSigner':
        url = `${baseUrl}/envelopes/${params.id}/signers`; method = 'POST';
        reqBody = JSON.stringify({ data: { type: 'signers', attributes: params.attributes || params } });
        break;
      case 'listSigners': url = `${baseUrl}/envelopes/${params.id}/signers`; break;
      default: return Response.json({ error: `Action inválida: ${action}` }, { status: 400 });
    }

    const result = await callWithLogging(base44, { slug, action, method, url, headers, body: reqBody });
    return Response.json(result, { status: result.status });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}