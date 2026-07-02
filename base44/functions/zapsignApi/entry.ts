import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const token = Deno.env.get('ZAPSIGN_API_TOKEN');
    if (!token) {
      return Response.json({ error: 'Credenciais do ZapSign não configuradas' }, { status: 500 });
    }

    const { docToken } = await req.json().catch(() => ({}));
    const url = docToken
      ? `https://api.zapsign.com.br/api/v1/docs/${docToken}/`
      : 'https://api.zapsign.com.br/api/v1/docs/?limit=1';

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!res.ok) {
      return Response.json({ error: 'Falha ao conectar ao ZapSign', details: data }, { status: res.status });
    }

    return Response.json({ success: true, result: data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});