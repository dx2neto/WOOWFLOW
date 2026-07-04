const { Router } = require('express');
const router = Router();
const logger = require('../utils/logger');
const ixc = require('../services/ixcService');
const evo = require('../services/evolutionService');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ════════════════════════════════════════════════════════════════════════════
//  GET /boletos/:id
//  Retorna detalhes de uma cobrança
// ════════════════════════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const boleto = await ixc.buscarDetalheCobranca(req.params.id);
    return res.json(boleto);
  } catch (err) {
    logger.error(`[Boletos] GET /${req.params.id}: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  POST /boletos/:id/enviar-whatsapp
//  Gera 2ª via e envia no WhatsApp
//
//  Body: { telefone: string }
// ════════════════════════════════════════════════════════════════════════════
router.post('/:id/enviar-whatsapp', async (req, res) => {
  const { telefone } = req.body;
  if (!telefone) return res.status(400).json({ error: '"telefone" é obrigatório' });

  try {
    const boleto = await ixc.buscarDetalheCobranca(req.params.id);

    if (boleto.status === 'P') {
      return res.status(422).json({ error: 'Esta cobrança já foi paga' });
    }

    await evo.enviarTexto(telefone, evo.Templates.boletoDetalhes(boleto));

    if (boleto.linkBoleto) {
      await sleep(800);
      await evo.enviarDocumento(telefone, {
        url: boleto.linkBoleto,
        nomeArquivo: `boleto_${boleto.id}.pdf`,
        legenda: `📎 Boleto — ${boleto.vencimentoFormatado}`,
      });
    }

    logger.info(`[Boletos] Boleto ${boleto.id} enviado para ${telefone}`);
    return res.json({ ok: true, telefone, boleto });
  } catch (err) {
    logger.error(`[Boletos] enviar-whatsapp: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  GET /boletos/cliente/:clienteId/abertos
// ════════════════════════════════════════════════════════════════════════════
router.get('/cliente/:clienteId/abertos', async (req, res) => {
  try {
    const cobrancas = await ixc.buscarCobrancasAbertas(req.params.clienteId);
    return res.json({ total: cobrancas.length, cobrancas });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  POST /boletos/cliente/:clienteId/enviar-todos
//  Envia todas as cobranças em aberto de um cliente no WhatsApp
//
//  Body: { telefone: string }
// ════════════════════════════════════════════════════════════════════════════
router.post('/cliente/:clienteId/enviar-todos', async (req, res) => {
  const { telefone } = req.body;
  if (!telefone) return res.status(400).json({ error: '"telefone" é obrigatório' });

  try {
    const cobrancas = await ixc.buscarCobrancasAbertas(req.params.clienteId);

    if (cobrancas.length === 0) {
      const cliente = await ixc.buscarClientePorId(req.params.clienteId).catch(() => null);
      await evo.enviarTexto(telefone, evo.Templates.semCobrancasAbertas(cliente?.razao || 'cliente'));
      return res.json({ ok: true, enviados: 0 });
    }

    const enviados = [];
    const erros = [];

    for (const cobranca of cobrancas) {
      try {
        const boleto = await ixc.buscarDetalheCobranca(cobranca.id);
        if (boleto.status === 'P') continue;

        await evo.enviarTexto(telefone, evo.Templates.boletoDetalhes(boleto));

        if (boleto.linkBoleto) {
          await sleep(600);
          await evo.enviarDocumento(telefone, {
            url: boleto.linkBoleto,
            nomeArquivo: `boleto_${boleto.id}.pdf`,
            legenda: `📎 Boleto ${boleto.vencimentoFormatado}`,
          });
        }

        enviados.push(boleto.id);
        await sleep(1000);
      } catch (err) {
        erros.push({ id: cobranca.id, erro: err.message });
        logger.error(`[Boletos] enviar-todos cobranca ${cobranca.id}: ${err.message}`);
      }
    }

    return res.json({ ok: true, enviados: enviados.length, ids: enviados, erros });
  } catch (err) {
    logger.error(`[Boletos] enviar-todos: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
