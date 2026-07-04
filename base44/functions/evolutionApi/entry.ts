import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const baseUrl = Deno.env.get('EVOLUTION_API_URL');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY');
    if (!baseUrl || !apiKey) {
      return Response.json({ error: 'Credenciais da Evolution API não configuradas' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));

    if (body.action === 'send_message') {
      const instance = body.instance || Deno.env.get('EVOLUTION_INSTANCE_NAME');
      if (!instance) {
        return Response.json({ error: 'Instância da Evolution API não configurada' }, { status: 500 });
      }
      const { phone, message } = body;
      if (!phone || !message) {
        return Response.json({ error: 'phone e message são obrigatórios' }, { status: 400 });
      }
      const number = phone.replace(/\D/g, '');
      const url = baseUrl.replace(/\/$/, '') + `/message/sendText/${instance}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, text: message }),
      });
      const rawText = await res.text();
      let data;
      try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }
      if (!res.ok) {
        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'evolutionApi', action: 'send_message', status: 'falha', details: JSON.stringify(data).slice(0, 500) });
        return Response.json({ error: 'Falha ao enviar mensagem', details: data }, { status: res.status });
      }
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'evolutionApi', action: 'send_message', status: 'sucesso' });
      return Response.json({ success: true, result: data });
    }

    const url = baseUrl.replace(/\/$/, '') + '/instance/all';
    const res = await fetch(url, { headers: { apikey: apiKey } });
    const rawText = await res.text();
    let data;
    try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }

    if (!res.ok) {
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'evolutionApi', action: 'instance_all', status: 'falha', details: JSON.stringify(data).slice(0, 500) });
      return Response.json({ error: 'Falha ao conectar à Evolution API', details: data }, { status: res.status });
    }

    await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'evolutionApi', action: 'instance_all', status: 'sucesso' });
    return Response.json({ success: true, instances: data.data || data });
  } catch (error) {
    const base44 = createClientFromRequest(req);
    await base44.asServiceRole.entities.ErrorLog.create({ function_name: 'evolutionApi', error_message: error.message }).catch(() => {});
    return Response.json({ error: error.message }, { status: 500 });
  }
});