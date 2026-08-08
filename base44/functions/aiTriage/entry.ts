import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { message, customer_name, phone, conversation_history } = body;

  if (!message) {
    return Response.json({ success: false, error: "Campo 'message' é obrigatório." });
  }

  let historyContext = 'Sem histórico disponível.';
  if (Array.isArray(conversation_history) && conversation_history.length > 0) {
    const recent = conversation_history.slice(-10).map((m) => {
      const who = m.direction === 'in' ? 'Cliente' : 'Atendente';
      return who + ': ' + m.content;
    });
    historyContext = recent.join('\n');
  }

  const prompt = [
    'Você é um assistente de triagem automática para um provedor de internet.',
    'Analise a mensagem do cliente e classifique-a para roteamento automático.',
    '',
    'Cliente: ' + (customer_name || 'Não identificado'),
    'Telefone: ' + (phone || 'Não informado'),
    '',
    'Histórico recente:',
    historyContext,
    '',
    'Mensagem atual do cliente:',
    '"' + message + '"',
    '',
    'Responda em JSON com a seguinte estrutura:',
    '{',
    '  "categoria": "suporte_tecnico|financeiro|comercial|cobranca|cancelamento|instalacao|ouvidoria|saudacao|outro",',
    '  "setor": "Suporte Técnico|Financeiro|Comercial|Cobrança|Retenção|NOC|Atendimento",',
    '  "prioridade": "baixa|media|alta|urgente",',
    '  "acao": "auto_responder|encaminhar_setor|escalar_humano",',
    '  "resposta_sugerida": "Rascunho de resposta amigável e profissional em português, adequado ao contexto. Máximo 200 caracteres.",',
    '  "resumo": "Resumo breve da intenção do cliente em uma frase.",',
    '  "tags": ["tag1", "tag2"]',
    '}',
    '',
    'Regras:',
    '- "sem conexão", "internet caiu", "offline", "não conecta" → suporte_tecnico, prioridade alta/urgente',
    '- "boleto", "fatura", "pix", "vencimento", "segunda via" → financeiro',
    '- "plano novo", "upgrade", "mudar plano", "cobertura" → comercial',
    '- "negociar", "acordo", "dívida", "inadimplente" → cobranca',
    '- "cancelar", "cancelamento", "rescisão" → cancelamento, prioridade alta, escalar_humano',
    '- "instalação", "agendar", "técnico" → instalacao',
    '- "reclamação", "ouvidoria", "procon" → ouvidoria, prioridade urgente, escalar_humano',
    '- Saudações simples ("oi", "bom dia") → saudacao, prioridade baixa, auto_responder',
    '- Mensagens ambíguas → outro, encaminhar_setor',
  ].join('\n');

  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          categoria:          { type: 'string' },
          setor:              { type: 'string' },
          prioridade:         { type: 'string' },
          acao:               { type: 'string' },
          resposta_sugerida: { type: 'string' },
          resumo:            { type: 'string' },
          tags:              { type: 'array', items: { type: 'string' } },
        },
      },
    });

    await base44.asServiceRole.entities.IntegrationLog.create({
      integration: 'aiOmnichannelApi',
      action: 'triagem_automatica',
      status: 'sucesso',
      details: 'Categoria: ' + result.categoria + ' | Setor: ' + result.setor + ' | Ação: ' + result.acao,
    }).catch(() => {});

    return Response.json({ success: true, triage: result });
  } catch (error) {
    await base44.asServiceRole.entities.IntegrationLog.create({
      integration: 'aiOmnichannelApi',
      action: 'triagem_automatica',
      status: 'falha',
      details: error.message || 'Erro na triagem por IA',
    }).catch(() => {});

    return Response.json({ success: false, error: error.message || 'Falha na triagem por IA.' });
  }
});