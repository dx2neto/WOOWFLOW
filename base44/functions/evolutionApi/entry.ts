import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Evolution Go: URL e key têm defaults embutidos caso as variáveis de ambiente não estejam definidas
    const baseUrl = Deno.env.get('EVOLUTION_API_URL') || 'https://evolution-go-9b1u.srv1772067.hstgr.cloud';
    const apiKey  = Deno.env.get('EVOLUTION_API_KEY')  || '19QJ/5Vpa0[ZrZXCX?fS';
    const defaultInstance = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'CONNECT';

    const body = await req.json().catch(() => ({}));

    if (body.action === 'send_message') {
      const instanceName = body.instance || defaultInstance;
      if (!instanceName) {
        return Response.json({ error: 'Instância da Evolution API não configurada' }, { status: 500 });
      }
      const { phone, message } = body;
      if (!phone || !message) {
        return Response.json({ error: 'phone e message são obrigatórios' }, { status: 400 });
      }

      // Evolution Go autentica o envio pelo apikey (token) da própria instância.
      const instancesRes = await fetch(baseUrl.replace(/\/$/, '') + '/instance/all', { headers: { apikey: apiKey } });
      const instancesData = await instancesRes.json().catch(() => ({}));
      const instanceList = instancesData.data || instancesData || [];
      const targetInstance = instanceList.find((i) => (i.name || i.instance?.instanceName) === instanceName);
      const instanceToken = targetInstance?.token || apiKey;

      const number = phone.replace(/\D/g, '');
      const url = baseUrl.replace(/\/$/, '') + '/send/text';
      const res = await fetch(url, {
        method: 'POST',
        headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
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

    if (body.action === 'create_instance') {
      const { instanceName } = body;
      if (!instanceName) {
        return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      }
      const url = baseUrl.replace(/\/$/, '') + '/instance/create';
      const res = await fetch(url, {
        method: 'POST',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: instanceName, token: crypto.randomUUID() }),
      });
      const rawText = await res.text();
      let data;
      try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }
      if (!res.ok) {
        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'evolutionApi', action: 'create_instance', status: 'falha', details: JSON.stringify(data).slice(0, 500) });
        return Response.json({ error: 'Falha ao criar instância', details: data }, { status: res.status });
      }
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'evolutionApi', action: 'create_instance', status: 'sucesso' });
      return Response.json({ success: true, result: data });
    }

    if (body.action === 'get_qrcode') {
      const { instanceName } = body;
      if (!instanceName) {
        return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      }
      // O QR code já vem embutido no retorno de /instance/all (campo "qrcode" em base64).
      const instancesRes = await fetch(baseUrl.replace(/\/$/, '') + '/instance/all', { headers: { apikey: apiKey } });
      const instancesData = await instancesRes.json().catch(() => ({}));
      const instanceList = instancesData.data || instancesData || [];
      const targetInstance = instanceList.find((i) => (i.name || i.instance?.instanceName) === instanceName);
      if (!targetInstance || !targetInstance.qrcode) {
        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'evolutionApi', action: 'get_qrcode', status: 'falha', details: `instância: ${instanceName} - QR code não disponível (instância já conectada ou inexistente)` });
        return Response.json({ error: 'QR code indisponível. A instância pode já estar conectada.' }, { status: 404 });
      }
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'evolutionApi', action: 'get_qrcode', status: 'sucesso', details: `instância: ${instanceName}` });
      return Response.json({ success: true, qrcode: { base64: targetInstance.qrcode } });
    }

    if (body.action === 'delete_instance') {
      const { instanceName } = body;
      if (!instanceName) {
        return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      }
      const instancesRes = await fetch(baseUrl.replace(/\/$/, '') + '/instance/all', { headers: { apikey: apiKey } });
      const instancesData = await instancesRes.json().catch(() => ({}));
      const instanceList = instancesData.data || instancesData || [];
      const targetInstance = instanceList.find((i) => (i.name || i.instance?.instanceName) === instanceName);
      if (!targetInstance) {
        return Response.json({ error: 'Instância não encontrada' }, { status: 404 });
      }
      const url = baseUrl.replace(/\/$/, '') + '/instance/delete/' + encodeURIComponent(targetInstance.id);
      const res = await fetch(url, { method: 'DELETE', headers: { apikey: apiKey } });
      const rawText = await res.text();
      let data;
      try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }
      if (!res.ok) {
        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'evolutionApi', action: 'delete_instance', status: 'falha', details: JSON.stringify(data).slice(0, 500) });
        return Response.json({ error: 'Falha ao excluir instância', details: data }, { status: res.status });
      }
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'evolutionApi', action: 'delete_instance', status: 'sucesso' });
      return Response.json({ success: true, result: data });
    }

    if (body.action === 'get_contacts') {
      const instanceName = body.instance || defaultInstance;
      if (!instanceName) {
        return Response.json({ error: 'Instância da Evolution API não configurada' }, { status: 500 });
      }
      const instancesRes = await fetch(baseUrl.replace(/\/$/, '') + '/instance/all', { headers: { apikey: apiKey } });
      const instancesData = await instancesRes.json().catch(() => ({}));
      const instanceList = instancesData.data || instancesData || [];
      const targetInstance = instanceList.find((i) => (i.name || i.instance?.instanceName) === instanceName);
      const instanceToken = targetInstance?.token || apiKey;

      const url = baseUrl.replace(/\/$/, '') + '/user/contacts';
      const res = await fetch(url, { headers: { Token: instanceToken } });
      const rawText = await res.text();
      let data;
      try { data = JSON.parse(rawText); } catch { data = { raw: rawText }; }
      if (!res.ok) {
        const friendly = res.status === 401
          ? 'A instância do WhatsApp está desconectada. Escaneie o QR code novamente em Integrações.'
          : 'Falha ao carregar conversas';
        await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'evolutionApi', action: 'get_contacts', status: 'falha', details: `status ${res.status}: ${JSON.stringify(data).slice(0, 400)}` });
        return Response.json({ error: friendly, status: res.status, details: data }, { status: res.status || 500 });
      }
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'evolutionApi', action: 'get_contacts', status: 'sucesso' });
      return Response.json({ success: true, contacts: data.data || data });
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