const axios = require('axios');
const logger = require('../utils/logger');

// ─── Axios instance ──────────────────────────────────────────────────────────
const evo = axios.create({
  baseURL: process.env.EVOLUTION_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    apikey: process.env.EVOLUTION_API_KEY,
  },
});

const INST = () => process.env.EVOLUTION_INSTANCE;

// ─── Interceptors ────────────────────────────────────────────────────────────
evo.interceptors.request.use((config) => {
  logger.debug(`[EVO] ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

evo.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const msg    = err.response?.data?.message || err.message;
    logger.error(`[EVO] ERRO ${status || 'TIMEOUT'}: ${err.config?.url} → ${msg}`);
    throw err;
  }
);

// ─── Formata número para Evolution ───────────────────────────────────────────
function formatarNumero(tel) {
  const d = tel.replace(/\D/g, '');
  // Garante 55XXXXXXXXXXX (11 dígitos com DDD)
  if (d.startsWith('55') && d.length >= 12) return d;
  return `55${d}`;
}

// ════════════════════════════════════════════════════════════════════════════
//  MENSAGENS DE TEXTO
// ════════════════════════════════════════════════════════════════════════════

async function enviarTexto(telefone, texto) {
  const { data } = await evo.post(`/message/sendText/${INST()}`, {
    number: formatarNumero(telefone),
    text: texto,
    delay: 1000, // ms de digitação (typing indicator)
  });
  return data;
}

// ════════════════════════════════════════════════════════════════════════════
//  BOTÕES (formato correto Evolution API v2)
//  Máximo 3 botões por mensagem
// ════════════════════════════════════════════════════════════════════════════

async function enviarBotoes(telefone, { titulo, descricao, rodape = '', botoes }) {
  /*
   * Evolution API — POST /message/sendButtons/{instance}
   * Cada botão: { type: "reply", displayText: "Texto", id: "ID_UNICO" }
   */
  const { data } = await evo.post(`/message/sendButtons/${INST()}`, {
    number: formatarNumero(telefone),
    title: titulo,
    description: descricao,
    footerText: rodape,
    buttons: botoes.map((b) => ({
      type: 'reply',
      displayText: b.texto,
      id: b.id,
    })),
  });
  return data;
}

// ════════════════════════════════════════════════════════════════════════════
//  LISTA INTERATIVA (menu de opções)
//  Permite mais de 3 opções
// ════════════════════════════════════════════════════════════════════════════

async function enviarLista(telefone, { titulo, descricao, rodape = '', textoBotao, secoes }) {
  /*
   * Evolution API — POST /message/sendList/{instance}
   * secoes: [{ title: "Título", rows: [{ title, description, rowId }] }]
   */
  const { data } = await evo.post(`/message/sendList/${INST()}`, {
    number: formatarNumero(telefone),
    title: titulo,
    description: descricao,
    footerText: rodape,
    buttonText: textoBotao,
    sections: secoes,
  });
  return data;
}

// ════════════════════════════════════════════════════════════════════════════
//  MÍDIA
// ════════════════════════════════════════════════════════════════════════════

async function enviarDocumento(telefone, { url, nomeArquivo, legenda = '' }) {
  const { data } = await evo.post(`/message/sendMedia/${INST()}`, {
    number: formatarNumero(telefone),
    mediatype: 'document',
    mimetype: 'application/pdf',
    media: url,
    fileName: nomeArquivo,
    caption: legenda,
  });
  return data;
}

async function enviarImagem(telefone, { url, legenda = '' }) {
  const { data } = await evo.post(`/message/sendMedia/${INST()}`, {
    number: formatarNumero(telefone),
    mediatype: 'image',
    mimetype: 'image/jpeg',
    media: url,
    caption: legenda,
  });
  return data;
}

// ════════════════════════════════════════════════════════════════════════════
//  INSTÂNCIA
// ════════════════════════════════════════════════════════════════════════════

async function verificarStatusInstancia() {
  const { data } = await evo.get(`/instance/connectionState/${INST()}`);
  return data;
}

async function checarNumeroWhatsApp(telefone) {
  const { data } = await evo.post(`/chat/whatsappNumbers/${INST()}`, {
    numbers: [formatarNumero(telefone)],
  });
  return data?.[0] ?? null;
}

// ════════════════════════════════════════════════════════════════════════════
//  CONFIGURAR WEBHOOK NA EVOLUTION
// ════════════════════════════════════════════════════════════════════════════

async function configurarWebhook(urlDestino) {
  const { data } = await evo.post(`/webhook/set/${INST()}`, {
    url: urlDestino,
    webhook_by_events: true,
    webhook_base64: false,
    events: [
      'MESSAGES_UPSERT',
      'MESSAGES_UPDATE',
      'CONNECTION_UPDATE',
    ],
  });
  return data;
}

// ════════════════════════════════════════════════════════════════════════════
//  TEMPLATES DE MENSAGEM
// ════════════════════════════════════════════════════════════════════════════

const Templates = {

  menuPrincipal(nomeCliente) {
    return {
      titulo: `Olá, *${nomeCliente}*! 👋`,
      descricao: 'Como posso te ajudar hoje?',
      rodape: '🔌 Suporte via WhatsApp',
      botoes: [
        { id: 'VER_CONTA',   texto: '📋 Minha Conta' },
        { id: 'VER_BOLETO',  texto: '🧾 2ª Via de Boleto' },
        { id: 'FALAR_HUMANO', texto: '👤 Falar com Atendente' },
      ],
    };
  },

  menuNaoIdentificado() {
    return (
      `👋 Olá! Seja bem-vindo ao suporte.\n\n` +
      `Não consegui identificar sua conta pelo número de telefone.\n\n` +
      `Por favor, informe seu *CPF* (somente números) para continuar:`
    );
  },

  contaResumida({ nome, contratos, cobrancasAbertas }) {
    const linhas = [
      `📋 *Resumo da Conta*\n`,
      `👤 Cliente: *${nome}*`,
      `📦 Contratos ativos: *${contratos}*`,
      `💰 Faturas em aberto: *${cobrancasAbertas}*`,
    ];
    if (cobrancasAbertas > 0) {
      linhas.push(`\nResponda *BOLETO* para receber a 2ª via.`);
    } else {
      linhas.push(`\n✅ Conta em dia!`);
    }
    return linhas.join('\n');
  },

  listaCobrancas(cobrancas) {
    if (cobrancas.length === 0) {
      return '✅ Nenhuma cobrança em aberto. Sua conta está em dia!';
    }
    let msg = `🧾 *Faturas em aberto (${cobrancas.length})*\n\n`;
    cobrancas.slice(0, 5).forEach((c, i) => {
      const atrasado = new Date(c.data_vencimento) < new Date();
      const emoji = atrasado ? '🔴' : '🟡';
      msg += `${emoji} *Fatura ${i + 1}*\n`;
      msg += `   💰 R$ ${parseFloat(c.valor).toFixed(2).replace('.', ',')}\n`;
      msg += `   📅 Vence: ${c.data_vencimento?.split('-').reverse().join('/')}\n\n`;
    });
    msg += `_Responda *BOLETO* para receber a 2ª via da fatura mais próxima._`;
    return msg;
  },

  boletoDetalhes({ valorFormatado, vencimentoFormatado, linhaDigitavel, pixCopiaECola, diasAtraso }) {
    let msg = `🧾 *2ª Via do Boleto*\n\n`;
    msg += `💰 Valor: *${valorFormatado}*\n`;
    msg += `📅 Vencimento: *${vencimentoFormatado}*\n`;
    if (diasAtraso > 0) msg += `⚠️ Em atraso há *${diasAtraso} dia(s)*\n`;

    if (linhaDigitavel) {
      msg += `\n🔢 *Linha Digitável:*\n`;
      msg += `\`${linhaDigitavel}\`\n`;
    }

    if (pixCopiaECola) {
      msg += `\n⚡ *PIX Copia e Cola:*\n`;
      msg += `\`${pixCopiaECola}\`\n`;
    }

    msg += `\n_Qualquer dúvida, estamos à disposição!_ 😊`;
    return msg;
  },

  avisoCobrancaVencida({ nomeCliente, valorFormatado, vencimentoFormatado, diasAtraso }) {
    return (
      `⚠️ Olá, *${nomeCliente}*!\n\n` +
      `Sua fatura está vencida há *${diasAtraso} dia(s)*.\n\n` +
      `💰 Valor: *${valorFormatado}*\n` +
      `📅 Vencimento: *${vencimentoFormatado}*\n\n` +
      `Para receber a *2ª via*, responda esta mensagem com *BOLETO*.\n\n` +
      `_Caso já tenha efetuado o pagamento, desconsidere este aviso._`
    );
  },

  avisoProximoVencimento({ nomeCliente, valorFormatado, vencimentoFormatado }) {
    return (
      `📢 Olá, *${nomeCliente}*!\n\n` +
      `Sua fatura vence em breve:\n\n` +
      `💰 Valor: *${valorFormatado}*\n` +
      `📅 Vencimento: *${vencimentoFormatado}*\n\n` +
      `Para receber a *2ª via*, responda *BOLETO*.\n\n` +
      `_Obrigado pela preferência!_ 😊`
    );
  },

  semCobrancasAbertas(nomeCliente) {
    return `✅ Olá, *${nomeCliente}*! Não há cobranças em aberto. Sua conta está em dia! 😊`;
  },

  encaminhandoAtendente() {
    return (
      `👤 *Transferindo para um atendente...*\n\n` +
      `Em instantes alguém irá te atender.\n` +
      `Horário de atendimento: *Seg-Sex 8h às 18h*\n\n` +
      `_Aguarde, por favor!_ 🙏`
    );
  },

  cpfInvalido() {
    return `❌ CPF inválido. Por favor, envie somente os *11 números* do seu CPF.`;
  },

  clienteNaoEncontrado() {
    return (
      `❌ Não encontrei nenhuma conta com esse CPF.\n\n` +
      `Verifique o número digitado ou entre em contato conosco pelo telefone.`
    );
  },

  erroPadrao() {
    return `😓 Ops! Ocorreu um erro ao processar sua solicitação. Tente novamente em alguns instantes.`;
  },
};

// ════════════════════════════════════════════════════════════════════════════
module.exports = {
  formatarNumero,
  enviarTexto,
  enviarBotoes,
  enviarLista,
  enviarDocumento,
  enviarImagem,
  verificarStatusInstancia,
  checarNumeroWhatsApp,
  configurarWebhook,
  Templates,
};
