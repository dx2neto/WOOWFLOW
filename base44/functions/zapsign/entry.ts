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
    const slug = 'zapsign';

    const integration = await getIntegration(base44, slug);
    if (!integration || integration.enabled !== true) {
      return Response.json({ success: false, error: 'Integração desabilitada ou não cadastrada' }, { status: 409 });
    }

    const baseUrl = String(integration.base_url || 'https://api.zapsign.com.br/api/v1').replace(/\/+$/, '');
    const token = Deno.env.get('ZAPSIGN_API_TOKEN') || '';
    if (!token) return Response.json({ success: false, error: 'ZAPSIGN_API_TOKEN não configurado' }, { status: 500 });

    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    let url = ''; let method = 'GET'; let reqBody: string | null = null;

    switch (action) {
      case 'createDocumentUpload': url = `${baseUrl}/docs/`; method = 'POST'; reqBody = JSON.stringify(params); break;
      case 'createDocumentFromTemplate': url = `${baseUrl}/models/create-doc/`; method = 'POST'; reqBody = JSON.stringify(params); break;
      case 'listDocuments': url = `${baseUrl}/docs/`; break;
      case 'getDocument': url = `${baseUrl}/docs/${params.token}/`; break;
      case 'deleteDocument': url = `${baseUrl}/docs/${params.token}/`; method = 'DELETE'; break;
      case 'addExtraDocument': url = `${baseUrl}/docs/${params.token}/upload-extra-doc/`; method = 'POST'; reqBody = JSON.stringify(params); break;
      case 'addSigner': url = `${baseUrl}/docs/${params.token}/add-signer/`; method = 'POST'; reqBody = JSON.stringify(params); break;
      case 'getSigner': url = `${baseUrl}/signers/${params.token}/`; break;
      case 'updateSigner': url = `${baseUrl}/signers/${params.token}/`; method = 'PUT'; reqBody = JSON.stringify(params); break;
      case 'deleteSigner': url = `${baseUrl}/signers/${params.token}/`; method = 'DELETE'; break;
      default: return Response.json({ error: `Action inválida: ${action}` }, { status: 400 });
    }

    const result = await callWithLogging(base44, { slug, action, method, url, headers, body: reqBody });
    return Response.json(result, { status: result.status });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}