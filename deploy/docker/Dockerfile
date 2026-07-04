# ══════════════════════════════════════════════════════
#  WOOWFLOW — Dockerfile
# ══════════════════════════════════════════════════════

FROM node:20-alpine AS base
WORKDIR /app

# Instala dependências de produção apenas
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Imagem final
FROM base AS runner
ENV NODE_ENV=production

# Cria usuário não-root
RUN addgroup -S woowflow && adduser -S woowflow -G woowflow

# Copia arquivos
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./

# Cria diretório de logs
RUN mkdir -p logs && chown -R woowflow:woowflow /app

USER woowflow

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
