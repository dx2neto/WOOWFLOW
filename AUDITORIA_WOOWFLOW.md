# Auditoria Técnica — WOOWFLOW

**Data:** 09/07/2026
**Escopo:** Auditoria completa de ponta a ponta (frontend, backend, integrações, entidades/segurança, build e higiene do repositório).
**Status:** Diagnóstico concluído. **Nenhuma alteração de código foi aplicada ainda** — conforme combinado, este relatório vem primeiro; as correções serão aplicadas por ordem de gravidade após sua aprovação.

---

## 1. Diagnóstico geral do sistema

O WOOWFLOW é uma plataforma omnichannel robusta para provedores de internet (ISP): CRM, caixa de entrada WhatsApp (Evolution Go), cobrança/financeiro (IXCSoft), assinatura eletrônica (ZapSign), telefonia (PABX), campanhas, chatbot/IA e acordos. São **186 arquivos de frontend (React/Vite), 22 funções de backend (Deno) e 39 entidades**.

**Pontos fortes**
- O projeto **compila e builda com sucesso** (3.014 módulos transformados sem erro).
- Arquitetura de autenticação sólida: redirecionamento via `window.location` (não depende de hooks de router), `AuthProvider` bem isolado.
- Padrão consistente de logging: `IntegrationLog`, `ErrorLog`, `ReminderLog` — boa base de observabilidade.
- Boa organização de UI (shadcn/ui) e separação por domínio (telephony, agreements, crm, etc.).

**Fragilidades estruturais (visão macro)**
- **Segurança de dados é o maior risco:** nenhuma entidade tem RLS (Row-Level Security), e o frontend não tem autorização por papel/rota. Qualquer usuário autenticado alcança PII, dados financeiros, logs de auditoria e até segredos de integração.
- **A automação de cobrança (lembretes agendados) está quebrada** por um modelo de autenticação incompatível com execução via cron.
- **A página Inbox tem um bug de runtime que a derruba** (temporal dead zone).
- Várias "integrações" são **stubs** que só reportam status, sem executar a ação real.
- Repositório com **muito lixo/duplicação** que atrapalha manutenção e deploy.

**Veredito:** o sistema tem uma base boa, mas **não está pronto para produção** enquanto os itens Críticos e de Segurança abaixo não forem resolvidos.

---

## 2. Problemas encontrados

> Legenda de gravidade: 🔴 Crítica · 🟠 Alta · 🟡 Média · ⚪ Baixa

### 🔴 CRÍTICO

#### C1. Inbox quebra ao renderizar (ReferenceError / temporal dead zone)
- **Arquivo:** `src/pages/Inbox.jsx`
- **Causa:** `const selected = conversations.find(...)` é declarado na **linha 710**, mas é referenciado nos *dependency arrays* de `useCallback` nas **linhas 577, 587 e 600** (`handleSendFile`, `handleWhatsAppCall`, `handleSyncHistoryOnly`). Como `const` não sofre hoisting, no momento da renderização o acesso a `selected` cai na *temporal dead zone* → `ReferenceError: Cannot access 'selected' before initialization`.
- **Impacto:** A página **/inbox** (função central do produto) trava ao montar. Confirmado também pelo `tsc` (TS2448).
- **Gravidade:** 🔴 Crítica.
- **Correção recomendada:** Mover a linha `const selected = conversations.find((c) => c.id === selectedId);` para **antes** do primeiro `useCallback` que a usa (logo após a declaração de `selectedId`, ~linha 210). Causa raiz, sem gambiarra.
- **Como testar:** Abrir `/inbox`; a lista e a conversa selecionada devem carregar sem erro no console. Rodar `npm run typecheck` — os 3 erros TS2448 devem sumir.

#### C2. Pipeline de lembretes agendados nunca executa (auth incompatível com cron)
- **Arquivos:** `base44/functions/sendPaymentReminders/entry.ts`, `sendNegotiationOffers`, `sendBillingRuleReminders`, `sendContractRenewalReminders` (+ workflows `base44/workflows/*.jsonc`).
- **Causa:** As funções começam com `const user = await base44.auth.me(); if (!user) return 401`. Porém elas são disparadas por **workflow agendado** (`PaymentReminderWhatsApp.jsonc`, cron `0 9 * * *`) via `invoke_backend_function` com `args: {}` — **sem sessão de usuário**. Além disso, encaminham `Authorization: req.headers.get('Authorization') || ''` (vazio) para `ixcApi`/`evolutionApi`, que também exigem `auth.me()`.
- **Impacto:** Lembretes de pagamento, ofertas de negociação, regras de cobrança e renovação de contrato **nunca são enviados** quando disparados pelo agendador → retornam 401. Funcionalidade de cobrança automática inoperante.
- **Gravidade:** 🔴 Crítica.
- **Correção recomendada:** Para execução por sistema, usar identidade de serviço em vez de sessão interativa: (a) permitir invocação via service role e (b) chamadas internas função→função autenticadas por token de serviço/segredo compartilhado, não pelo header do usuário final. Manter `asServiceRole` para as escritas (já usado) e ajustar `ixcApi`/`evolutionApi` para aceitar chamada de serviço.
- **Como testar:** Disparar o workflow manualmente (ou aguardar o cron) e confirmar `ReminderLog`/`IntegrationLog` com `status: enviado/sucesso`; verificar recebimento real no WhatsApp de teste.

### 🟠 ALTA (Segurança)

#### S1. Nenhuma entidade define RLS — exposição ampla de PII e dados financeiros
- **Arquivos:** `base44/entities/*.jsonc` (as 37 entidades — nenhuma tem bloco `rls`).
- **Causa:** Entidades como `Customer` (CPF/CNPJ, telefone, e-mail, `balance_due`, `financial_status`), `Charge`, `Agreement`, `AgreementInstallment`, `Conversation`, `Message`, `AuditLog` e `User` não têm regra de acesso por linha. Sem RLS explícito, o acesso segue o padrão da plataforma, permitindo que **qualquer usuário autenticado leia/escreva registros de todos**.
- **Impacto:** Vazamento de dados pessoais e financeiros; risco de **LGPD**; sem isolamento multi-tenant; possibilidade de adulteração de auditoria e de contas de usuário.
- **Gravidade:** 🟠 Alta (tende a 🔴 pelo tipo de dado).
- **Correção recomendada:** Adicionar bloco `"rls"` a cada entidade seguindo os padrões do Base44 (ver `.agents/skills/base44-cli/references/rls-examples.md`). Ex.: leitura restrita a papéis/atendentes autorizados; `AuditLog`/`User` somente admin; PII e financeiro com menor privilégio. Aplicar princípio do menor privilégio por entidade.
- **Como testar:** Autenticar como usuário comum e tentar `entities.Customer.list()`/`User.list()` — deve retornar apenas o permitido. Testar leitura/escrita cruzada entre usuários.

#### S2. Segredos armazenados em entidades sem RLS
- **Arquivos:** `base44/entities/IntegrationConfig.jsonc` (campo `api_key`), `SipTrunk.jsonc` (`sip_password`), `SignatureRequest.jsonc` (`zapsign_doc_token`).
- **Causa:** Credenciais de integração ficam em entidades que, sem RLS, são legíveis via API de entidades por qualquer usuário autenticado.
- **Impacto:** Exposição de chaves de API, senha SIP e tokens de assinatura — permite abuso das integrações e da telefonia.
- **Gravidade:** 🟠 Alta.
- **Correção recomendada:** Mover segredos para variáveis de ambiente do backend (`Deno.env`) sempre que possível; para o que precisar ficar em entidade, aplicar RLS admin-only e considerar mascaramento/somente-escrita no frontend.
- **Como testar:** Como usuário comum, tentar ler `IntegrationConfig`/`SipTrunk` — os campos sensíveis não devem retornar.

#### S3. Webhook do Evolution é "fail-open"
- **Arquivo:** `base44/functions/evolutionWebhook/entry.ts` (linhas ~78-82).
- **Causa:** `if (apiKey && providedKey !== apiKey) return 401` — a verificação só ocorre **se** alguma env de segredo estiver definida. Se `EVOLUTION_GO_WEBHOOK_SECRET`/`EVOLUTION_GO_ADMIN_TOKEN`/`EVOLUTION_API_KEY`/`GLOBAL_API_KEY` não estiverem setadas, `apiKey` é `''` e a autenticação é **ignorada**.
- **Impacto:** Qualquer um pode chamar o webhook e **injetar mensagens/conversas falsas** no sistema (spoofing, poluição de dados, phishing interno).
- **Gravidade:** 🟠 Alta.
- **Correção recomendada:** Falhar de forma segura (*fail-closed*): se nenhum segredo estiver configurado, rejeitar com 500/401 em vez de aceitar. Exigir segredo obrigatório e, idealmente, validar via header em vez de query string (a query aparece em logs de acesso).
- **Como testar:** Chamar o webhook sem `?key=` correto → deve retornar 401 mesmo sem env configurada.

#### S4. Sem autorização por rota/papel no frontend
- **Arquivos:** `src/components/ProtectedRoute.jsx`, `src/App.jsx`, `src/components/Layout.jsx`.
- **Causa:** `ProtectedRoute` valida apenas *autenticação*. Não há checagem de papel/permissão, apesar de existir `permissionsConfig.js` e entidade `Profile`. Páginas sensíveis (`/users`, `/audit-logs`, `/system-logs`, `/settings`, `/integrations`, `/financial`) ficam acessíveis a **qualquer usuário logado** via URL direta.
- **Impacto:** Escalonamento de privilégio na interface; usuário comum acessa gestão de usuários, auditoria e configurações.
- **Gravidade:** 🟠 Alta (a barreira real deve ser o RLS — item S1 — mas isto é defesa em profundidade essencial).
- **Correção recomendada:** Criar um wrapper de autorização (ex.: `<RequirePermission module="settings" action="view">`) usando `Profile`/`permissionsConfig`, aplicado às rotas sensíveis, e ocultar itens de menu no `Sidebar` conforme permissão.
- **Como testar:** Logar como usuário sem permissão e acessar `/users` diretamente → deve bloquear/redirecionar.

#### S5. Endpoint e instância de produção hardcoded no código
- **Arquivo:** `base44/functions/agreementApi/entry.ts` (linhas 11-13).
- **Causa:** Fallbacks embutidos: `EVOLUTION_API_URL || 'https://evolution-go-9b1u.srv1772067.hstgr.cloud'` e `EVOLUTION_INSTANCE_NAME || 'CONNECT'`.
- **Impacto:** Vazamento de infraestrutura interna no código-fonte e risco de *config drift* (o código usa um servidor fixo se a env faltar).
- **Gravidade:** 🟡 Média.
- **Correção recomendada:** Remover o fallback hardcoded; exigir a env e falhar com erro claro se ausente. Nunca fixar URLs/instâncias de produção no código.
- **Nota:** `.env.local` contém chaves reais (`BASE44_API_KEY`, `EVOLUTION_API_KEY`), porém **não está versionado** (o `.gitignore` cobre `.env.*`) — correto. Ainda assim, recomenda-se **rotacionar** essas chaves, já que estiveram em texto plano no ambiente de trabalho.

### 🟡 MÉDIA (Integrações e Qualidade)

#### M1. Funções de integração são apenas stubs
- **Arquivos:** `crmApi`, `signatureApi`, `telephonyApi`, `metaApi`, `tiktokApi`, `emailApi`, `billingApi` (`base44/functions/*/entry.ts`).
- **Causa:** Essas funções apenas checam variáveis de ambiente e retornam `{status: connected|pending, supports: [...]}` — **não executam** a ação real (ex.: `signatureApi` anuncia `send_contract` mas nada faz; a assinatura real está em `zapsignApi`).
- **Impacto:** A UI pode indicar "conectado" para integrações que não fazem nada; confusão e falsa sensação de funcionalidade. Redundância com as funções reais (`zapsignApi`, `evolutionApi`, `ixcApi`).
- **Gravidade:** 🟡 Média.
- **Correção recomendada:** Ou implementar a integração real, ou renomear/rotular claramente como "teste de conexão" e ajustar a UI para não prometer ações inexistentes. Remover duplicidade com as funções completas.
- **Como testar:** Chamar cada função com uma `action` real e confirmar efeito no serviço externo.

#### M2. Leitura de tabela inteira e envio sequencial nos lembretes
- **Arquivo:** `base44/functions/sendPaymentReminders/entry.ts` (e similares).
- **Causa:** `ReminderLog.filter({})` carrega **todos** os registros a cada execução para montar o `Set` de já-enviados; envios feitos em loop sequencial com `await`.
- **Impacto:** Degradação de performance conforme a base cresce; janela de execução longa; possível timeout.
- **Gravidade:** 🟡 Média.
- **Correção recomendada:** Filtrar por período/`invoice_id` relevante (não `{}`); paginar; considerar envios em lote controlado.

#### M3. `.gitignore` com regra `*.json` no final
- **Arquivo:** `.gitignore` (última linha `*.json`).
- **Causa:** A regra `*.json` pode deixar de rastrear arquivos de configuração importantes (`package.json`, `components.json`, `package-lock.json`), dependendo de já estarem versionados.
- **Impacto:** Risco de arquivos essenciais não entrarem no versionamento/CI → build quebrado em clones limpos.
- **Gravidade:** 🟡 Média.
- **Correção recomendada:** Remover `*.json` genérico e ignorar apenas o que for realmente local (ex.: `o.json` e artefatos), mantendo os `.json` de config versionados. As entidades usam `.jsonc` (não afetadas), mas a regra ainda é perigosa.

### ⚪ BAIXA (Higiene, build e UX)

#### B1. `README.md` da raiz tem conteúdo errado
- **Arquivo:** `README.md` (e `README 2.md`). Ambos contêm o README do pacote **tinyglobby**, não do WOOWFLOW.
- **Impacto:** Documentação de setup inexistente/enganosa (o `AGENTS.md` referencia o README para setup).
- **Correção recomendada:** Reescrever o `README.md` com setup real (variáveis, `base44 dev`, build) e remover `README 2.md`.

#### B2. Lixo e duplicação no repositório
- **Itens:** `WOOWFLOW/` (cópia aninhada do projeto, ~5,8 MB, com `dist` e locks próprios), `package 2`…`package 6/`, `o.json` (cópia de `package-lock.json`, ~360 KB), `package 2.json`, `fdir-6.5.0.tgz`, `tinyglobby-0.2.17.tgz`, `.index.html.swp`, `.DS_Store`.
- **Impacto:** Confusão de manutenção, risco de editar o arquivo errado, repositório inchado, ambiguidade de build.
- **Correção recomendada:** Remover todos esses artefatos após confirmar que a fonte de verdade é a raiz. Adicionar `.DS_Store`, `*.swp`, `*.tgz` ao `.gitignore` (já cobre `.swp` e `.DS_Store`).

#### B3. Build sem code-splitting (bundle único de 1,7 MB)
- **Causa:** Um único chunk JS de ~1.717 KB (gzip ~459 KB); Vite alerta chunks > 500 KB.
- **Impacto:** Carregamento inicial mais lento.
- **Correção recomendada:** `React.lazy`/`import()` por rota e `manualChunks` para libs pesadas (recharts, three, framer-motion, leaflet).

#### B4. Erros de `typecheck` e warnings de lint
- **Causa:** `tsc` acusa aritmética com `Date` (`Dashboard.jsx`, `Reports.jsx`, `Financial.jsx`, `CustomerConversationsHistory.jsx`) e o TDZ do Inbox (C1). `eslint` acusa 6 variáveis não usadas.
- **Impacto:** Ruído; mascara erros reais; risco de bugs sutis de data.
- **Correção recomendada:** Usar `.getTime()` nas subtrações de data; remover variáveis não usadas; manter `typecheck` limpo no CI.

#### B5. Detalhes de UI e config
- `base44/config.jsonc` → `"name": "Untitled"` (definir "WOOWFLOW").
- `Layout.jsx`: sino de notificações é decorativo (ponto estático); toggle de tema é `useState` local (não persiste) e aplica a classe `dark` em um `div` interno em vez de `<html>` — o dark mode pode não se propagar a portais/modais.
- **Gravidade:** ⚪ Baixa.

---

## 3. Correções feitas

**Nenhuma até o momento.** Conforme sua escolha ("relatório primeiro, depois corrigir"), este documento é o diagnóstico. Assim que você aprovar, aplico as correções **em ordem de gravidade**, uma frente por vez, sem quebrar funcionalidades existentes e sempre atacando a causa raiz.

Ordem sugerida de aplicação:
1. C1 (Inbox — correção pequena e isolada, ganho imediato).
2. S3 (webhook fail-closed) e S5 (remover hardcoded) — baixo risco.
3. C2 (auth do pipeline de lembretes) — requer teste do workflow.
4. S1 + S2 (RLS nas entidades) — mudança ampla, aplicar por lotes e testar por papel.
5. S4 (autorização por rota).
6. M1–M3, depois B1–B5.

---

## 4. Melhorias recomendadas

- **Segurança em camadas:** RLS por entidade (barreira real) + autorização por rota/menu (defesa em profundidade) + segredos só no backend.
- **Identidade de serviço** para jobs/cron e chamadas função→função (padrão `asServiceRole`/token de serviço), separando de sessões de usuário.
- **Rotacionar** as chaves que estiveram em `.env.local` (Base44 e Evolution).
- **CI mínimo:** `npm run lint && npm run typecheck && npm run build` bloqueando merge.
- **Testes:** cobertura para o webhook (auth/normalização de eventos), para o pipeline de lembretes (filtro de faturas, dedupe) e para permissões (acesso por papel).
- **Performance:** code-splitting por rota; paginação/filtro nos logs; índices/consultas específicas em vez de `filter({})`.
- **Documentação:** `README.md` real; documentar variáveis de ambiente (já bem descritas em `.env.example`) e o fluxo de deploy Base44.
- **Higiene:** limpar duplicações; padronizar em `.jsonc` para config Base44.

---

## 5. Checklist de testes (pós-correção)

- [ ] `/inbox` carrega e opera (selecionar conversa, enviar texto/arquivo/áudio, finalizar) sem erro no console.
- [ ] `npm run typecheck` sem erros; `npm run lint` sem warnings; `npm run build` verde.
- [ ] Workflow de lembretes dispara e envia de fato (verificar `ReminderLog.status = enviado` e recebimento real).
- [ ] Webhook rejeita chamada sem `key` válido (401) mesmo sem env de segredo (fail-closed).
- [ ] Usuário comum **não** acessa `/users`, `/audit-logs`, `/settings`, `/financial` por URL.
- [ ] Usuário comum **não** lê `Customer`/`User`/`IntegrationConfig`/`SipTrunk` de terceiros via API de entidades.
- [ ] Segredos (api_key, sip_password, zapsign_doc_token) não retornam para usuário sem permissão.
- [ ] Integrações reais (Evolution, IXC, ZapSign) executam ações de ponta a ponta em ambiente de teste.
- [ ] Nenhum endpoint/instância de produção hardcoded permanece no código.

---

## 6. Próximos passos para produção

1. Aprovar este relatório e a ordem de correção.
2. Aplicar C1 → S3/S5 → C2 → S1/S2 → S4 (com testes a cada etapa).
3. Resolver M1–M3 (integrações reais/rotuladas, performance, `.gitignore`).
4. Limpar higiene do repositório (B1–B5) e escrever o `README.md`.
5. Rotacionar segredos e configurar CI.
6. Rodar o checklist de testes completo em ambiente de homologação antes do publish (`base44 deploy`/`site deploy`).

---

*Observação: este relatório aborda temas de conformidade (LGPD) e segurança de forma técnica. Não constitui aconselhamento jurídico — recomenda-se validação com o responsável de privacidade/DPO antes de tratar dados pessoais em produção.*
