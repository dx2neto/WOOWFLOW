const { Router } = require('express');
const router = Router();
const logger = require('../utils/logger');
const sessions = require('../utils/sessionManager');
const ixc = require('../services/ixcService');
const evo = require('../services/evolutionService');

// ─── Middleware: valida secret do webhook ────────────────────────────────────
function validarSecret(req, res, next) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return next(); // sem config = libera (dev)

  const recebido =
    req.headers['x-webhook-secret'] ||
    req.headers['authorization']?.replace('Bearer ', '');

  if (recebido !== secret) {
    logger.warn(`[Webhook] Acesso não autorizado — IP: ${req.ip}`);
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
}

// ════════════════════════════════════════════════════════════════════════════
//  POST /webhook/evolution
//  Endpoint registrado na Evolution API para receber mensagens
// ════════════════════════════════════════════════════════════════════════════
router.post('/evolution', validarSecret, async (req, res) => {
  // Responde 200 IMEDIATAMENTE para a Evolution não reenviar
  res.status(200).json({ ok: true });

  try {
    const payload = req.body;

    // Só processa evento de nova mensagem
    if (payload.event !== 'MESSAGES_UPSERT' && payload.event !== 'messages.upsert') return;

    const msg = payload.data ?? payload.message;
    if (!msg) return;

    // Ignora mensagens enviadas pelo bot
    if (msg.key?.fromMe) return;

    // Ignora grupos
    const jid = msg.key?.remoteJid ?? '';
    if (jid.includes('@g.us') || jid.includes('@broadcast')) return;

    const numero = jid.replace('@s.whatsapp.net', '');

    // Extrai texto da mensagem (texto, resposta ou botão)
    const texto = extrairTexto(msg);
    if (!texto) return;

    logger.info(`[Webhook] Msg de ${numero}: "${texto}"`);

    await processarMensagem(numero, texto);
  } catch (err) {
    logger.error(`[Webhook] Erro: ${err.message}`);
  }
});

// ─── Extrai texto de qualquer tipo de mensagem ───────────────────────────────
function extrairTexto(msg) {
  const m = msg.message;
  if (!m) return '';

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.templateButtonReplyMessage?.selectedId ||
    ''
  ).trim().toUpperCase();
}

// ════════════════════════════════════════════════════════════════════════════
//  MOTOR DO CHATBOT
// ════════════════════════════════════════════════════════════════════════════
async function processarMensagem(numero, texto) {
  const sess = sessions.get(numero);

  // ── Comandos globais (funcionam em qualquer etapa) ────────────────────────
  if (['MENU', 'INICIO', 'OI', 'OLA', 'OLÁ', 'START', '/START'].includes(texto)) {
    sessions.set(numero, { etapa: 'inicio' });
    return await iniciarAtendimento(numero);
  }

  if (texto === 'BOLETO' && sess.clienteId) {
    return await fluxoBoleto(numero, sess);
  }

  // ── Roteamento por etapa ──────────────────────────────────────────────────
  switch (sess.etapa) {
    case 'inicio':
      return await iniciarAtendimento(numero);

    case 'aguardando_cpf':
      return await etapaReceberCpf(numero, texto, sess);

    case 'menu_principal':
      return await etapaMenu(numero, texto, sess);

    case 'menu_cobrancas':
      return await etapaMenuCobrancas(numero, texto, sess);

    default:
      return await iniciarAtendimento(numero);
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  ETAPAS
// ════════════════════════════════════════════════════════════════════════════

async function iniciarAtendimento(numero) {
  try {
    // Tenta identificar o cliente pelo número
    const clientes = await ixc.buscarClientePorTelefone(numero);

    if (clientes.length > 0) {
      const cliente = clientes[0];
      sessions.set(numero, { etapa: 'menu_principal', clienteId: cliente.id, clienteNome: cliente.razao });
      return await mostrarMenuPrincipal(numero, cliente.razao);
    }

    // Não encontrou → pede CPF
    sessions.set(numero, { etapa: 'aguardando_cpf', clienteId: null });
    await evo.enviarTexto(numero, evo.Templates.menuNaoIdentificado());
  } catch (err) {
    logger.error(`[Bot] iniciarAtendimento: ${err.message}`);
    await evo.enviarTexto(numero, evo.Templates.erroPadrao());
  }
}

// ─── Menu principal com botões ───────────────────────────────────────────────
async function mostrarMenuPrincipal(numero, nomeCliente) {
  const tpl = evo.Templates.menuPrincipal(nomeCliente);
  try {
    await evo.enviarBotoes(numero, tpl);
  } catch {
    // Fallback texto se botões não estiverem disponíveis na instância
    await evo.enviarTexto(
      numero,
      `${tpl.titulo}\n\n` +
      `Escolha uma opção:\n` +
      `1️⃣ - Minha Conta\n` +
      `2️⃣ - 2ª Via de Boleto\n` +
      `3️⃣ - Falar com Atendente\n\n` +
      `_Responda com o número ou a palavra-chave._`
    );
  }
}

// ─── Recebe CPF ──────────────────────────────────────────────────────────────
async function etapaReceberCpf(numero, texto, sess) {
  const cpf = texto.replace(/\D/g, '');

  if (cpf.length !== 11 && cpf.length !== 14) {
    return await evo.enviarTexto(numero, evo.Templates.cpfInvalido());
  }

  try {
    const cliente = await ixc.buscarClientePorCpf(cpf);

    if (!cliente) {
      return await evo.enviarTexto(numero, evo.Templates.clienteNaoEncontrado());
    }

    sessions.set(numero, { etapa: 'menu_principal', clienteId: cliente.id, clienteNome: cliente.razao });
    await evo.enviarTexto(numero, `✅ Conta encontrada! Olá, *${cliente.razao}*! 😊`);
    await mostrarMenuPrincipal(numero, cliente.razao);
  } catch (err) {
    logger.error(`[Bot] etapaReceberCpf: ${err.message}`);
    await evo.enviarTexto(numero, evo.Templates.erroPadrao());
  }
}

// ─── Processa escolha do menu ────────────────────────────────────────────────
async function etapaMenu(numero, texto, sess) {
  const opcao =
    texto === 'VER_CONTA'    || texto === '1' ? 'CONTA'   :
    texto === 'VER_BOLETO'   || texto === '2' ? 'BOLETO'  :
    texto === 'FALAR_HUMANO' || texto === '3' ? 'HUMANO'  : null;

  if (!opcao) {
    await mostrarMenuPrincipal(numero, sess.clienteNome || 'cliente');
    return;
  }

  if (opcao === 'CONTA')   return await fluxoConta(numero, sess);
  if (opcao === 'BOLETO')  return await fluxoBoleto(numero, sess);
  if (opcao === 'HUMANO')  return await fluxoAtendente(numero);
}

// ─── Processa escolha de cobrança específica ─────────────────────────────────
async function etapaMenuCobrancas(numero, texto, sess) {
  if (texto === 'HUMANO' || texto === '0') {
    return await fluxoAtendente(numero);
  }

  const idx = parseInt(texto) - 1;
  if (isNaN(idx) || idx < 0 || !sess.cobrancas || idx >= sess.cobrancas.length) {
    await evo.enviarTexto(numero, '❓ Opção inválida. Digite o *número* da fatura desejada.');
    return;
  }

  const cobranca = sess.cobrancas[idx];
  await enviarDetalheBoleto(numero, cobranca.id);
  sessions.set(numero, { etapa: 'menu_principal' });
}

// ════════════════════════════════════════════════════════════════════════════
//  FLUXOS DE AÇÃO
// ════════════════════════════════════════════════════════════════════════════

async function fluxoConta(numero, sess) {
  try {
    await evo.enviarTexto(numero, '⏳ Consultando sua conta...');

    const [contratos, cobrancas] = await Promise.all([
      ixc.buscarContratosCliente(sess.clienteId),
      ixc.buscarCobrancasAbertas(sess.clienteId),
    ]);

    const resumo = evo.Templates.contaResumida({
      nome: sess.clienteNome,
      contratos: contratos.length,
      cobrancasAbertas: cobrancas.length,
    });

    await evo.enviarTexto(numero, resumo);

    if (cobrancas.length > 0) {
      const lista = evo.Templates.listaCobrancas(cobrancas);
      await evo.enviarTexto(numero, lista);
      sessions.set(numero, { etapa: 'menu_cobrancas', cobrancas });
      await evo.enviarTexto(
        numero,
        `Digite o *número* da fatura para receber a 2ª via, ou *0* para falar com atendente.`
      );
    } else {
      sessions.set(numero, { etapa: 'menu_principal' });
    }
  } catch (err) {
    logger.error(`[Bot] fluxoConta: ${err.message}`);
    await evo.enviarTexto(numero, evo.Templates.erroPadrao());
  }
}

async function fluxoBoleto(numero, sess) {
  try {
    await evo.enviarTexto(numero, '⏳ Gerando seu boleto, aguarde...');

    const cobrancas = await ixc.buscarCobrancasAbertas(sess.clienteId);

    if (cobrancas.length === 0) {
      sessions.set(numero, { etapa: 'menu_principal' });
      return await evo.enviarTexto(numero, evo.Templates.semCobrancasAbertas(sess.clienteNome));
    }

    if (cobrancas.length === 1) {
      await enviarDetalheBoleto(numero, cobrancas[0].id);
      sessions.set(numero, { etapa: 'menu_principal' });
      return;
    }

    // Mais de 1 cobrança → lista para escolher
    const lista = evo.Templates.listaCobrancas(cobrancas);
    await evo.enviarTexto(numero, lista);
    sessions.set(numero, { etapa: 'menu_cobrancas', cobrancas });
    await evo.enviarTexto(numero, `Digite o *número* da fatura desejada:`);
  } catch (err) {
    logger.error(`[Bot] fluxoBoleto: ${err.message}`);
    await evo.enviarTexto(numero, evo.Templates.erroPadrao());
  }
}

async function fluxoAtendente(numero) {
  sessions.set(numero, { etapa: 'menu_principal' });
  await evo.enviarTexto(numero, evo.Templates.encaminhandoAtendente());
}

// ─── Envia detalhes de uma cobrança específica ───────────────────────────────
async function enviarDetalheBoleto(numero, idCobranca) {
  const boleto = await ixc.buscarDetalheCobranca(idCobranca);

  if (boleto.status === 'P') {
    return await evo.enviarTexto(numero, '✅ Esta fatura já foi paga!');
  }

  await evo.enviarTexto(numero, evo.Templates.boletoDetalhes(boleto));

  if (boleto.linkBoleto) {
    await sleep(800);
    await evo.enviarDocumento(numero, {
      url: boleto.linkBoleto,
      nomeArquivo: `boleto_${boleto.id}.pdf`,
      legenda: `📎 Boleto ${boleto.vencimentoFormatado} — ${boleto.valorFormatado}`,
    });
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = router;
