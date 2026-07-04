const logger = require('./logger');

/**
 * Gerenciador de sessões em memória.
 * Para produção com múltiplos processos, substitua por Redis:
 *   npm install ioredis
 *   e use o adapter em src/utils/redisSessionManager.js
 */
class SessionManager {
  constructor(ttlMinutes = 30) {
    this.sessions = new Map();
    this.ttl = ttlMinutes * 60 * 1000;

    // Limpeza automática a cada 5 minutos
    setInterval(() => this._cleanup(), 5 * 60 * 1000);
    logger.info(`[Session] Iniciado — TTL: ${ttlMinutes}min`);
  }

  get(numero) {
    const sess = this.sessions.get(numero);
    if (!sess) return this._default();
    if (Date.now() - sess.updatedAt > this.ttl) {
      this.sessions.delete(numero);
      return this._default();
    }
    return sess;
  }

  set(numero, dados) {
    const current = this.get(numero);
    const next = { ...current, ...dados, updatedAt: Date.now() };
    this.sessions.set(numero, next);
    return next;
  }

  delete(numero) {
    this.sessions.delete(numero);
  }

  _default() {
    return { etapa: 'inicio', clienteId: null, clienteNome: null, updatedAt: Date.now() };
  }

  _cleanup() {
    const agora = Date.now();
    let removidas = 0;
    for (const [num, sess] of this.sessions.entries()) {
      if (agora - sess.updatedAt > this.ttl) {
        this.sessions.delete(num);
        removidas++;
      }
    }
    if (removidas > 0) logger.debug(`[Session] ${removidas} sessões expiradas removidas`);
  }

  stats() {
    return { ativas: this.sessions.size };
  }
}

module.exports = new SessionManager(Number(process.env.SESSION_TTL_MINUTES) || 30);
