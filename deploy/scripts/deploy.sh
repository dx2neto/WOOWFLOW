#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  WOOWFLOW — Script de Deploy Completo (Ubuntu/Debian)
#  Uso: sudo bash deploy.sh
#
#  O que faz:
#   1. Instala Node.js 20, PM2, Nginx
#   2. Copia o projeto para /opt/woowflow
#   3. Instala dependências npm
#   4. Configura Nginx como reverse proxy
#   5. Inicia com PM2 e habilita no boot
#   6. Instala cron jobs de disparo
# ══════════════════════════════════════════════════════════════
set -e

DEPLOY_DIR="/opt/woowflow"
NGINX_CONF="/etc/nginx/sites-available/woowflow"
DOMAIN="${DOMAIN:-seudominio.com}"
PORT=3000

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  🚀 WOOWFLOW — Deploy Automático       ║"
echo "╚════════════════════════════════════════╝"
echo ""

# ── 1. Node.js 20 ────────────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  echo "→ Instalando Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "✅ Node.js: $(node -v)"

# ── 2. PM2 ───────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  echo "→ Instalando PM2..."
  npm install -g pm2
fi
echo "✅ PM2: $(pm2 -v)"

# ── 3. Nginx ─────────────────────────────────────────────────
if ! command -v nginx &>/dev/null; then
  echo "→ Instalando Nginx..."
  apt-get install -y nginx
fi
echo "✅ Nginx instalado"

# ── 4. Copia projeto ─────────────────────────────────────────
echo "→ Copiando projeto para $DEPLOY_DIR..."
mkdir -p "$DEPLOY_DIR/logs"
# Se executar a partir do diretório do projeto:
SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
rsync -a --exclude=node_modules --exclude=.git --exclude=logs \
  "$SCRIPT_DIR/" "$DEPLOY_DIR/"

# ── 5. .env ──────────────────────────────────────────────────
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  cp "$DEPLOY_DIR/.env.example" "$DEPLOY_DIR/.env"
  echo ""
  echo "⚠️  ATENÇÃO: Configure o arquivo $DEPLOY_DIR/.env antes de continuar!"
  echo "   nano $DEPLOY_DIR/.env"
  echo ""
  read -p "Pressione ENTER após configurar o .env..."
fi

# ── 6. npm install ───────────────────────────────────────────
echo "→ Instalando dependências npm..."
cd "$DEPLOY_DIR"
npm install --only=production

# ── 7. PM2 start ─────────────────────────────────────────────
echo "→ Iniciando com PM2..."
cp deploy/pm2/ecosystem.config.js "$DEPLOY_DIR/ecosystem.config.js"
# Ajusta o cwd no ecosystem.config.js
sed -i "s|/opt/woowflow|$DEPLOY_DIR|g" "$DEPLOY_DIR/ecosystem.config.js"

pm2 start "$DEPLOY_DIR/ecosystem.config.js" || pm2 reload woowflow
pm2 save
pm2 startup | tail -1 | bash || true

# ── 8. Nginx config ──────────────────────────────────────────
echo "→ Configurando Nginx..."
cp deploy/nginx/woowflow.conf "$NGINX_CONF"
sed -i "s/seudominio.com/$DOMAIN/g" "$NGINX_CONF"
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/woowflow 2>/dev/null || true
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl reload nginx
echo "✅ Nginx configurado"

# ── 9. SSL (Certbot) ─────────────────────────────────────────
if command -v certbot &>/dev/null; then
  echo "→ Configurando SSL com Certbot..."
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
    -m "admin@$DOMAIN" || echo "⚠️  SSL manual: certbot --nginx -d $DOMAIN"
else
  echo "→ Instalando Certbot..."
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
    -m "admin@$DOMAIN" || echo "⚠️  Execute: certbot --nginx -d $DOMAIN"
fi

# ── 10. Cron jobs ────────────────────────────────────────────
echo "→ Instalando cron jobs..."
CURRENT_CRON=$(crontab -l 2>/dev/null || echo "")
WOOW_CRON=$(grep -v "^#" deploy/scripts/crontab.txt | grep -v "^$")
if ! echo "$CURRENT_CRON" | grep -q "woowflow"; then
  (echo "$CURRENT_CRON"; echo "$WOOW_CRON") | crontab -
  echo "✅ Cron jobs instalados"
else
  echo "✅ Cron jobs já existentes"
fi

# ── 11. Registra webhook na Evolution ────────────────────────
echo "→ Registrando webhook na Evolution API..."
sleep 3  # aguarda o servidor subir
curl -s -X POST "http://localhost:$PORT/admin/configurar-webhook" \
  -H "Content-Type: application/json" \
  -d "{\"baseUrl\":\"https://$DOMAIN\"}" || \
  echo "⚠️  Configure o webhook manualmente: POST /admin/configurar-webhook"

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║  ✅  WOOWFLOW em produção!                        ║"
echo "║                                                   ║"
echo "║  🌐 URL:     https://$DOMAIN"
echo "║  📊 Status:  pm2 status"
echo "║  📋 Logs:    pm2 logs woowflow"
echo "║  🔗 Health:  curl https://$DOMAIN/health"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
