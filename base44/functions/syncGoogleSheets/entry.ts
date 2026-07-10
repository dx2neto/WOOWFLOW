import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CONNECTOR_ID = '6a4b4340824be09549e87579';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { spreadsheetId, sheetName } = await req.json().catch(() => ({}));

    const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID);

    // Sem spreadsheetId: apenas valida se a conexão do usuário está ativa.
    if (!spreadsheetId) {
      return Response.json({ success: true, connected: true });
    }

    const sheet = sheetName || 'Clientes';

    const clientesRes = await base44.functions.invoke('ixcApi', { action: 'clientes' });
    const clientes = clientesRes?.data?.result?.registros || [];

    const faturasRes = await base44.functions.invoke('ixcApi', { action: 'faturas' });
    const faturas = faturasRes?.data?.result?.registros || [];
    const faturasByName = {};
    for (const f of faturas) {
      if (!faturasByName[f.customer_name]) faturasByName[f.customer_name] = [];
      faturasByName[f.customer_name].push(f);
    }

    const header = ['ID', 'Nome', 'CPF/CNPJ', 'Telefone', 'Email', 'Cidade', 'Status Contrato', 'Faturas em Aberto', 'Valor em Aberto (R$)'];
    const rows = clientes.map((c) => {
      const abertas = faturasByName[c.name] || [];
      const valorAberto = abertas.reduce((sum, f) => sum + (f.value || 0), 0);
      return [c.id, c.name, c.cpf_cnpj || '', c.phone || '', c.email || '', c.city || '', c.contract_status, abertas.length, valorAberto];
    });
    const values = [header, ...rows];

    const clearRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheet)}:clear`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!clearRes.ok) {
      const errData = await clearRes.json().catch(() => ({}));
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'sync_google_sheets', status: 'falha', details: JSON.stringify(errData).slice(0, 500) });
      return Response.json({ error: 'Falha ao limpar a planilha', details: errData }, { status: clearRes.status });
    }

    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheet + '!A1')}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      },
    );
    if (!updateRes.ok) {
      const errData = await updateRes.json().catch(() => ({}));
      await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'sync_google_sheets', status: 'falha', details: JSON.stringify(errData).slice(0, 500) });
      return Response.json({ error: 'Falha ao atualizar a planilha', details: errData }, { status: updateRes.status });
    }

    await base44.asServiceRole.entities.IntegrationLog.create({ integration: 'ixcApi', action: 'sync_google_sheets', status: 'sucesso', details: `${rows.length} clientes sincronizados` });
    return Response.json({ success: true, total: rows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});