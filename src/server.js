require('dotenv').config();
require('express-async-errors');

const express    = require('express');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const logger     = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// ─── Rotas ───────────────────────────────────────────────────────────────────
const webhookRoutes      = require('./routes/webhook');
const notificacoesRoutes = require('./routes/notificacoes');
const clientesRoutes     = require('./routes/clientes');
const boletosRoutes      = require('./routes/boletos');
const adminRoutes        = require('./routes/admin');

const app = express();

// ════════════════════════════════════════════════════════════════════════════
//  MIDDLEWARES GLOBAIS
// ════════════════════════════════════════════════════════════════════════════

// Segurança HTTP
app.use(helmet());

// Parse JSON
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging HTTP
app.use(
  morgan('[:date[iso]] :method :url :status :response-time ms', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  })
);

// Rate limiting global (anti-flood)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
});
app.use(limiter);

// Rate limiting mais restrito para webhooks
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000, // Evolution pode disparar muitos eventos
  skip: () => false,
});

// ════════════════════════════════════════════════════════════════════════════
//  ROTAS
// ════════════════════════════════════════════════════════════════════════════

// Health check (sem rate limit)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: require('../package.json').version,
  });
});

// Webhook Evolution → IXC (recebe mensagens WhatsApp)
app.use('/webhook', webhookLimiter, webhookRoutes);

// IXC → Evolution (disparos e notificações)
app.use('/notificacoes', notificacoesRoutes);

// Consultas de clientes no IXC
app.use('/clientes', clientesRoutes);

// Boletos
app.use('/boletos', boletosRoutes);

// Administração / configuração
app.use('/admin', adminRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
});

// Handler global de erros
app.use(errorHandler);

// ════════════════════════════════════════════════════════════════════════════
//  START
// ════════════════════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info('══════════════════════════════════════════════');
  logger.info('  🚀 WOOWFLOW iniciado com sucesso!');
  logger.info(`  📡 Porta        : ${PORT}`);
  logger.info(`  🌐 Ambiente     : ${process.env.NODE_ENV || 'development'}`);
  logger.info(`  🏢 IXC URL      : ${process.env.IXC_BASE_URL || '(não configurado)'}`);
  logger.info(`  📱 Evolution    : ${process.env.EVOLUTION_INSTANCE || '(não configurado)'}`);
  logger.info(`  🔗 Webhook URL  : POST /webhook/evolution`);
  logger.info('══════════════════════════════════════════════');
  logger.info('  📋 Rotas disponíveis:');
  logger.info('     POST  /webhook/evolution          ← Evolution API');
  logger.info('     POST  /notificacoes/cobrancas-vencidas');
  logger.info('     POST  /notificacoes/vencimento-proximo');
  logger.info('     POST  /notificacoes/cliente/:id');
  logger.info('     POST  /notificacoes/boleto/:id');
  logger.info('     GET   /clientes/buscar?telefone=&cpf=&id=');
  logger.info('     GET   /clientes/:id/cobrancas');
  logger.info('     GET   /boletos/cliente/:id/abertos');
  logger.info('     POST  /boletos/:id/enviar-whatsapp');
  logger.info('     POST  /admin/configurar-webhook');
  logger.info('     GET   /admin/status');
  logger.info('══════════════════════════════════════════════');
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────
function shutdown(signal) {
  logger.info(`[Server] Recebido ${signal} — encerrando...`);
  server.close(() => {
    logger.info('[Server] Servidor encerrado.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  (err) => logger.error('[UNCAUGHT]', err));
process.on('unhandledRejection', (err) => logger.error('[UNHANDLED]', err));

module.exports = app;
