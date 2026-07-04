const { Router } = require('express');
const router = Router();
const logger = require('../utils/logger');
const evo = require('../services/evolutionService');
const sessions = require('../utils/sessionManager');

// ════════════════════════════════════════════════════════════════════════════
//  GET /admin/status
//  Retorna status da instância Evolution e info do servidor
// ════════════════════════════════════════════════════════════════════════════
router.get('/status', async (req, res) => {
  try {
    const instancia = await evo.verificarStatusInstancia();
    return res.json({
      servidor: { uptime: process.uptime(), memoria: process.memoryUsage() },
      sessoesAtivas: sessions.stats().ativas,
      evolution: instancia,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  POST /admin/configurar-webhook
//  Registra o webhook desta aplicação na Evolution API automaticamente
// ════════════════════════════════════════════════════════════════════════════
router.post('/configurar-webhook', async (req, res) => {
  const baseUrl = req.body.baseUrl || process.env.BASE_URL;
  if (!baseUrl) return res.status(400).json({ error: '"baseUrl" é obrigatório ou configure BASE_URL no .env' });

  const urlWebhook = `${baseUrl.replace(/\/$/, '')}/webhook/evolution`;

  try {
    const result = await evo.configurarWebhook(urlWebhook);
    logger.info(`[Admin] Webhook configurado: ${urlWebhook}`);
    return res.json({ ok: true, urlWebhook, result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  GET /admin/sessoes
//  Lista sessões ativas
// ════════════════════════════════════════════════════════════════════════════
router.get('/sessoes', (req, res) => {
  return res.json(sessions.stats());
});

// ════════════════════════════════════════════════════════════════════════════
//  DELETE /admin/sessoes/:numero
//  Limpa sessão de um número específico
// ════════════════════════════════════════════════════════════════════════════
router.delete('/sessoes/:numero', (req, res) => {
  sessions.delete(req.params.numero);
  return res.json({ ok: true, msg: `Sessão de ${req.params.numero} removida` });
});

// ════════════════════════════════════════════════════════════════════════════
//  POST /admin/checar-numero
//  Verifica se um número está no WhatsApp
// ════════════════════════════════════════════════════════════════════════════
router.post('/checar-numero', async (req, res) => {
  const { telefone } = req.body;
  if (!telefone) return res.status(400).json({ error: '"telefone" é obrigatório' });

  try {
    const result = await evo.checarNumeroWhatsApp(telefone);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
