# Evolution GO — Guia Técnico de Integração

## Resumo do Diagnóstico

Este documento descreve a revisão completa da integração Evolution GO no sistema WOOWFLOW.
Foram identificados **6 bugs críticos** (já corrigidos) e **35 ações ausentes** (implementadas).

---

## Bugs encontrados e corrigidos

| # | Arquivo | Problema | Impacto |
|---|---------|----------|---------|
| 1 | `evolutionApi/entry.ts` | Variável `globalKey` usada mas nunca declarada | Quebrava 20+ actions em produção (`ReferenceError`) |
| 2 | `evolutionApi/entry.ts` | Chave `}` extra em `create_instance` | Criação de instância sempre retornava "Action inválida" |
| 3 | `evolutionWebhook/entry.ts` | Dois blocos `if (event === 'HistorySync')` | Segundo bloco era código morto |
| 4 | `entities/Message.jsonc` | `status: 'received'` fora do enum | Webhook falhava silenciosamente ao salvar mensagens |
| 5 | `evolutionWebhook/entry.ts` | Deduplicação por `timestamp` | Mensagens duplicadas quando chegavam no mesmo segundo |
| 6 | `evolutionApi/entry.ts` | `send_message` não salvava `wa_message_id` | Status da mensagem nunca atualizava via Receipt |

---

## Arquivos alterados

| Arquivo | O que mudou |
|---------|------------|
| `base44/functions/evolutionApi/entry.ts` | Corrigidos os 2 bugs críticos; adicionadas 35 novas actions; suporte a variáveis `EVOLUTION_GO_*`; helper `resolveToken()` que usa `EVOLUTION_GO_INSTANCE_TOKEN` direto (sem chamada extra à API) |
| `base44/functions/evolutionWebhook/entry.ts` | Reescrito: HistorySync unificado; deduplicação por `wa_message_id`; handler de `Receipt` para atualizar status; detecta tipo de mídia (location, reaction, poll, contact) |
| `base44/entities/Message.jsonc` | Adicionado `received` ao enum de status; adicionados `location`, `reaction`, `poll`, `contact` ao enum de type |
| `src/services/evolutionGo/evolutionGoClient.js` | Reescrito com 60+ funções cobrindo todas as rotas do Postman Collection |
| `src/pages/Inbox.jsx` | `sendMessageContent` agora salva `wa_message_id`, valida instância conectada, mostra erro claro |
| `.env.example` | Documentado com variáveis `EVOLUTION_GO_*` completas + retrocompatibilidade |

---

## Variáveis de Ambiente

Configure no painel **Base44 > Variáveis de Ambiente** (nunca em arquivos commitados):

```env
# URL do servidor Evolution GO
EVOLUTION_GO_BASE_URL=https://meu-evolution-go.dominio.com

# Token de admin (GLOBAL_API_KEY do Evolution GO)
# Usado em: /instance/all, /instance/create, /instance/delete, /instance/logs
EVOLUTION_GO_ADMIN_TOKEN=seu_admin_token_aqui

# Token da instância (apikey da instância no painel Evolution GO)
# Usado em: /send/*, /user/*, /chat/*, /message/*, /group/*, /instance/status, /instance/qr
# Se preenchido, cada chamada usa este token diretamente (sem overhead de /instance/all)
EVOLUTION_GO_INSTANCE_TOKEN=seu_instance_token_aqui

# ID ou nome da instância padrão
EVOLUTION_GO_INSTANCE_ID=CONNECT

# URL pública do webhook (deve ser acessível pela internet)
EVOLUTION_GO_WEBHOOK_URL=https://meu-dominio.com/functions/evolutionWebhook?key=seu_admin_token_aqui
```

> Os nomes antigos `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME` continuam funcionando como fallback.

---

## Cobertura de rotas (Postman Collection)

### Instance
| Rota Postman | Action backend | Status |
|---|---|---|
| `POST /instance/create` | `create_instance` | ✅ |
| `GET /instance/all` | `list_instances` | ✅ |
| `GET /instance/info/:id` | `get_instance_info` | ✅ |
| `GET /instance/logs/:id` | `get_instance_logs` | ✅ |
| `DELETE /instance/delete/:id` | `delete_instance` | ✅ |
| `POST /instance/connect` | `connect_instance` | ✅ |
| `GET /instance/status` | `get_instance_info` | ✅ |
| `GET /instance/qr` | `get_qrcode` | ✅ |
| `POST /instance/pair` | `pair_instance` | ✅ |
| `POST /instance/disconnect` | `disconnect_instance` | ✅ **novo** |
| `POST /instance/reconnect` | `reconnect_instance` | ✅ |
| `DELETE /instance/logout` | `logout_instance` | ✅ |
| `POST /instance/forcereconnect/:id` | `force_reconnect` | ✅ **novo** |
| `GET /instance/:id/advanced-settings` | `get_advanced_settings` | ✅ **novo** |
| `PUT /instance/:id/advanced-settings` | `update_advanced_settings` | ✅ **novo** |

### Send Message
| Rota Postman | Action backend | Status |
|---|---|---|
| `POST /send/text` | `send_message` | ✅ |
| `POST /send/link` | `send_link` | ✅ |
| `POST /send/media` | `send_media` | ✅ |
| `POST /send/poll` | `send_poll` | ✅ **novo** |
| `POST /send/sticker` | `send_sticker` | ✅ **novo** |
| `POST /send/location` | `send_location` | ✅ |
| `POST /send/contact` | `send_contact` | ✅ **novo** |
| `POST /send/button` | `send_button` | ✅ **novo** |
| `POST /send/list` | `send_list` | ✅ **novo** |
| `POST /send/carousel` | `send_carousel` | ✅ **novo** |

### User
| Rota Postman | Action backend | Status |
|---|---|---|
| `POST /user/info` | `get_user_info` | ✅ |
| `POST /user/check` | `check_user` | ✅ |
| `POST /user/avatar` | `get_avatar` | ✅ |
| `GET /user/contacts` | `get_contacts` | ✅ |
| `GET /user/privacy` | `get_privacy` | ✅ **novo** |
| `POST /user/block` | `block_user` | ✅ **novo** |
| `POST /user/unblock` | `unblock_user` | ✅ **novo** |
| `GET /user/blocklist` | `get_blocklist` | ✅ **novo** |
| `POST /user/profilePicture` | `set_profile_picture` | ✅ **novo** |
| `POST /user/profileName` | `set_profile_name` | ✅ **novo** |
| `POST /user/profileStatus` | `set_profile_status` | ✅ **novo** |

### Message
| Rota Postman | Action backend | Status |
|---|---|---|
| `POST /message/react` | `react_message` | ✅ |
| `POST /message/presence` | `presence` | ✅ |
| `POST /message/markread` | `mark_read` | ✅ |
| `POST /message/downloadmedia` | `download_media` | ✅ **novo** |
| `POST /message/status` | `get_message_status` | ✅ **novo** |
| `POST /message/delete` | `delete_message` | ✅ |
| `POST /message/edit` | `edit_message` | ✅ |

### Chat
| Rota Postman | Action backend | Status |
|---|---|---|
| `POST /chat/pin` | `pin_chat` | ✅ |
| `POST /chat/unpin` | `unpin_chat` | ✅ |
| `POST /chat/archive` | `archive_chat` | ✅ |
| `POST /chat/unarchive` | `unarchive_chat` | ✅ |
| `POST /chat/mute` | `mute_chat` | ✅ |
| `POST /chat/unmute` | `unmute_chat` | ✅ |
| `POST /chat/history-sync` | `sync_history` | ✅ |

### Group
| Rota Postman | Action backend | Status |
|---|---|---|
| `GET /group/list` | `group_list` | ✅ **novo** |
| `GET /group/myall` | `group_myall` | ✅ **novo** |
| `POST /group/info` | `group_info` | ✅ **novo** |
| `POST /group/invitelink` | `group_invite_link` | ✅ **novo** |
| `POST /group/photo` | `group_update_photo` | ✅ **novo** |
| `POST /group/name` | `group_update_name` | ✅ **novo** |
| `POST /group/description` | `group_update_description` | ✅ **novo** |
| `POST /group/create` | `group_create` | ✅ **novo** |
| `POST /group/participant` | `group_participant` | ✅ **novo** |
| `POST /group/join` | `group_join` | ✅ **novo** |
| `POST /group/leave` | `group_leave` | ✅ **novo** |

### Call / Community / Label / Newsletter / Polls / Server
| Rota Postman | Action backend | Status |
|---|---|---|
| `POST /call/reject` | `reject_call` | ✅ **novo** |
| `POST /community/create` | `community_create` | ✅ **novo** |
| `POST /community/add` | `community_add` | ✅ **novo** |
| `POST /community/remove` | `community_remove` | ✅ **novo** |
| `GET /label/list` | `label_list` | ✅ **novo** |
| `POST /label/chat` | `label_chat` | ✅ **novo** |
| `POST /unlabel/chat` | `unlabel_chat` | ✅ **novo** |
| `POST /label/message` | `label_message` | ✅ **novo** |
| `POST /unlabel/message` | `unlabel_message` | ✅ **novo** |
| `POST /label/edit` | `label_edit` | ✅ **novo** |
| `GET /polls/:id/results` | `get_poll_results` | ✅ **novo** |
| `GET /server/ok` | `server_health` | ✅ **novo** |
| Newsletter (create/list/info/link/subscribe/messages) | — | ⏳ pendente (pouco usado em omnichannel) |

---

## Como testar cada rota

### 1. Health check da conexão
```js
const { evo } = await import("@/services/evolutionGo/evolutionGoClient");
const r = await evo.serverHealth();
console.log(r); // { success: true, status: 200 }
```

### 2. Listar instâncias
```js
const r = await evo.listInstances();
console.log(r.instances); // [{ id, name, state, phone, profileName }]
```

### 3. Gerar QR Code
```js
const r = await evo.getQrCode("CONNECT");
console.log(r.qrcode); // data:image/png;base64,...
// Se r.qrcode for null e r.state === "connected" → já está conectada
```

### 4. Enviar texto
```js
const r = await evo.sendText("5511999999999", "Teste de integração");
console.log(r); // { success: true, result: {...}, wa_message_id: "3EB0..." }
```

### 5. Enviar mídia
```js
const r = await evo.sendMedia("5511999999999", "https://example.com/file.pdf", "document", {
  caption: "Contrato",
  filename: "contrato.pdf"
});
```

### 6. Enviar enquete
```js
const r = await evo.sendPoll("5511999999999", "Horário preferido?", ["Manhã", "Tarde", "Noite"], 1);
```

### 7. Verificar webhook
O webhook está em `base44/functions/evolutionWebhook`.
Configure na Evolution GO:
```
POST /instance/connect
{
  "subscribe": ["ALL"],
  "webhookUrl": "https://SEU-APP.base44.app/functions/evolutionWebhook?key=SEU_ADMIN_TOKEN"
}
```

Teste enviando uma mensagem para o número conectado — deve aparecer em `Conversation` e `Message` no banco Base44.

### 8. Testar Receipt (status da mensagem)
Envie uma mensagem e espere o contato ler. O evento `Receipt` com `state: "Read"` deve chegar no webhook e atualizar `Message.status = "read"` no banco.

### 9. Grupos
```js
const grupos = await evo.groupList();
console.log(grupos.groups);
```

### 10. Etiquetas
```js
const labels = await evo.labelList();
await evo.labelChat("5511999999999@s.whatsapp.net", labels.labels[0].id);
```

---

## Checklist final da integração

- [x] **Backend proxy seguro** — nenhum token exposto no frontend
- [x] **Variáveis de ambiente** — `EVOLUTION_GO_*` + fallback para nomes antigos
- [x] **Instância sincroniza** — `list_instances`, `get_instance_info`, `get_qrcode`
- [x] **QR Code aparece** — `get_qrcode` + `connect_instance` + polling no frontend
- [x] **Status atualiza** — `get_instance_info` + eventos `Connected`/`LoggedOut` no webhook
- [x] **Inbox carrega conversas reais** — `get_chats` / `get_contacts` → `Conversation.list`
- [x] **Histórico carrega mensagens reais** — webhook `Message` e `HistorySync` salvam no banco
- [x] **Envio de texto funciona** — `send_message` com `wa_message_id` retornado e salvo
- [x] **Envio de mídia implementado** — `send_media` (image/video/audio/document)
- [x] **Recebimento via webhook funciona** — `Message` → salva `Conversation` + `Message`
- [x] **Mensagens não duplicam** — deduplicação por `wa_message_id`
- [x] **Status da mensagem atualiza** — `Receipt` → `Message.status = delivered/read`
- [x] **Tokens não aparecem no frontend** — tudo via backend proxy (`evolutionApi` function)
- [x] **Tratamento de erro padronizado** — todas as actions retornam `{ success, error, details }`
- [x] **Logs de integração** — `IntegrationLog.create` em todas as ações críticas
- [x] **Reconexão disponível** — `reconnect_instance`, `disconnect_instance`, `force_reconnect`
- [x] **Grupos implementados** — `group_list`, `group_create`, `group_participant` etc.
- [x] **Etiquetas implementadas** — `label_list`, `label_chat`, `unlabel_chat` etc.
- [x] **Download de mídia** — `download_media`
- [x] **Enquetes** — `send_poll`, `get_poll_results`
- [ ] Newsletter (create/list/info) — pendente (baixa prioridade para omnichannel)

---

## Diferença entre disconnect vs logout

| Ação | Endpoint | Efeito |
|------|----------|--------|
| `disconnect_instance` | `POST /instance/disconnect` | Desconecta a sessão mas **mantém** o par de chaves. Reconecta sem novo QR. |
| `logout_instance` | `DELETE /instance/logout` | Logout completo. **Apaga** sessão. Próxima conexão exige novo QR. |
| `reconnect_instance` | `POST /instance/reconnect` | Tenta reconexão automática da sessão existente. |
| `force_reconnect` | `POST /instance/forcereconnect/:id` | Força reconexão mesmo que já conectado. |

---

*Última atualização: Julho 2026 | Baseado no Postman Collection "Evolution GO"*
