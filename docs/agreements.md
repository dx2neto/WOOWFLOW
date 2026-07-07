# Módulo: Verificação de Acordo

> Versão 1.0 · WOOWFLOW · 2026-07-07

Documentação técnica completa do módulo de Verificação de Acordo integrado ao IXCSoft, ZapSign e Evolution Go (WhatsApp).

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Entidades](#3-entidades)
4. [Variáveis de Ambiente](#4-variáveis-de-ambiente)
5. [Função Backend — agreementApi](#5-função-backend--agreementapi)
6. [Status e Máquina de Estados](#6-status-e-máquina-de-estados)
7. [Integração IXCSoft](#7-integração-ixcsoft)
8. [Integração ZapSign](#8-integração-zapsign)
9. [Integração WhatsApp (Evolution Go)](#9-integração-whatsapp-evolution-go)
10. [Rotas e Páginas Frontend](#10-rotas-e-páginas-frontend)
11. [Componente AgreementCheckPanel](#11-componente-agreementcheckpanel)
12. [Dashboard](#12-dashboard)
13. [Workflow Automático](#13-workflow-automático)
14. [Auditoria e Logs](#14-auditoria-e-logs)
15. [Como Testar](#15-como-testar)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Visão Geral

O módulo de **Verificação de Acordo** permite ao atendente (e ao sistema automaticamente) verificar se um cliente possui acordo ativo de renegociação de dívida, integrando dados financeiros em tempo real do **IXCSoft** com assinatura digital via **ZapSign** e lembretes via **WhatsApp**.

### Fluxo principal

```
Atendente abre conversa no Inbox
        ↓
Aba "Acordo" chama agreementApi { action: "verify" }
        ↓
API busca cliente no IXCSoft por CPF/CNPJ, telefone ou ID
        ↓
Analisa faturas (fn_areceber): calcula status do acordo
        ↓
Retorna status + dados financeiros para o painel
        ↓
Atendente pode: gerar acordo ZapSign · enviar lembrete · criar novo acordo
```

---

## 2. Arquitetura

```
src/
  functions/
    agreementApi.js              ← wrapper frontend (base44.functions.invoke)
  pages/
    Agreements.jsx               ← lista paginada + cards de resumo
    AgreementDetail.jsx          ← detalhe / formulário novo acordo
    AgreementSettings.jsx        ← configurações + templates de mensagem
  components/
    agreements/
      AgreementCheckPanel.jsx    ← painel reutilizável (Inbox + CustomerProfile)

base44/
  entities/
    Agreement.jsonc
    AgreementInstallment.jsonc
    AgreementVerificationLog.jsonc
    AgreementSettings.jsonc
  functions/
    agreementApi/
      entry.ts                   ← Deno serverless — toda lógica de negócio
  workflows/
    AgreementVerification.jsonc  ← agendamento automático diário

docs/
  agreements.md                  ← este arquivo
```

---

## 3. Entidades

### Agreement

Registro principal de cada acordo de renegociação.

| Campo | Tipo | Descrição |
|---|---|---|
| `customer_id` | string | ID do cliente na base local |
| `ixc_customer_id` | string | ID do cliente no IXCSoft |
| `contract_id` | string | Contrato IXC relacionado |
| `conversation_id` | string | Conversa do Inbox que originou o acordo |
| `customer_name` | string | Nome do cliente |
| `customer_phone` | string | Telefone (com DDD, sem formatação) |
| `customer_cpf_cnpj` | string | CPF ou CNPJ |
| `customer_city` | string | Cidade |
| `origin` | enum | `ixc` / `local` / `manual` / `zapsign` |
| `status` | enum | Ver [seção 6](#6-status-e-máquina-de-estados) |
| `original_amount` | number | Valor original da dívida |
| `negotiated_amount` | number | Valor renegociado total |
| `paid_amount` | number | Valor já pago |
| `remaining_amount` | number | Saldo restante |
| `installments` | number | Total de parcelas |
| `paid_installments` | number | Parcelas pagas |
| `overdue_installments` | number | Parcelas em atraso |
| `next_due_date` | date | Data da próxima parcela |
| `next_installment_amount` | number | Valor da próxima parcela |
| `zapsign_document_id` | string | ID do documento no ZapSign |
| `zapsign_status` | enum | `pending` / `signed` / `refused` |
| `zapsign_url` | string | URL para assinatura |
| `zapsign_signed_at` | datetime | Data/hora da assinatura |
| `notes` | text | Observações internas |
| `created_by` | string | ID do usuário que criou |
| `recommended_action` | string | Sugestão automática de ação |

### AgreementInstallment

Parcelas individuais de cada acordo.

| Campo | Tipo | Descrição |
|---|---|---|
| `agreement_id` | string | FK → Agreement |
| `installment_number` | number | Número da parcela |
| `amount` | number | Valor |
| `due_date` | date | Vencimento |
| `paid_at` | datetime | Data do pagamento |
| `status` | enum | `pending` / `paid` / `overdue` / `cancelled` |
| `ixc_invoice_id` | string | ID da fatura no IXCSoft |
| `boleto_url` | string | URL do boleto |
| `pix_code` | string | Código PIX copia-e-cola |

### AgreementVerificationLog

Histórico de cada verificação executada (manual ou automática).

| Campo | Tipo | Descrição |
|---|---|---|
| `customer_id` | string | ID do cliente verificado |
| `conversation_id` | string | Conversa relacionada |
| `input_type` | enum | `customer_id` / `cpf_cnpj` / `phone` / `contract_id` / `conversation` / `workflow` |
| `input_value` | string | Valor usado na busca |
| `agreement_status` | string | Status encontrado |
| `has_agreement` | boolean | Se havia acordo ativo |
| `status` | enum | `success` / `error` / `not_found` |
| `error_message` | string | Mensagem de erro (se houver) |
| `result_summary` | text | JSON com resumo quantitativo |

### AgreementSettings

Singleton de configurações do módulo (apenas um registro na base).

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `tolerance_days_overdue` | number | 5 | Dias de atraso antes de marcar `overdue` |
| `days_to_mark_broken` | number | 15 | Dias de atraso antes de marcar `broken` |
| `auto_message_active` | text | — | Template WhatsApp para acordo ativo |
| `auto_message_overdue` | text | — | Template para acordo vencido |
| `auto_message_broken` | text | — | Template para acordo quebrado |
| `allow_unblock_on_agreement` | boolean | false | Permite desbloquear cliente ao fechar acordo |
| `require_zapsign` | boolean | false | Exige assinatura ZapSign para ativar acordo |
| `require_serasa` | boolean | false | Exige consulta Serasa antes de fechar acordo |
| `send_whatsapp_reminder` | boolean | true | Envia lembretes automáticos |
| `responsible_sector` | string | — | Setor responsável pelos acordos |
| `default_agent` | string | — | Agente padrão para novas conversas de acordo |

---

## 4. Variáveis de Ambiente

Configure em **Base44 → Configurações → Variáveis de Ambiente** (backend) e em `.env.local` (desenvolvimento local).

| Variável | Obrigatória | Descrição |
|---|---|---|
| `IXC_API_URL` | **Sim** | URL base da API IXCSoft (ex: `https://meu.ixc.com.br/webservice/v1`) |
| `IXC_API_TOKEN` | **Sim** | Token Base64 `usuario:token` do IXCSoft |
| `EVOLUTION_API_URL` | Não | URL do Evolution Go (default: servidor WOOWFLOW) |
| `EVOLUTION_API_KEY` | Não | Global API Key do Evolution Go |
| `EVOLUTION_INSTANCE_NAME` | Não | Nome da instância WhatsApp (default: `CONNECT`) |
| `ZAPSIGN_API_TOKEN` | Condicional | Obrigatório se `require_zapsign = true` |
| `SERASA_API_TOKEN` | Condicional | Obrigatório se `require_serasa = true` |

> **Atenção:** Se `IXC_API_URL` ou `IXC_API_TOKEN` não estiverem configurados, a função retorna erro `IXC_NOT_CONFIGURED` — não há modo degradado silencioso.

---

## 5. Função Backend — agreementApi

Deno serverless em `base44/functions/agreementApi/entry.ts`.

### Actions disponíveis

| Action | Método | Descrição |
|---|---|---|
| `verify` | — | Verifica acordo de um cliente (principal) |
| `list_agreements` | — | Lista acordos com filtros e paginação |
| `get_agreement` | — | Busca acordo por ID |
| `create_agreement` | — | Cria novo acordo manualmente |
| `update_agreement` | — | Atualiza campos de um acordo |
| `mark_broken` | — | Marca acordo como quebrado |
| `mark_paid` | — | Marca acordo como quitado |
| `add_installments` | — | Adiciona parcelas a um acordo |
| `send_reminder` | — | Envia lembrete WhatsApp |
| `generate_zapsign` | — | Gera documento ZapSign para assinatura |
| `zapsign_webhook` | — | Recebe webhook de assinatura do ZapSign |
| `run_verification` | — | Executa verificação em lote (usado pelo workflow) |
| `dashboard` | — | Retorna estatísticas para o Dashboard |
| `get_settings` | — | Busca configurações |
| `save_settings` | — | Salva configurações |
| `by_customer` | — | Busca acordos de um cliente específico |
| `get_installments` | — | Lista parcelas de um acordo |

### Exemplo — verify

**Input:**
```json
{
  "action": "verify",
  "phone": "11999990000",
  "cpfCnpj": "123.456.789-00",
  "customerId": "abc123",
  "conversationId": "conv_xyz"
}
```

**Output (sucesso):**
```json
{
  "success": true,
  "data": {
    "agreementStatus": "overdue",
    "hasAgreement": true,
    "agreement": { "id": "...", "negotiated_amount": 350.00, "overdue_installments": 2 },
    "customer": { "name": "João Silva", "city": "São Paulo" },
    "invoices": {
      "paid": [...],
      "open": [...],
      "overdue": [{ "id": "123", "value": 175.00, "due_date": "2026-06-01" }]
    }
  }
}
```

**Output (erro — IXC não configurado):**
```json
{
  "success": false,
  "error": {
    "code": "IXC_NOT_CONFIGURED",
    "message": "IXC_API_URL e IXC_API_TOKEN são obrigatórios. Configure as variáveis de ambiente no painel do Base44."
  }
}
```

### Exemplo — dashboard

**Output:**
```json
{
  "success": true,
  "data": {
    "active": 12,
    "overdue": 5,
    "broken": 2,
    "paid": 34,
    "pending_signature": 3,
    "total_negotiated": 45800.00,
    "total_overdue_amount": 6200.00,
    "total_recovered": 28400.00,
    "next_due_7_days": 4
  }
}
```

---

## 6. Status e Máquina de Estados

```
                    ┌──────────────────────────────────────┐
                    │                                      │
         none ──→ pending_signature ──→ active ──→ overdue ──→ broken
                    │                    │
                    │ (não exige ZapSign) │
                    └────────────────────┘
                                         └──→ paid
```

| Status | Condição | Cor |
|---|---|---|
| `none` | Nenhum acordo encontrado | Cinza |
| `pending_signature` | Acordo gerado, aguarda assinatura ZapSign | Roxo |
| `active` | Acordo ativo, parcelas em dia (atraso ≤ `tolerance_days_overdue`) | Verde |
| `overdue` | Atraso entre `tolerance_days_overdue` e `days_to_mark_broken` dias | Âmbar |
| `broken` | Atraso superior a `days_to_mark_broken` dias | Vermelho |
| `paid` | Todas as parcelas pagas | Azul |

### Regras de transição (automáticas via `run_verification`)

- `active → overdue`: pelo menos 1 parcela vencida há mais de `tolerance_days_overdue` dias
- `overdue → broken`: alguma parcela vencida há mais de `days_to_mark_broken` dias
- `broken → active`: não automático — requer novo acordo ou intervenção manual
- `* → paid`: quando `remaining_amount ≤ 0`

---

## 7. Integração IXCSoft

### Endpoints utilizados

| Endpoint | Método | Finalidade |
|---|---|---|
| `/cliente` | `GET` | Buscar cliente por CPF/CNPJ ou ID |
| `/fn_areceber` | `GET` | Listar faturas (contas a receber) |
| `/cliente_contrato` | `GET` | Listar contratos do cliente |
| `/atendimento` | `GET` | Verificar ordens de serviço |

### Headers obrigatórios

```
Authorization: Basic <IXC_API_TOKEN>
ixcsoft: listar
Content-Type: application/json
```

### Busca de cliente (múltiplas chaves)

O sistema tenta localizar o cliente na seguinte ordem de prioridade:

1. `cpfCnpj` → filtro `cnpj_cpf` na entidade `cliente`
2. `phone` → busca pelos últimos 8 dígitos em `telefone_celular` e `fone`
3. `customerId` → busca direta por ID
4. `contractId` → via `cliente_contrato` → `id_cliente`

Se nenhuma chave retornar resultado: erro `IXC_CUSTOMER_NOT_FOUND`.

### Classificação de faturas

```typescript
const today = new Date();
for (const invoice of invoices) {
  const daysLate = Math.floor((today - new Date(invoice.data_vencimento)) / 86400000);
  if (invoice.status === 'P') paid.push(invoice);
  else if (daysLate > 0) overdue.push({ ...invoice, daysLate });
  else open.push(invoice);
}
```

---

## 8. Integração ZapSign

### Pré-requisito

`ZAPSIGN_API_TOKEN` configurado nas variáveis de ambiente. Se ausente e `require_zapsign = true`, a função retorna erro `ZAPSIGN_NOT_CONFIGURED`.

### Fluxo de assinatura

1. Atendente clica **"Gerar Acordo ZapSign"** no painel
2. Backend chama `POST https://api.zapsign.com.br/api/v1/docs/` com template e dados do cliente
3. ZapSign retorna `token` do documento e URL de assinatura
4. Sistema atualiza `Agreement.zapsign_document_id`, `zapsign_url`, `status = pending_signature`
5. Link é enviado ao cliente via WhatsApp
6. Cliente assina → ZapSign dispara webhook para `/api/agreements/zapsign-webhook`
7. Webhook valida `token`, atualiza `zapsign_status = signed`, `status = active`

### Webhook

Endpoint: função `agreementApi` com `action = zapsign_webhook`

```json
{
  "action": "zapsign_webhook",
  "document_token": "abc...",
  "event": "doc_signed"
}
```

---

## 9. Integração WhatsApp (Evolution Go)

### Servidor configurado

- URL: `https://evolution-go-9b1u.srv1772067.hstgr.cloud`
- Global API Key: configurada em `EVOLUTION_API_KEY`
- Instância padrão: `CONNECT`

### Formato de envio (Evolution Go)

O Evolution Go autentica o envio com o token **da instância**, não com a Global API Key diretamente.

```typescript
// Passo 1: descobrir token da instância
const allRes = await fetch(`${base}/instance/all`, {
  headers: { apikey: globalApiKey }
});
const instance = list.find(i => i.name === instanceName);
const instanceToken = instance?.token ?? globalApiKey;

// Passo 2: enviar mensagem
await fetch(`${base}/send/text`, {
  method: 'POST',
  headers: { apikey: instanceToken, 'Content-Type': 'application/json' },
  body: JSON.stringify({ number: phone, text: message })
});
```

### Templates de mensagem

Variáveis disponíveis nos templates configurados em `/agreements/settings`:

| Variável | Substituído por |
|---|---|
| `{nome}` | Nome do cliente |
| `{valor}` | Próximo valor de parcela (BRL) |
| `{vencimento}` | Data da próxima parcela (dd/mm/aaaa) |
| `{saldo}` | Saldo restante (BRL) |
| `{link}` | Link ZapSign (quando aplicável) |

---

## 10. Rotas e Páginas Frontend

| Rota | Página | Descrição |
|---|---|---|
| `/agreements` | `Agreements.jsx` | Lista de acordos + cards de resumo + filtros |
| `/agreements/new` | `AgreementDetail.jsx` | Formulário de novo acordo |
| `/agreements/:id` | `AgreementDetail.jsx` | Detalhe, parcelas, histórico e ações |
| `/agreements/settings` | `AgreementSettings.jsx` | Configurações, templates, rodar verificação |

### Acesso via Sidebar

Menu **IXCSoft → Verificação de Acordo** (ícone Shield).

---

## 11. Componente AgreementCheckPanel

Painel reutilizável em `src/components/agreements/AgreementCheckPanel.jsx`.

### Props

| Prop | Tipo | Descrição |
|---|---|---|
| `conversation` | object | Objeto com `id`, `phone`, `customer_id`, `cpf_cnpj` |
| `instance` | string | Nome da instância WhatsApp (opcional) |

### Uso no Inbox

```jsx
// Na aba "Acordo" do painel direito
<AgreementCheckPanel
  conversation={selected}   // conversa selecionada
  instance={selectedInstance}
/>
```

### Uso no CustomerProfile

```jsx
<AgreementCheckPanel
  conversation={{
    id: customer?.id,
    phone: customer?.phone,
    customer_id: customer?.id,
    cpf_cnpj: customer?.cpf_cnpj,
    customer_name: customer?.name
  }}
  instance={null}
/>
```

### Estados do componente

- **Carregando** — spinner com texto "Verificando acordo..."
- **Erro crítico** — banner vermelho com código e instrução de correção
- **Aviso não-crítico** — banner âmbar (ex: acordo local sem dados IXC)
- **Resultado** — banner colorido por status + dados financeiros + botões de ação

---

## 12. Dashboard

O componente `AgreementPanel` (em `src/pages/Dashboard.jsx`) exibe:

- 4 cards de status: Ativos, Vencidos, Quebrados, Quitados
- 4 cards financeiros: Total Negociado, Em Atraso, Valor Recuperado, Vencimentos em 7 dias
- Alerta de atenção se houver acordos vencidos ou quebrados

Dados obtidos via `agreementApi({ action: "dashboard" })` com chamada assíncrona no `useEffect`.

---

## 13. Workflow Automático

Arquivo: `base44/workflows/AgreementVerification.jsonc`

### Agendamento

Executa todos os dias às **08:00 (Horário de Brasília)** via cron `0 8 * * *`.

### O que faz

1. Carrega configurações (`AgreementSettings`)
2. Lista todos os acordos com status `active`, `overdue` ou `pending_signature`
3. Chama `agreementApi({ action: "run_verification" })` para re-sincronizar com IXC e reclassificar status
4. Envia lembretes proativos para acordos que vencem em até 3 dias
5. Registra resultado em `AgreementVerificationLog`

### Execução manual

O botão **"Rodar Verificação"** na página `/agreements/settings` aciona o mesmo fluxo via:

```javascript
agreementApi({ action: "run_verification" })
```

---

## 14. Auditoria e Logs

Todas as operações relevantes são registradas em `AgreementVerificationLog`:

- Verificações manuais (origem: Inbox ou CustomerProfile)
- Verificações em lote (origem: workflow agendado)
- Erros de integração (IXC, ZapSign, WhatsApp)

Além disso, erros de runtime são registrados em `ErrorLog` (entidade padrão do Base44) com `function_name = "agreementApi"`.

---

## 15. Como Testar

### Pré-requisitos

- IXCSoft configurado com `IXC_API_URL` e `IXC_API_TOKEN` válidos
- Pelo menos uma instância WhatsApp conectada no Evolution Go

### 1. Verificação manual via Inbox

1. Abra uma conversa com um cliente que existe no IXCSoft
2. Clique na aba **"Acordo"** no painel direito
3. O painel deve exibir o status e os dados financeiros em segundos
4. Clique **"Enviar Lembrete"** e verifique a entrega no WhatsApp do cliente

### 2. Verificação manual via CustomerProfile

1. Acesse `/customers/:id`
2. Clique na aba **"Verificação de Acordo"**
3. Mesma lógica do Inbox

### 3. Testar erro IXC_NOT_CONFIGURED

1. Remova temporariamente `IXC_API_URL` das variáveis de ambiente
2. Abra qualquer painel de verificação
3. Deve exibir banner vermelho "IXCSoft não configurado" com instrução

### 4. Testar envio de lembrete WhatsApp

```bash
# Via Base44 Functions Console ou curl
POST /functions/agreementApi
{
  "action": "send_reminder",
  "agreementId": "<id_do_acordo>",
  "instance": "CONNECT"
}
```

### 5. Testar workflow em lote

1. Acesse `/agreements/settings`
2. Clique **"Rodar Verificação"**
3. Após conclusão, acesse `AgreementVerificationLog` nas entidades para ver o registro

### 6. Testar ZapSign

1. Configure `ZAPSIGN_API_TOKEN` válido
2. Abra um acordo em `/agreements/:id`
3. Clique **"Gerar ZapSign"**
4. Verifique criação do documento e envio do link WhatsApp

---

## 16. Troubleshooting

### Erro: IXC_NOT_CONFIGURED

**Causa:** Variáveis `IXC_API_URL` ou `IXC_API_TOKEN` ausentes.
**Solução:** Configurar em Base44 → Variáveis de Ambiente (backend).

### Erro: IXC_CUSTOMER_NOT_FOUND

**Causa:** Nenhum registro no IXCSoft corresponde ao CPF/CNPJ, telefone ou ID fornecido.
**Solução:** Verificar se o cadastro do cliente está correto no IXCSoft. Conferir se o telefone está no formato esperado (apenas dígitos, com DDD).

### Erro: IXC_INVOICES_ERROR

**Causa:** Falha na chamada `fn_areceber` — pode ser timeout, credencial inválida ou indisponibilidade do IXCSoft.
**Solução:** Verificar status do IXCSoft e validade do token. Consultar `ErrorLog` para detalhes.

### Erro: ZAPSIGN_NOT_CONFIGURED

**Causa:** `require_zapsign = true` mas `ZAPSIGN_API_TOKEN` não está configurado.
**Solução:** Configurar token ou desabilitar `require_zapsign` em `/agreements/settings`.

### Lembrete WhatsApp não chega

**Possíveis causas:**
- Instância WhatsApp desconectada → reconectar via QR code em Integrações
- Telefone do cliente sem DDD ou com formato inválido
- Instância com nome diferente de `CONNECT` → verificar `EVOLUTION_INSTANCE_NAME`

### Painel de acordo carrega mas não mostra dados financeiros

**Causa provável:** Acordo existe na base local mas cliente não está no IXCSoft (aviso `ixc_warning`).
**Solução:** Verificar se o cliente foi cadastrado no IXCSoft e se os dados (CPF/telefone) coincidem.

### Status não atualiza após pagamento no IXCSoft

**Causa:** A verificação é feita sob demanda ou pelo workflow diário.
**Solução:** Clicar em "Atualizar Verificação" no painel, ou aguardar execução diária às 08:00.
