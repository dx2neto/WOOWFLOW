# Integracoes Omnichannel e IA

Este documento descreve a estrutura de integracoes do WOOWFLOW para provedores de internet. A regra principal e simples: o frontend nunca recebe tokens sensiveis. Todo acesso a ERP, Evolution GO, Meta, TikTok, e-mail, telefonia, assinatura digital e IA deve passar por funcoes backend Base44.

## Integracoes Disponiveis

| Integracao | Service | Backend | Canal no Inbox | Status |
| --- | --- | --- | --- | --- |
| ERP do provedor | `erp_provider` | `erpApi` | dados operacionais | configuravel |
| WhatsApp Evolution GO | `evolution_go` | `evolutionApi`, `evolutionWebhook` | `whatsapp` | operacional com credenciais |
| Facebook Messenger | `facebook_messenger` | `metaApi` | `facebook` | estrutura OAuth/webhook |
| Instagram Direct | `instagram_direct` | `metaApi` | `instagram` | estrutura OAuth/webhook |
| TikTok | `tiktok` | `tiktokApi` | `tiktok` | leads/eventos/campanhas |
| E-mail | `email` | `emailApi` | `email` | IMAP/SMTP + IA |
| Telefonia/PABX | `telephony_pabx` | `telephonyApi` | `telefone` | API configuravel |
| CRM | `crm` | `crmApi` | CRM interno | ativo internamente |
| Cobranca | `billing` | `billingApi` | automacoes/Inbox | depende do ERP |
| Assinatura digital | `digital_signature` | `signatureApi` | contratos/conversas | ZapSign ou API |
| IA atendimento e vendas | `ai_sales_support` | `aiOmnichannelApi` | todos os canais | configuravel |

## Variaveis de Ambiente

Configure secrets no backend Base44. Nao use prefixo `VITE_` para nenhuma credencial abaixo.

### Evolution GO

```txt
EVOLUTION_GO_BASE_URL=
EVOLUTION_GO_ADMIN_TOKEN=
EVOLUTION_GO_INSTANCE_TOKEN=
EVOLUTION_GO_INSTANCE_ID=
EVOLUTION_GO_WEBHOOK_URL=
EVOLUTION_GO_WEBHOOK_SECRET=
```

### ERP / Cobranca

```txt
ERP_API_URL=
ERP_API_TOKEN=
```

### Meta: Facebook Messenger e Instagram Direct

```txt
META_APP_ID=
META_APP_SECRET=
META_PAGE_ACCESS_TOKEN=
META_VERIFY_TOKEN=
```

### TikTok

```txt
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_WEBHOOK_SECRET=
```

Observacao: atendimento via DM depende da permissao/API disponivel para a conta TikTok. A estrutura atual cobre leads, comentarios, formularios, eventos e campanhas.

### E-mail

```txt
EMAIL_IMAP_HOST=
EMAIL_IMAP_PORT=
EMAIL_IMAP_USER=
EMAIL_IMAP_PASSWORD=
EMAIL_SMTP_HOST=
EMAIL_SMTP_PORT=
EMAIL_SMTP_USER=
EMAIL_SMTP_PASSWORD=
```

Gmail e Outlook podem ser ligados por OAuth quando os conectores forem configurados no Base44.

### Telefonia/PABX

```txt
PABX_API_URL=
PABX_API_TOKEN=
```

Provedores previstos: Asterisk, 3CX, Issabel ou API HTTP configuravel.

### Assinatura Digital

```txt
ZAPSIGN_API_TOKEN=
```

### IA

```txt
AI_PROVIDER=
AI_API_KEY=
AI_AUTO_REPLY=false
```

`auto_reply` nunca deve ser ativado por padrao. Use `disabled`, `suggestion`, `draft` ou `auto_reply`, exigindo confirmacao explicita para o modo automatico.

## Fluxos de Webhook

### WhatsApp Evolution GO

1. O usuario cria/conecta uma instancia em Integracoes.
2. `evolutionApi` chama rotas reais da Evolution GO: instancia, QR Code, status, envio, midia e historico.
3. A Evolution GO envia eventos para `evolutionWebhook`.
4. O webhook deduplica por `wa_message_id`/`provider_message_id`.
5. O webhook cria ou atualiza `Conversation` e salva `Message`.
6. A Inbox recebe as atualizacoes pelo subscribe das entidades Base44.

### Meta

1. Configure app, page token e verify token.
2. Ligue OAuth/pagina pelo painel/provider.
3. O webhook da Meta deve criar conversas com `channel` `facebook` ou `instagram`.
4. Respostas devem passar por `metaApi`.

### TikTok

1. Configure credenciais TikTok.
2. Receba leads, comentarios, formularios e eventos via webhook/backend.
3. Crie conversas no Inbox quando houver contato tratavel.

### E-mail

1. Configure IMAP para leitura e SMTP para envio.
2. Cada thread de e-mail deve virar `Conversation` com `channel=email`.
3. Mensagens devem salvar `provider_message_id`, assunto no `payload` e corpo em `content`.
4. IA pode sugerir resposta, gerar rascunho, classificar setor, prioridade e intencao.

### Telefonia/PABX

1. Configure API do PABX.
2. Eventos de chamada criam/atualizam atendimento no Inbox com `channel=telefone`.
3. Grave status, numero, cliente identificado, duracao e URL de gravacao quando existir.

## Modelo de Dados

`IntegrationConfig` suporta:

```txt
service, display_name, description, status, category, provider,
last_sync, error_message, is_active, settings, config,
created_at, updated_at
```

`Conversation` suporta:

```txt
customer_name, phone, email, channel, provider, provider_contact_id,
status, priority, sector, assigned_user_id, protocol,
last_message, last_message_time, unread, is_ai
```

`Message` suporta:

```txt
conversation_id, direction, type, content, media_url, media_base64,
file_name, mime_type, status, timestamp, sender_name,
provider_message_id, payload
```

## Como Testar

1. Abra `src/pages/Integrations.jsx`.
2. Clique em Configurar para criar/atualizar `IntegrationConfig`.
3. Clique em Testar. Sem secrets, o card deve ficar `pending` e mostrar as variaveis faltantes.
4. Configure secrets no Base44.
5. Teste novamente. O status deve virar `connected` quando as credenciais minimas existirem.
6. Para WhatsApp, abra Instancias, conecte via QR Code e envie uma mensagem real.
7. Confirme que a Inbox cria conversa e historico via webhook.

## Checklist de Seguranca

- [x] Nenhum wrapper frontend contem token sensivel.
- [x] Wrappers frontend usam `base44.functions.invoke`.
- [x] Secrets ficam em variaveis de ambiente backend.
- [x] `auto_reply` da IA nao e ativado por padrao.
- [x] Webhooks devem validar segredo/token antes de processar evento.
- [x] Mensagens devem ser deduplicadas por ID nativo do provedor.

## Checklist Final de Funcionamento

- [x] Pagina de integracoes mostra todos os cards obrigatorios.
- [x] Cada card tem status real ou configuravel.
- [x] Nenhum token aparece no frontend.
- [x] Evolution GO tem estrutura para instancia, QR Code, status, envio, midia, webhook e historico.
- [x] Inbox recebe mensagens pelo padrao `Conversation`/`Message`.
- [x] Facebook Messenger tem estrutura OAuth/webhook.
- [x] Instagram Direct tem estrutura OAuth/webhook.
- [x] TikTok tem card e estrutura gerenciavel.
- [x] E-mail tem configuracao e estrutura para IA de resposta.
- [x] Telefonia/PABX tem estrutura de integracao.
- [x] CRM e cobranca estao conectados ao fluxo do provedor.
- [x] Assinatura digital esta preparada.
- [x] IA para atendimento e vendas esta configuravel.
- [x] Documentacao foi criada.
- [x] Build validado na rodada atual.
- [ ] Sem mock/fake data no fluxo principal.
