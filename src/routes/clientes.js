const { Router } = require('express');
const router = Router();
const logger = require('../utils/logger');
const ixc = require('../services/ixcService');

// ════════════════════════════════════════════════════════════════════════════
//  GET /clientes/buscar
//  Query params: ?telefone= | ?cpf= | ?id=
// ════════════════════════════════════════════════════════════════════════════
router.get('/buscar', async (req, res) => {
  const { telefone, cpf, id } = req.query;

  try {
    if (id) {
      const cliente = await ixc.buscarClientePorId(id);
      if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
      return res.json(cliente);
    }

    if (cpf) {
      const cliente = await ixc.buscarClientePorCpf(cpf);
      if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
      return res.json(cliente);
    }

    if (telefone) {
      const clientes = await ixc.buscarClientePorTelefone(telefone);
      if (!clientes.length) return res.status(404).json({ error: 'Nenhum cliente encontrado' });
      return res.json({ total: clientes.length, clientes });
    }

    return res.status(400).json({ error: 'Informe ao menos um parâmetro: telefone, cpf ou id' });
  } catch (err) {
    logger.error(`[Clientes] buscar: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  GET /clientes/:id
// ════════════════════════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const cliente = await ixc.buscarClientePorId(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });
    return res.json(cliente);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  GET /clientes/:id/contratos
// ════════════════════════════════════════════════════════════════════════════
router.get('/:id/contratos', async (req, res) => {
  try {
    const contratos = await ixc.buscarContratosCliente(req.params.id);
    return res.json({ total: contratos.length, contratos });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  GET /clientes/:id/cobrancas
// ════════════════════════════════════════════════════════════════════════════
router.get('/:id/cobrancas', async (req, res) => {
  try {
    const cobrancas = await ixc.buscarCobrancasAbertas(req.params.id);
    return res.json({ total: cobrancas.length, cobrancas });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  GET /clientes/:id/tickets
// ════════════════════════════════════════════════════════════════════════════
router.get('/:id/tickets', async (req, res) => {
  try {
    const tickets = await ixc.buscarTicketsAbertos(req.params.id);
    return res.json({ total: tickets.length, tickets });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  POST /clientes/:id/tickets  — abre chamado no IXC
// ════════════════════════════════════════════════════════════════════════════
router.post('/:id/tickets', async (req, res) => {
  const { assunto, descricao, prioridade = 'N' } = req.body;
  if (!assunto || !descricao) {
    return res.status(400).json({ error: '"assunto" e "descricao" são obrigatórios' });
  }

  try {
    const ticket = await ixc.abrirTicket({
      clienteId: req.params.id,
      assunto,
      descricao,
      prioridade,
    });
    return res.status(201).json(ticket);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
