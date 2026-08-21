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
    const slug = 'evolution-api';

    const integration = await getIntegration(base44, slug);
    if (!integration || integration.enabled !== true) {
      return Response.json({ success: false, error: 'Integração desabilitada ou não cadastrada' }, { status: 409 });
    }

    const baseUrl = String(integration.base_url || '').replace(/\/+$/, '');
    if (!baseUrl) return Response.json({ success: false, error: 'base_url não configurado para Evolution API' }, { status: 500 });

    const apiKey = Deno.env.get('EVOLUTION_API_INSTANCE_KEY') || Deno.env.get('EVOLUTION_API_GLOBAL_KEY') || Deno.env.get('EVOLUTION_API_KEY') || '';
    if (!apiKey) return Response.json({ success: false, error: 'EVOLUTION_API_KEY não configurado' }, { status: 500 });

    const headers: Record<string, string> = { apikey: apiKey, 'Content-Type': 'application/json' };
    let url = ''; let method = 'GET'; let reqBody: string | null = null;

    switch (action) {
      case 'createInstance':
        url = `${baseUrl}/instance/create`; method = 'POST';
        reqBody = JSON.stringify({ instanceName: params.instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS', webhook: params.webhook });
        break;
      case 'connectInstance': url = `${baseUrl}/instance/connect/${params.instanceName}`; break;
      case 'connectionState': url = `${baseUrl}/instance/connectionState/${params.instanceName}`; break;
      case 'fetchInstances': url = `${baseUrl}/instance/fetchInstances`; break;
      case 'deleteInstance': url = `${baseUrl}/instance/delete/${params.instanceName}`; method = 'DELETE'; break;
      case 'logoutInstance': url = `${baseUrl}/instance/logout/${params.instanceName}`; method = 'DELETE'; break;
      case 'sendText':
        url = `${baseUrl}/message/sendText/${params.instanceName}`; method = 'POST';
        reqBody = JSON.stringify({ number: params.number, text: params.text });
        break;
      case 'sendMedia':
        url = `${baseUrl}/message/sendMedia/${params.instanceName}`; method = 'POST';
        reqBody = JSON.stringify({ number: params.number, mediatype: params.mediatype, media: params.media, caption: params.caption, fileName: params.fileName });
        break;
      case 'sendLocation':
        url = `${baseUrl}/message/sendLocation/${params.instanceName}`; method = 'POST';
        reqBody = JSON.stringify({ number: params.number, latitude: params.latitude, longitude: params.longitude, name: params.name, address: params.address });
        break;
      case 'checkIsWhatsApp':
        url = `${baseUrl}/chat/whatsappNumbers/${params.instanceName}`; method = 'POST';
        reqBody = JSON.stringify({ numbers: params.numbers });
        break;
      case 'fetchGroups': url = `${baseUrl}/group/fetchAllGroups/${params.instanceName}`; break;
      case 'setWebhook':
        url = `${baseUrl}/webhook/set/${params.instanceName}`; method = 'POST';
        reqBody = JSON.stringify({ webhook: { url: params.url, events: params.events || ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'], enabled: true } });
        break;
      default: return Response.json({ error: `Action inválida: ${action}` }, { status: 400 });
    }

    const result = await callWithLogging(base44, { slug, action, method, url, headers, body: reqBody });
    return Response.json(result, { status: result.status });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}