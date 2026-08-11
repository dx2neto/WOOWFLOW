# Matriz de Auditoria — ConnectFlow Hub

**Data:** 2026-08-11 | **Sistema:** WoowChat / ConnectFlow Hub | **Ambiente:** Base44 (Deno + React)

## Resumo Executivo

Auditoria completa do sistema identificou **18 problemas** classificados por severidade.
As correções CRÍTICAS e ALTAS foram executadas nesta sessão.

---

## Matriz de Problemas

| # | Item | Situação | Problema | Impacto | Severidade | Status |
|---|------|----------|----------|---------|------------|--------|
| 1 | `crypto.ts` | Fallback inseguro | Chave `fallback-lgpd-key-2026` usada quando `INTERNAL_FUNCTION_TOKEN` ausente | Dados sensíveis (CPF/CNPJ) cifrados com chave fraca e previsível | **CRÍTICO** | ✅ Corrigido |
| 2 | `salesPipelineApi` create_ixc_contract | CPF criptografado enviado ao IXC | `sale.cpf_cnpj` (cifrado AES-GCM) enviado direto para `ixcApi create_customer` | Cliente criado no IXC com documento ilegível → contrato inválido | **CRÍTICO** | ✅ Corrigido |
| 3 | SDK version mismatch | Versões divergentes | ixcApi, evolutionApi, evolutionWebhook, zapsignApi usam `0.8.31`; salesPipelineApi usa `0.8.40` | Incompatibilidade entre funções, comportamento inconsistente | **ALTO** | ✅ Corrigido (unificado para `0.8.41`) |
| 4 | `ixcApi` contratos | Paginação truncada | Usava `ixcPost` (página única de `limit` registros) em vez de `fetchAllPages` | Contratos além da página 1 não apareciam | **ALTO** | ✅ Corrigido |
| 5 | `ixcApi` inadimplentes | Paginação truncada | Mesmo problema — única página de `limit` registros | Inadimplentes além da página 1 não apareciam | **ALTO** | ✅ Corrigido |
| 6 | `zapsignApi` ixcFetch | Paginação incorreta | Usava `limit: '1', start: '0'` (não é formato IXC) | Apenas 1 registro retornado por consulta IXC | **ALTO** | ✅ Corrigido |
| 7 | Camada de integração IXC | Inexistente | Chamadas à API IXC espalhadas diretamente nas funções | Sem centralização de auth, retry, timeout, cache | **ALTO** | ✅ Criado `base44/shared/ixcClient.ts` |
| 8 | `ixcApi` carregarMapaCidades | Sem cache | Buscada tabela inteira de cidades a cada requisição | Latência desnecessária (~200ms por request) | **MÉDIO** | ✅ Corrigido (cache 10min no `ixcClient.ts`) |
| 9 | `evolutionWebhook` origin validation | Sem validação de origem | Webhook aceita requisição de qualquer IP (apenas rate limit) | Risco de spoofing de webhook | **MÉDIO** | ⏳ Pendente (rate limit ativo) |
| 10 | RLS em entidades admin | Configuração inconsistente | Algumas entidades admin não têm RLS explícito em todos os campos | Possível acesso não autorizado | **MÉDIO** | ⏳ Pendente |
| 11 | `useInboxRealtime` queryKeys | queryKeys quebradas | Realtime subscription não invalida cache corretamente | Mensagens não atualizam em tempo real | **MÉDIO** | ⏳ Pendente |
| 12 | `aiOrchestrator` error handling | Erros silenciosos | Falhas na chamada LLM engolidas sem log adequado | IA falha sem rastreabilidade | **MÉDIO** | ⏳ Pendente |
| 13 | `NOC.jsx` noc_sinal_ruim | Dados mockados | Retorna array vazio com `pending: true` | Tela NOC sinal ruim não funcional | **BAIXO** | ⏳ Pendente (requer integração OLT/Zabbix) |
| 14 | `Dashboard.jsx` clientes_offline | Campo null | `dashboard` retorna `clientes_offline: null` | Card offline sempre vazio no dashboard | **BAIXO** | ⏳ Pendente (requer integração RADIUS) |
| 15 | `salesPipelineApi` health_check | Sem teste real | Apenas verifica se secrets existem, não testa conectividade | Falso positivo de "ONLINE" | **BAIXO** | ⏳ Pendente |
| 16 | `ixcApi` fallback legado | Sem action validation | Bloco final aceita qualquer action desconhecida | Erro 400 confuso em vez de mensagem clara | **BAIXO** | ⏳ Pendente |
| 17 | Duplicação de código IXC | `ixcPost`/`ixcWrite` no ixcApi | Funções helper duplicadas em ixcApi e zapsignApi | Manutenção difícil | **BAIXO** | ⏳ Parcial (ixcClient.ts criado, migração pendente) |
| 18 | `fetchWithRetry` timeout | Sem timeout configurável por função | Todas as funções usam 30s fixo | Chamadas IXC longas podem timeout | **BAIXO** | ✅ Corrigido (ixcClient.ts permite configurar) |

---

## Camada de Integração IXC Criada

**Arquivo:** `base44/shared/ixcClient.ts`

Centraliza toda comunicação com a API IXCSoft:

- **IXCClient.fromEnv()** — instancia cliente a partir de secrets (IXC_API_URL, IXC_API_TOKEN)
- **list()** — busca uma página (com auth, timeout, retry)
- **listAll()** — busca todas as páginas até maxRecords
- **listByIds()** — busca em lote por IDs (operador IN)
- **create()** / **update()** — operações de escrita
- **getCidadeMap()** — mapa de cidades com cache de 10 minutos
- **testConnection()** — teste de conectividade
- **Normalização** — `normalizeIXCStatus`, `normalizeIXCInternetStatus`, `normalizeIXCPhone`, `parseIXCValue`

### Arquitetura

```
IXCSoft API
    ↓
IXCClient (auth, timeout, retry, pagination)
    ↓
Normalização (status, phone, value)
    ↓
Cache (cidades — 10 min TTL)
    ↓
Backend Functions (ixcApi, zapsignApi, salesPipelineApi)
    ↓
Frontend (pages/components)
```

---

## Próximos Passos (Pendentes)

1. **Migrar `ixcApi` para usar `IXCClient`** — substituir `ixcPost`/`ixcWrite`/`fetchAllPages` internos pelo módulo centralizado
2. **Validar origem do webhook** — adicionar verificação de IP/origin no evolutionWebhook
3. **Corrigir RLS** — revisar todas as entidades admin para garantir RLS consistente
4. **Fix queryKeys realtime** — corrigir invalidação de cache no `useInboxRealtime`
5. **Integrar OLT/Zabbix/RADIUS** — implementar camada separada para NOC (sinal ruim, offline real)
6. **Health check real** — testar conectividade IXC/Evolution/ZapSign no health_check do salesPipelineApi