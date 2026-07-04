# 🔁 WOOWFLOW v2 — IXC Soft + Evolution API

> Integração completa entre **IXC Soft** e **Evolution API (WhatsApp)** para provedores de internet.

---

## 🚀 Instalação rápida

```bash
# 1. Clone e instale
npm install

# 2. Configure o ambiente
cp .env.example .env
nano .env          # preencha IXC e Evolution

# 3. Teste as conexões
npm test

# 4. Inicie
npm start
```

---

## ⚙️ .env — Variáveis obrigatórias

| Variável              | Exemplo                                    |
|-----------------------|--------------------------------------------|
| `IXC_BASE_URL`        | `https://seuixc.com.br/webservice/v1`      |
| `IXC_TOKEN`           | `abc123...`                                |
| `IXC_USERNAME`        | `admin`                                    |
| `EVOLUTION_BASE_URL`  | `https://api.evolution.seudominio.com`     |
| `EVOLUTION_API_KEY`   | `sua-apikey`                               |
| `EVOLUTION_INSTANCE`  | `minha-instancia`                          |
| `BASE_URL`            | `https://seudominio.com` (para webhook)    |
| `WEBHOOK_SECRET`      | string aleatória (segurança)               |

---

## 📡 Configurar webhook na Evolution API

Após iniciar o servidor, execute:

```bash
curl -X POST http://localhost:3000/admin/configurar-webhook \
  -H "Content-Type: application/json" \
  -d '{ "baseUrl": "https://SEU_DOMINIO.com" }'
```

Ou manualmente:

```bash
curl -X POST https://SUA_EVOLUTION/webhook/set/INSTANCIA \
  -H "apikey: SUA_APIKEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://seudominio.com/webhook/evolution",
    "webhook_by_events": true,
    "webhook_base64": false,
    "events": ["MESSAGES_UPSERT"]
  }'
```

---

## 🗺️ Todas as rotas

### 🤖 Chatbot (automático via WhatsApp)
| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/webhook/evolution` | Recebe mensagens da Evolution API |

**Fluxo do chatbot:**
1. Cliente manda qualquer mensagem
2. Bot identifica pelo número → busca no IXC
3. Exibe menu com botões: **Conta / Boleto / Atendente**
4. Conta não encontrada → solicita CPF
5. Boleto → gera 2ª via com linha digitável + PIX + PDF

---

### 📢 Notificações (IXC → WhatsApp)
| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/notificacoes/cobrancas-vencidas` | Dispara aviso para clientes com fatura vencida |
| `POST` | `/notificacoes/vencimento-proximo` | Avisa clientes com vencimento nos próximos N dias |
| `POST` | `/notificacoes/cliente/:id` | Mensagem personalizada para um cliente |
| `POST` | `/notificacoes/boleto/:idCobranca` | Envia 2ª via de uma cobrança específica |

**Exemplos:**
```bash
# Notificar todos os clientes vencidos há 3+ dias
curl -X POST http://localhost:3000/notificacoes/cobrancas-vencidas \
  -H "Content-Type: application/json" \
  -d '{ "diasAtraso": 3, "limite": 200 }'

# Avisar vencimentos de amanhã
curl -X POST http://localhost:3000/notificacoes/vencimento-proximo \
  -H "Content-Type: application/json" \
  -d '{ "diasAntes": 1 }'

# Mensagem customizada
curl -X POST http://localhost:3000/notificacoes/cliente/123 \
  -H "Content-Type: application/json" \
  -d '{ "mensagem": "Seu serviço está em manutenção prevista para amanhã." }'
```

---

### 🧾 Boletos
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET`  | `/boletos/:id` | Detalhes de uma cobrança |
| `POST` | `/boletos/:id/enviar-whatsapp` | Envia 2ª via no WhatsApp |
| `GET`  | `/boletos/cliente/:id/abertos` | Lista cobranças em aberto |
| `POST` | `/boletos/cliente/:id/enviar-todos` | Envia todos os boletos abertos |

---

### 👥 Clientes
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET`  | `/clientes/buscar?telefone=` | Busca por telefone |
| `GET`  | `/clientes/buscar?cpf=` | Busca por CPF |
| `GET`  | `/clientes/:id` | Dados do cliente |
| `GET`  | `/clientes/:id/contratos` | Contratos ativos |
| `GET`  | `/clientes/:id/cobrancas` | Cobranças em aberto |
| `GET`  | `/clientes/:id/tickets` | Tickets de suporte |
| `POST` | `/clientes/:id/tickets` | Abre novo ticket no IXC |

---

### ⚙️ Admin
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET`  | `/admin/status` | Status da instância Evolution |
| `POST` | `/admin/configurar-webhook` | Registra webhook na Evolution |
| `GET`  | `/admin/sessoes` | Quantidade de sessões ativas |
| `DELETE` | `/admin/sessoes/:numero` | Remove sessão de um número |
| `POST` | `/admin/checar-numero` | Verifica se número tem WhatsApp |
| `GET`  | `/health` | Health check do servidor |

---

## ⏰ Cron — Disparos automáticos

Adicione ao crontab (`crontab -e`):

```cron
# Notificar vencidos todo dia às 8h
0 8 * * * curl -s -X POST http://localhost:3000/notificacoes/cobrancas-vencidas -H "Content-Type: application/json" -d '{"diasAtraso":1}' >> /var/log/woowflow.log

# Avisar vencimentos de amanhã todo dia às 16h
0 16 * * * curl -s -X POST http://localhost:3000/notificacoes/vencimento-proximo -H "Content-Type: application/json" -d '{"diasAntes":1}' >> /var/log/woowflow.log
```

---

## 🔒 Segurança em produção

1. Configure `WEBHOOK_SECRET` no `.env`
2. Use HTTPS (Nginx + Certbot)
3. Configure rate limit no Nginx
4. Não exponha `/admin` publicamente (use autenticação ou firewall)

---

## 📦 Stack

- **Runtime**: Node.js 18+
- **Framework**: Express 4
- **Logging**: Winston
- **Segurança**: Helmet + express-rate-limit
- **APIs**: IXC Soft v1 REST + Evolution API v2
