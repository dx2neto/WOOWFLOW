# WOOWFLOW

Plataforma omnichannel para provedores de internet (ISP): CRM, caixa de entrada
WhatsApp (Evolution Go), cobrança e financeiro (IXCSoft), assinatura eletrônica
(ZapSign), telefonia (PABX), campanhas, chatbot/IA e módulo de acordos.

Construído sobre [Base44](https://base44.com) (frontend React + Vite; backend em
funções Deno; entidades gerenciadas pelo Base44).

## Requisitos

- Node.js 18+
- Base44 CLI (`npm i -g @base44/cli`) para rodar o backend local e publicar

## Configuração

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie o arquivo de ambiente e preencha os valores reais:

   ```bash
   cp .env.example .env.local
   ```

   Nunca commite `.env.local`. Variáveis expostas ao navegador devem usar o
   prefixo `VITE_`; segredos de backend (chaves de API, tokens) **não** devem
   ter esse prefixo. Veja `.env.example` para a lista completa e comentada.

## Desenvolvimento

- Backend + frontend juntos (backend Base44 local):

  ```bash
  base44 dev
  ```

- Apenas frontend, contra o backend Base44 hospedado:

  ```bash
  npm run dev
  ```

## Verificações (rode antes de finalizar mudanças)

```bash
npm run lint
npm run typecheck
npm run build
```

## Segredos de backend (configurar no painel Base44)

As funções de backend leem segredos via `Deno.env`. Configure no dashboard do
Base44 (ou via `base44 secrets set`):

- `BASE44_API_KEY` (proxy local)
- `IXC_API_URL`, `IXC_API_TOKEN`
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`
- `EVOLUTION_GO_WEBHOOK_SECRET` (obrigatório — o webhook rejeita chamadas sem segredo)
- `INTERNAL_FUNCTION_TOKEN` (autentica chamadas função→função e jobs agendados)
- `ZAPSIGN_API_TOKEN`, `SERASA_API_URL`, `SERASA_CHAVE_ACESSO`
- `META_*`, `PABX_*` conforme integrações usadas

## Segurança (resumo)

- Entidades usam RLS (Row-Level Security): dados operacionais exigem usuário
  autenticado; logs, configurações e permissões são restritos a `admin`; campos
  secretos (`api_key`, `sip_password`, `zapsign_doc_token`) têm acesso admin-only.
- Rotas sensíveis no frontend têm gate de autorização (`RequirePermission`).
- Após qualquer mudança em RLS, valide o acesso por papel no ambiente publicado.

## Publicação

```bash
base44 deploy
```

Consulte `AGENTS.md` e `AUDITORIA_WOOWFLOW.md` para detalhes de arquitetura e o
histórico de correções.
