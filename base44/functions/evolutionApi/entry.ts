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

    const url = baseUrl.replace(/\/$/, '') + '/instance/all';
    const res = await fetch(url, { headers: { apikey: apiKey } });
    const data = await res.json();

    if (!res.ok) {
      return Response.json({ error: 'Falha ao conectar à Evolution API', details: data }, { status: res.status });
    }

    return Response.json({ success: true, instances: data.data || data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});