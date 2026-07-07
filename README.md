<div align="center">

<img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
<img src="https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
<img src="https://img.shields.io/badge/Base44-SDK-FF6B35?style=for-the-badge" />
<img src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
<img src="https://img.shields.io/badge/IXCSoft-Integrado-0066CC?style=for-the-badge" />

<br /><br />

# 🌐 WOOWFLOW

**Plataforma de atendimento omnichannel e gestão para provedores de internet**

Integração nativa com IXCSoft · WhatsApp via Evolution API · IA com Lara · CRM · NOC · Financeiro · OS

</div>

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Stack Tecnológica](#-stack-tecnológica)
- [Arquitetura](#-arquitetura)
- [Módulos IXCSoft](#-módulos-ixcsoft)
- [Pré-requisitos](#-pré-requisitos)
- [Variáveis de Ambiente](#-variáveis-de-ambiente)
- [Como Rodar Localmente](#-como-rodar-localmente)
- [Build para Produção](#-build-para-produção)
- [Páginas e Rotas](#-páginas-e-rotas)
- [Segurança](#-segurança)
- [Pendências e Roadmap](#-pendências-e-roadmap)

---

## 🎯 Visão Geral

O **WOOWFLOW** é uma plataforma SaaS completa para provedores de internet, desenvolvida para centralizar o atendimento ao cliente, a gestão operacional e a integração com o ERP **IXCSoft**.

A plataforma permite que equipes de suporte, financeiro, NOC e comercial operem em um único ambiente, com dados em tempo real vindos diretamente do IXCSoft.

```
Cliente → WhatsApp / Instagram / Telegram / WebChat
                    ↓
              WOOWFLOW (este repositório)
                    ↓
    IXCSoft ERP · Evolution API · ZapSign · Serasa
```

---

## ✨ Funcionalidades

### Atendimento
- **Caixa de Entrada unificada** — WhatsApp, Instagram, Messenger, Telegram, WebChat e Telefonia em uma só tela
- **CRM com pipeline** — Leads, negociação, fechamento e automações
- **Chatbot / IA Lara** — Atendimento automático com IA 24/7, escalada para humano e logs completos
- **Campanhas** — Disparo em massa com templates WhatsApp e posts agendados no Instagram
- **Assinaturas eletrônicas** — Via ZapSign para contratos e documentos

### IXCSoft — Provedor de Internet
- **Clientes** — Listagem, busca, perfil completo e linha do tempo de interações
- **Contratos** — Visualização por status, plano, vendedor e cidade
- **Planos** — Catálogo de planos com velocidade, valor e tecnologia
- **Financeiro / Inadimplência** — Títulos vencidos com faixas de atraso, envio de PIX e boleto via WhatsApp
- **Cobranças** — Gestão de faturas em aberto com ação direta de envio
- **Ordens de Serviço** — Abertura, acompanhamento e atualização de OS diretamente no IXCSoft
- **NOC** — Monitoramento de clientes suspensos/offline, abertura de OS e envio de mensagem
- **Vendedores** — Cadastro e performance da equipe comercial
- **Dashboard em tempo real** — Clientes ativos, contratos, inadimplência, OS abertas e receita

### Ferramentas
- **Telefonia Omnichannel** — Ramais, troncos SIP, URA, filas e rotas
- **Templates de mensagem** — Biblioteca de mensagens aprovadas
- **Base de conhecimento** — Artigos para a equipe e para a IA
- **Relatórios** — Métricas de atendimento, NPS, SLA e conversão
- **Logs de auditoria** — Rastreamento completo de ações no sistema

---

## 🛠 Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite 6 |
| Estilização | Tailwind CSS 3 + shadcn/ui + Radix UI |
| Roteamento | React Router DOM v6 |
| Gráficos | Recharts |
| Backend / BaaS | Base44 (serverless Deno functions) |
| Banco de dados | Base44 entities (gerenciado) |
| WhatsApp | Evolution API |
| ERP | IXCSoft REST API |
| Assinaturas | ZapSign |
| Validação cadastral | Serasa / ValidaCadastro |
| Gerenciador de pacotes | npm |

---

## 🏗 Arquitetura

```
WOOWFLOW/
├── base44/
│   ├── functions/          # Backend serverless (Deno/TypeScript)
│   │   ├── ixcApi/         # 🔑 Integração central IXCSoft (entry.ts)
│   │   ├── evolutionApi/   # WhatsApp via Evolution API
│   │   ├── zapsignApi/     # Assinaturas eletrônicas
│   │   ├── serasaApi/      # Validação cadastral
│   │   └── ...             # Automações, webhooks, lembretes
│   ├── entities/           # Schemas de dados (Base44)
│   └── agents/             # Agente IA Lara
│
├── src/
│   ├── pages/              # Páginas da aplicação (React)
│   ├── components/         # Componentes reutilizáveis
│   │   ├── ui/             # Design system (shadcn/ui + customizações)
│   │   ├── dashboard/      # Painel financeiro
│   │   ├── telephony/      # Módulo de telefonia
│   │   └── ...
│   ├── functions/          # Wrappers das functions Base44
│   ├── lib/                # Utilitários e helpers
│   │   ├── ixcNormalize.js # 🔑 Normalização de dados IXCSoft
│   │   └── exportCsv.js    # Export de tabelas
│   └── api/
│       └── base44Client.js # Cliente Base44 SDK
│
├── .env.example            # Variáveis de ambiente documentadas
└── vite.config.js
```

### Como as chamadas ao IXCSoft funcionam

Este projeto usa **Base44** como backend. As credenciais do IXCSoft **nunca chegam ao browser** — toda comunicação passa pela function serverless `base44/functions/ixcApi/entry.ts`, executada em Deno no servidor.

```js
// Frontend chama assim:
import { ixcApi } from "@/functions/ixcApi";

const res = await ixcApi({ action: "clientes", search: "João" });
// ↓ base44.functions.invoke("ixcApi", { action, search })
// ↓ Executa no servidor Deno com IXC_API_URL e IXC_API_TOKEN
// ↓ Retorna dados normalizados — credenciais nunca expostas
```

---

## 🔌 Módulos IXCSoft

Todas as actions disponíveis na function `ixcApi`:

| Action | Descrição |
|---|---|
| `test_connection` | Testa conectividade e retorna tempo de resposta |
| `clientes` | Lista clientes com busca e paginação automática |
| `cliente_por_id` | Busca um único cliente por ID (query direta) |
| `contratos` | Lista contratos ativos e cancelados |
| `contrato_por_id` | Detalhes de um contrato específico |
| `planos` | Catálogo de planos de internet |
| `vendedores` | Equipe comercial cadastrada |
| `contatos` | Contatos adicionais por cliente |
| `cidades` | Mapa de cidades para resolução de nomes |
| `faturas` | Faturas em aberto (fn_areceber) |
| `faturas_cliente` | Histórico financeiro por cliente |
| `inadimplentes` | Títulos vencidos com faixas de atraso |
| `segunda_via` | Faturas em aberto de um cliente (boleto/PIX) |
| `titulos` | Títulos financeiros com paginação e filtros |
| `os` | Ordens de serviço com filtros e paginação |
| `os_por_id` | Detalhes de uma OS |
| `os_create` | Abre nova OS no IXCSoft |
| `os_update` | Atualiza OS existente |
| `atendimentos` | Histórico de atendimentos |
| `dashboard` | Métricas agregadas em tempo real |
| `noc_offline` | Contratos suspensos / clientes sem internet |
| `noc_sinal_ruim` | Clientes com sinal óptico ruim *(requer OLT)* |
| `noc_cliente` | Dados NOC por cliente |
| `noc_contrato` | Dados NOC por contrato |

---

## 📦 Pré-requisitos

- **Node.js** 18+ e **npm** 9+
- Conta e projeto criado no **[Base44](https://base44.com)**
- Credenciais da **API REST do IXCSoft** (URL + Token)
- Instância da **Evolution API** para WhatsApp (opcional)

---

## 🔐 Variáveis de Ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
cp .env.example .env.local
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `IXC_API_URL` | ✅ | URL base do IXCSoft, ex: `https://seuprovedor.ixcprovedor.com.br/webservice/v1` |
| `IXC_API_TOKEN` | ✅ | Token Base64 `usuario:token` — **nunca use prefixo `VITE_`** |
| `VITE_BASE44_APP_ID` | ✅ | ID do app no Base44 (gerado automaticamente) |
| `VITE_BASE44_APP_TOKEN` | ✅ | Token do app Base44 |
| `EVOLUTION_API_URL` | ⚡ | URL da Evolution API para WhatsApp |
| `EVOLUTION_API_KEY` | ⚡ | API Key da Evolution |
| `EVOLUTION_INSTANCE` | ⚡ | Nome da instância WhatsApp |
| `ZAPSIGN_API_TOKEN` | ⭕ | Token ZapSign (assinaturas eletrônicas) |
| `SERASA_API_TOKEN` | ⭕ | Token ValidaCadastro / Serasa |

> ✅ obrigatório · ⚡ necessário para WhatsApp · ⭕ opcional

### Como gerar o IXC_API_TOKEN

```bash
echo -n "seu_usuario_ixc:seu_token_api_ixc" | base64
```

Cole o resultado no `.env.local`:

```env
IXC_API_URL=https://seuprovedor.ixcprovedor.com.br/webservice/v1
IXC_API_TOKEN=c2V1X3VzdWFyaW9faXhjOnNldV90b2tlbl9hcGlfaXhj
```

---

## 🚀 Como Rodar Localmente

```bash
# 1. Clone o repositório
git clone https://github.com/dx2neto/WOOWFLOW.git
cd WOOWFLOW

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais reais

# 4. Inicie com frontend + backend juntos (recomendado)
npx base44 dev

# Ou apenas o frontend contra o backend hospedado:
npm run dev
```

Acesse **http://localhost:5173**

### Testar a conexão com o IXCSoft

Após iniciar, acesse **IXCSoft → Teste IXCSoft** no menu lateral:

```
http://localhost:5173/ixc-test
```

---

## 🏗 Build para Produção

```bash
# Verificar erros de lint
npm run lint

# Checar TypeScript (backend functions)
npm run typecheck

# Gerar build otimizado
npm run build

# Prévia local do build
npm run preview
```

O deploy é gerenciado pelo **Base44** — qualquer push na branch `main` reflete automaticamente na plataforma.

---

## 🗺 Páginas e Rotas

### Atendimento

| Rota | Descrição |
|---|---|
| `/dashboard` | Visão geral com dados de atendimento + painel IXCSoft em tempo real |
| `/inbox` | Caixa de entrada unificada (WhatsApp, Instagram, Telegram…) |
| `/crm` | Pipeline de CRM com leads e negociações |
| `/crm-automations` | Automações do CRM por gatilho |
| `/campaigns` | Campanhas de WhatsApp e Instagram |
| `/chatbot` | Configuração do chatbot e IA Lara |
| `/lara-dashboard` | Painel de performance da IA |
| `/lara-logs` | Histórico de atendimentos da IA |
| `/lara-reports` | Relatórios da IA |

### IXCSoft

| Rota | Descrição |
|---|---|
| `/customers` | Lista de clientes com busca e filtros |
| `/customers/:id` | Perfil completo + linha do tempo de interações |
| `/contracts` | Contratos ativos e cancelados |
| `/plans` | Planos de internet cadastrados |
| `/vendors` | Vendedores da equipe comercial |
| `/charges` | Cobranças com envio de PIX e boleto |
| `/financial` | Inadimplência com faixas de atraso e ações em massa |
| `/work-orders` | Ordens de serviço — visualizar, criar e filtrar |
| `/noc` | NOC — clientes offline e sinal ruim |
| `/ixc-test` | Teste de conexão com diagnóstico |

### Ferramentas e Configurações

| Rota | Descrição |
|---|---|
| `/message-templates` | Templates de mensagem WhatsApp |
| `/signatures` | Assinaturas eletrônicas via ZapSign |
| `/knowledge` | Base de conhecimento |
| `/reports` | Relatórios de atendimento e NPS |
| `/integrations` | Gerenciamento de integrações |
| `/telephony` | Telefonia (ramais, SIP, URA, filas) |
| `/users` | Usuários e permissões |
| `/tags-queues` | Etiquetas e filas de atendimento |
| `/holidays` | Feriados e horários de funcionamento |
| `/audit-logs` | Logs de auditoria |
| `/system-logs` | Logs do sistema e integrações |
| `/settings` | Configurações gerais |

---

## 🔒 Segurança

- `IXC_API_TOKEN` processado exclusivamente em funções server-side (Deno) — nunca chega ao navegador
- Variáveis sensíveis **nunca** recebem o prefixo `VITE_`
- `.gitignore` protege `.env`, `.env.*`, `node_modules`, `dist` e logs
- `.env.example` contém apenas chaves documentadas, sem valores reais
- Nenhum token ou senha hardcoded no código-fonte
- Erros retornados ao frontend não expõem credenciais

---

## 🗺 Pendências e Roadmap

### Integrações pendentes (requerem infraestrutura adicional)

| Funcionalidade | Dependência | Status |
|---|---|---|
| Clientes offline em tempo real | RADIUS (Mikrotik/Cisco) | 🔜 Código preparado |
| Sinal óptico ruim | OLT Huawei/ZTE ou Zabbix | 🔜 Endpoint documentado |
| Monitoramento de rede | Grafana / Zabbix API | 🔜 Planejado |
| Desbloqueio automático pós-pagamento | Webhook IXCSoft → RADIUS | 🔜 Planejado |
| Disparo em massa via Z-API / DisparoPro | API externa | 🔜 Planejado |

### Próximas funcionalidades

- [ ] Agenda técnica com mapa e roteirização de OS
- [ ] Relatório de crescimento mensal (base × churn)
- [ ] Integração com Pix instantâneo via webhook de pagamento
- [ ] App mobile para técnicos (PWA)
- [ ] Ranking de vendedores com metas configuráveis

---

## ➕ Como Adicionar Nova Integração

1. Crie a function em `base44/functions/novaIntegracao/entry.ts`
2. Adicione o wrapper frontend em `src/functions/novaIntegracao.js`
3. Crie a página em `src/pages/NovaIntegracao.jsx` seguindo o padrão existente
4. Registre a rota em `src/App.jsx`
5. Adicione o item de menu em `src/components/Sidebar.jsx`
6. Documente as variáveis necessárias em `.env.example`

---

<div align="center">

Desenvolvido com ❤️ para provedores de internet brasileiros

**[GitHub](https://github.com/dx2neto/WOOWFLOW)** · Base44 · IXCSoft · Evolution API

</div>
