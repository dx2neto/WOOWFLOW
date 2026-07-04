const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(`[HTTP] ${req.method} ${req.path} → ${err.message}`, err);

  // Axios error (API externa)
  if (err.response) {
    const status = err.response.status;
    const msg = err.response.data?.message || err.response.statusText;
    return res.status(status >= 500 ? 502 : status).json({
      error: `Erro na API externa: ${msg}`,
      origem: err.config?.baseURL ?? 'desconhecida',
    });
  }

  // Timeout
  if (err.code === 'ECONNABORTED') {
    return res.status(504).json({ error: 'Timeout na chamada à API externa' });
  }

  return res.status(500).json({ error: 'Erro interno do servidor' });
}

module.exports = errorHandler;
