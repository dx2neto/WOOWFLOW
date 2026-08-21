import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    await base44.asServiceRole.entities.IntegrationWebhook.create({
      integration_slug: 'clicksign',
      event_type: String(body.event_type || body.event || 'unknown'),
      payload: body,
    });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}