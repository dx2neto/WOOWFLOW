const { Router } = require('express');
const router = Router();
const logger = require('../utils/logger');
const ixc = require('../services/ixcService');
const evo = require('../services/evolutionService');

const DELAY_ENTRE_ENVIOS = 600; // ms — evita flood na Evolution

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pegarTelefone(cliente) {
  return (
    cliente.celular ||
    cliente.fone_celular ||
    cliente.tel_celular ||
    null
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  POST /notificacoes/cobrancas-vencidas
//  Disparo em massa de clientes com faturas vencidas
//
//  Body: { diasAtraso?: number (padrão 1), limite?: number (padrão 100) }
// ════════════════════════════════════════════════════════════════════════════
router.post('/cobrancas-vencidas', async (req, res) => {
  const { diasAtraso = 1, limite = 100 } = req.body;

  try {
    logger.info(`[Notif] Iniciando disparo de cobranças vencidas (diasAtraso=${diasAtraso})`);
    const cobrancas = await ixc.buscarCobrancasVencidas(diasAtraso, limite);

    if (cobrancas.length === 0) {
      return res.json({ ok: true, total: 0, enviados: 0, msg: 'Sem cobranças vencidas.' });
    }

    const resultados = [];

    for (const cobranca of cobrancas) {
      const resultado = { cobrancaId: cobranca.id, clienteId: cobranca.id_cliente };

      try {
        const cliente = await ixc.buscarClientePorId(cobranca.id_cliente);
        const telefone = pegarTelefone(cliente);

        if (!telefone) {
          resultado.status = 'sem_telefone';
          resultados.push(resultado);
          continue;
        }

        const diasAtrasoCalc = ixc.calcularDiasAtraso(cobranca.data_vencimento);

        const msg = evo.Templates.avisoCobrancaVencida({
          nomeCliente: cliente.razao,
          valorFormatado: `R$ ${ixc.formatarMoeda(cobranca.valor)}`,
          vencimentoFormatado: ixc.formatarData(cobranca.data_vencimento),
          diasAtraso: diasAtrasoCalc,
        });

        await evo.enviarTexto(telefone, msg);

        resultado.status = 'enviado';
        resultado.telefone = telefone;
        resultado.cliente = cliente.razao;

        await sleep(DELAY_ENTRE_ENVIOS);
      } catch (err) {
        resultado.status = 'erro';
        resultado.erro = err.message;
        logger.error(`[Notif] Erro cobranca ${cobranca.id}: ${err.message}`);
      }

      resultados.push(resultado);
    }

    const resumo = {
      ok: true,
      total: cobrancas.length,
      enviados: resultados.filter((r) => r.status === 'enviado').length,
      semTelefone: resultados.filter((r) => r.status === 'sem_telefone').length,
      erros: resultados.filter((r) => r.status === 'erro').length,
      detalhes: resultados,
    };

    logger.info(`[Notif] Resultado: ${resumo.enviados} enviados, ${resumo.erros} erros`);
    return res.json(resumo);
  } catch (err) {
    logger.error(`[Notif] cobrancas-vencidas: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  POST /notificacoes/vencimento-proximo
//  Avisa clientes que a fatura vence nos próximos N dias
//
//  Body: { diasAntes?: number (padrão 3), limite?: number (padrão 100) }
// ════════════════════════════════════════════════════════════════════════════
router.post('/vencimento-proximo', async (req, res) => {
  const { diasAntes = 3, limite = 100 } = req.body;

  try {
    const hoje = new Date();
    const dataAlvo = new Date(hoje);
    dataAlvo.setDate(dataAlvo.getDate() + diasAntes);
    const dataStr = dataAlvo.toISOString().split('T')[0];

    // Busca cobranças que vencem exatamente em N dias
    const { data } = await require('axios').create({
      baseURL: process.env.IXC_BASE_URL,
      auth: { username: process.env.IXC_USERNAME, password: process.env.IXC_TOKEN },
    }).post('/fn_areceber', {
      qtype: 'fn_areceber.data_vencimento',
      query: dataStr,
      oper: '=',
      page: '1',
      rp: String(limite),
      sortname: 'fn_areceber.id_cliente',
      sortorder: 'asc',
    });

    const cobrancas = (data?.registros ?? []).filter((c) => c.status !== 'P' && c.status !== 'C');
    const resultados = [];

    for (const cobranca of cobrancas) {
      const resultado = { cobrancaId: cobranca.id, clienteId: cobranca.id_cliente };
      try {
        const cliente = await ixc.buscarClientePorId(cobranca.id_cliente);
        const telefone = pegarTelefone(cliente);
        if (!telefone) { resultado.status = 'sem_telefone'; resultados.push(resultado); continue; }

        const msg = evo.Templates.avisoProximoVencimento({
          nomeCliente: cliente.razao,
          valorFormatado: `R$ ${ixc.formatarMoeda(cobranca.valor)}`,
          vencimentoFormatado: ixc.formatarData(cobranca.data_vencimento),
        });

        await evo.enviarTexto(telefone, msg);
        resultado.status = 'enviado';
        resultado.telefone = telefone;
        await sleep(DELAY_ENTRE_ENVIOS);
      } catch (err) {
        resultado.status = 'erro';
        resultado.erro = err.message;
      }
      resultados.push(resultado);
    }

    return res.json({
      ok: true,
      total: cobrancas.length,
      enviados: resultados.filter((r) => r.status === 'enviado').length,
      detalhes: resultados,
    });
  } catch (err) {
    logger.error(`[Notif] vencimento-proximo: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  POST /notificacoes/cliente/:id
//  Envia mensagem personalizada para um cliente específico
//
//  Body: { mensagem: string, telefoneOverride?: string }
// ════════════════════════════════════════════════════════════════════════════
router.post('/cliente/:id', async (req, res) => {
  const { mensagem, telefoneOverride } = req.body;
  if (!mensagem) return res.status(400).json({ error: '"mensagem" é obrigatória' });

  try {
    const cliente = await ixc.buscarClientePorId(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });

    const telefone = telefoneOverride || pegarTelefone(cliente);
    if (!telefone) return res.status(422).json({ error: 'Cliente sem número de celular' });

    await evo.enviarTexto(telefone, mensagem);
    return res.json({ ok: true, cliente: { id: cliente.id, nome: cliente.razao }, telefone });
  } catch (err) {
    logger.error(`[Notif] cliente/${req.params.id}: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  POST /notificacoes/boleto/:idCobranca
//  Gera e envia a 2ª via de uma cobrança específica
//
//  Body: { telefone: string }
// ════════════════════════════════════════════════════════════════════════════
router.post('/boleto/:idCobranca', async (req, res) => {
  const { telefone, telefoneOverride } = req.body;
  const fone = telefone || telefoneOverride;
  if (!fone) return res.status(400).json({ error: '"telefone" é obrigatório' });

  try {
    const boleto = await ixc.buscarDetalheCobranca(req.params.idCobranca);
    if (!boleto) return res.status(404).json({ error: 'Cobrança não encontrada' });
    if (boleto.status === 'P') return res.status(422).json({ error: 'Cobrança já paga' });

    const msg = evo.Templates.boletoDetalhes(boleto);
    await evo.enviarTexto(fone, msg);

    if (boleto.linkBoleto) {
      await sleep(800);
      await evo.enviarDocumento(fone, {
        url: boleto.linkBoleto,
        nomeArquivo: `boleto_${boleto.id}.pdf`,
        legenda: `📎 Boleto — ${boleto.vencimentoFormatado}`,
      });
    }

    return res.json({ ok: true, telefone: fone, boleto });
  } catch (err) {
    logger.error(`[Notif] boleto/${req.params.idCobranca}: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
