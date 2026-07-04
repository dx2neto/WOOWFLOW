// ══════════════════════════════════════════════════════
//  WOOWFLOW — PM2 Ecosystem
//  Uso:
//    pm2 start ecosystem.config.js
//    pm2 save
//    pm2 startup   ← gera comando para auto-iniciar no boot
// ══════════════════════════════════════════════════════
module.exports = {
  apps: [
    {
      name: 'woowflow',
      script: 'src/server.js',
      cwd: '/opt/woowflow',         // ajuste para seu diretório

      // ── Modo cluster: usa todos os núcleos disponíveis ───────
      instances: 'max',             // ou coloque número fixo: 2
      exec_mode: 'cluster',

      // ── Ambiente ────────────────────────────────────────────
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // ── Reinício automático ──────────────────────────────────
      watch: false,                 // nunca use watch em produção
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,

      // ── Logs ────────────────────────────────────────────────
      out_file: '/opt/woowflow/logs/pm2-out.log',
      error_file: '/opt/woowflow/logs/pm2-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      // ── Memória: reinicia se passar de 512MB ─────────────────
      max_memory_restart: '512M',

      // ── Node flags ──────────────────────────────────────────
      node_args: '--max-old-space-size=256',
    },
  ],
};
