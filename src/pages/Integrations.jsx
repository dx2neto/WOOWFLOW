import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, Card } from "@/components/ui/app-card";
import {
  Bot,
  BriefcaseBusiness,
  CheckCircle,
  CreditCard,
  Database,
  FileSignature,
  Globe,
  Mail,
  MessageCircle,
  Phone,
  QrCode,
  RadioTower,
  RefreshCw,
  Settings,
  Sparkles,
  TestTube2,
  XCircle,
} from "lucide-react";
import { evolutionApi } from "@/functions/evolutionApi";
import { ixcApi } from "@/functions/ixcApi";
import { metaApi } from "@/functions/metaApi";
import { tiktokApi } from "@/functions/tiktokApi";
import { emailApi } from "@/functions/emailApi";
import { telephonyApi } from "@/functions/telephonyApi";
import { crmApi } from "@/functions/crmApi";
import { billingApi } from "@/functions/billingApi";
import { signatureApi } from "@/functions/signatureApi";
import { aiOmnichannelApi } from "@/functions/aiOmnichannelApi";
import { omnichannelApi } from "@/functions/omnichannelApi";
import InstanceManagerModal from "@/components/integrations/InstanceManagerModal";
import EvolutionQrCodeModal from "@/components/integrations/EvolutionQrCodeModal";

const integrationActions = {
  erp_provider: ixcApi,
  evolution_go: evolutionApi,
  facebook_messenger: metaApi,
  instagram_direct: metaApi,
  tiktok: tiktokApi,
  email: emailApi,
  telephony_pabx: telephonyApi,
  crm: crmApi,
  billing: billingApi,
  digital_signature: signatureApi,
  ai_sales_support: aiOmnichannelApi,
};

const configAliases = {
  evolution_go: ["evolution_go", "evolution_api"],
  erp_provider: ["erp_provider", "ixc_provedor"],
  digital_signature: ["digital_signature", "zapsign"],
  facebook_messenger: ["facebook_messenger", "facebook", "messenger"],
  instagram_direct: ["instagram_direct", "instagram"],
  telephony_pabx: ["telephony_pabx", "telefone"],
  ai_sales_support: ["ai_sales_support", "ai_assistant"],
};

const integrations = [
  {
    service: "erp_provider",
    display_name: "ERP do provedor",
    category: "Operação",
    provider: "IXCSoft",
    description: "Clientes, contratos, financeiro, OS e base operacional do provedor (IXCSoft unificado).",
    icon: Database,
    color: "from-blue-600 to-cyan-600",
    fields: ["Clientes", "Contratos", "Financeiro", "OS"],
    sync: true,
  },
  {
    service: "evolution_go",
    display_name: "WhatsApp Evolution GO",
    category: "Atendimento",
    provider: "Evolution GO",
    description: "Instâncias, QR Code, envio, mídia, webhook e histórico no Inbox.",
    icon: MessageCircle,
    color: "from-emerald-500 to-green-700",
    fields: ["Instâncias", "QR Code", "Webhook", "Histórico"],
    sync: true,
  },
  {
    service: "facebook_messenger",
    display_name: "Facebook Messenger",
    category: "Redes sociais",
    provider: "Meta",
    description: "OAuth, páginas, webhook, mensagens recebidas e respostas pelo Inbox.",
    icon: Globe,
    color: "from-blue-700 to-sky-600",
    fields: ["OAuth", "Página", "Webhook", "Inbox"],
    sync: true,
  },
  {
    service: "instagram_direct",
    display_name: "Instagram Direct",
    category: "Redes sociais",
    provider: "Meta",
    description: "Direct do Instagram centralizado com histórico e status da integração.",
    icon: Globe,
    color: "from-pink-500 to-rose-600",
    fields: ["OAuth", "Conta business", "Webhook", "Inbox"],
    sync: true,
  },
  {
    service: "tiktok",
    display_name: "TikTok",
    category: "Aquisição",
    provider: "TikTok",
    description: "Leads, comentários, formulários, eventos e campanhas quando a API permitir.",
    icon: RadioTower,
    color: "from-slate-800 to-rose-600",
    fields: ["Leads", "Comentários", "Formulários", "Campanhas"],
    sync: true,
  },
  {
    service: "email",
    display_name: "E-mail",
    category: "Atendimento",
    provider: "IMAP/SMTP, Gmail ou Outlook",
    description: "Leitura, resposta, rascunho por IA e classificação automática.",
    icon: Mail,
    color: "from-orange-500 to-amber-600",
    fields: ["IMAP", "SMTP", "Rascunho IA", "Prioridade"],
    sync: true,
  },
  {
    service: "telephony_pabx",
    display_name: "Telefonia/PABX",
    category: "Atendimento",
    provider: "Asterisk, 3CX, Issabel ou API",
    description: "Chamadas, URA, gravação, identificação do cliente e atendimento no Inbox.",
    icon: Phone,
    color: "from-indigo-600 to-violet-700",
    fields: ["Chamadas", "URA", "Gravações", "Fila"],
    sync: true,
  },
  {
    service: "crm",
    display_name: "CRM",
    category: "Vendas",
    provider: "WOOWFLOW CRM",
    description: "Leads, oportunidades, funil, vendedor responsável e origem do lead.",
    icon: BriefcaseBusiness,
    color: "from-teal-600 to-emerald-600",
    fields: ["Leads", "Funil", "Oportunidades", "Origem"],
    sync: true,
  },
  {
    service: "billing",
    display_name: "Cobrança",
    category: "Receita",
    provider: "ERP financeiro",
    description: "Lembretes, segunda via, Pix, negociação e régua automática.",
    icon: CreditCard,
    color: "from-cyan-700 to-blue-600",
    fields: ["Pix", "2a via", "Negociação", "Régua"],
    sync: true,
  },
  {
    service: "digital_signature",
    display_name: "Assinatura digital",
    category: "Contratos",
    provider: "ZapSign ou API",
    description: "Envio de contrato, link de assinatura, status e webhook de documento assinado.",
    icon: FileSignature,
    color: "from-purple-600 to-fuchsia-600",
    fields: ["Contrato", "Status", "Link", "Webhook"],
    sync: true,
  },
  {
    service: "ai_sales_support",
    display_name: "IA para atendimento e vendas",
    category: "IA",
    provider: "Assistente omnichannel",
    description: "Sugestões, rascunhos, resumo, sentimento, intenção e resposta assistida.",
    icon: Bot,
    color: "from-lime-600 to-emerald-700",
    fields: ["Sugestão", "Rascunho", "Resumo", "Handoff"],
    sync: false,
  },
];

const statusConfig = {
  connected: { label: "Conectado", color: "text-green-700 bg-green-50 border-green-200", icon: CheckCircle },
  disconnected: { label: "Desconectado", color: "text-gray-600 bg-gray-50 border-gray-200", icon: XCircle },
  error: { label: "Erro", color: "text-red-700 bg-red-50 border-red-200", icon: XCircle },
  pending: { label: "Pendente", color: "text-amber-700 bg-amber-50 border-amber-200", icon: RefreshCw },
};

function formatSyncDate(value) {
  if (!value) return "Nunca sincronizado";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Integrations() {
  const [configs, setConfigs] = useState({});
  const [busyService, setBusyService] = useState(null);
  const [showInstanceManager, setShowInstanceManager] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const data = await base44.entities.IntegrationConfig.list();
      const map = {};
      data.forEach((config) => { map[config.service] = config; });
      setConfigs(map);
    } catch {
      setConfigs({});
    }
  };

  const getConfig = (service) => {
    const keys = configAliases[service] || [service];
    return keys.map((key) => configs[key]).find(Boolean);
  };

  const cards = useMemo(() => integrations.map((integration) => ({
    ...integration,
    config: getConfig(integration.service),
  })), [configs]);

  const persistConfig = async (integration, patch = {}) => {
    const existing = getConfig(integration.service);
    const now = new Date().toISOString();
    const payload = {
      service: integration.service,
      display_name: integration.display_name,
      description: integration.description,
      category: integration.category,
      provider: integration.provider,
      status: patch.status || existing?.status || "pending",
      is_active: patch.status === "connected" || existing?.is_active || false,
      settings: existing?.settings || {},
      config: existing?.config || {},
      updated_at: now,
      created_at: existing?.created_at || now,
      ...patch,
    };
    if (existing) await base44.entities.IntegrationConfig.update(existing.id, payload);
    else await base44.entities.IntegrationConfig.create(payload);
    await loadConfigs();
  };

  const callIntegration = async (integration, action) => {
    const fn = integrationActions[integration.service] || omnichannelApi;
    if (integration.service === "evolution_go") {
      return fn({ action: action === "sync" ? "list_instances" : "test_connection" });
    }
    if (integration.service === "erp_provider") {
      return fn({ action: action === "sync" ? "clientes" : "test_connection" });
    }
    return fn({
      action,
      service: integration.service,
      display_name: integration.display_name,
      category: integration.category,
      provider: integration.provider,
    });
  };

  const handleConfigure = async (integration) => {
    if (integration.service === "evolution_go") {
      setShowInstanceManager(true);
      return;
    }
    setBusyService(`${integration.service}:configure`);
    try {
      await omnichannelApi({
        action: "upsert_config",
        service: integration.service,
        display_name: integration.display_name,
        description: integration.description,
        category: integration.category,
        provider: integration.provider,
        ai_mode: integration.service === "ai_sales_support" ? "suggestion" : undefined,
        ai_auto_reply: false,
      });
      await persistConfig(integration, { status: "pending", error_message: "Configure as credenciais seguras no backend para ativar." });
    } finally {
      setBusyService(null);
    }
  };

  const handleTestConnection = async (integration) => {
    setBusyService(`${integration.service}:test`);
    try {
      const response = await callIntegration(integration, "test_connection");
      const data = response?.data || {};
      const success = !!data.success;
      await persistConfig(integration, {
        status: success ? "connected" : data.status || "pending",
        is_active: success,
        error_message: success ? "" : data.error || (data.missing?.length ? `Faltando: ${data.missing.join(", ")}` : "Integração aguardando configuração."),
        last_sync: new Date().toISOString(),
      });
    } catch (error) {
      await persistConfig(integration, {
        status: "error",
        error_message: error.message || "Falha ao testar conexão.",
        last_sync: new Date().toISOString(),
      });
    } finally {
      setBusyService(null);
    }
  };

  const handleSync = async (integration) => {
    setBusyService(`${integration.service}:sync`);
    try {
      const response = await callIntegration(integration, "sync");
      const data = response?.data || {};
      const success = !!data.success;
      await persistConfig(integration, {
        status: success ? "connected" : data.status || "pending",
        error_message: success ? "" : data.error || (data.missing?.length ? `Faltando: ${data.missing.join(", ")}` : "Sincronização aguardando configuração."),
        last_sync: new Date().toISOString(),
      });
    } finally {
      setBusyService(null);
    }
  };

  return (
    <PageContainer>
      <section className="mb-6 overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid gap-5 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              Integrações e IA para provedores de internet
            </div>
            <h2 className="font-heading text-3xl font-bold tracking-normal text-foreground">
              Seu provedor mais rápido, inteligente e lucrativo
            </h2>
            <p className="mt-2 max-w-3xl text-base font-semibold text-muted-foreground">
              Automatize atendimento, cobrança e vendas com Inteligência Artificial para provedores de internet.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Com IA, seu provedor ganha produtividade, reduz custos operacionais, melhora o atendimento e aumenta as oportunidades de venda.
              Automatize o que é repetitivo e deixe sua equipe focada no que realmente precisa de atenção humana.
            </p>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {["ERP", "WhatsApp", "Messenger", "Instagram", "TikTok", "E-mail", "PABX", "CRM", "Cobrança", "Contratos", "IA"].map((item) => (
                <span key={item} className="rounded-md border border-border bg-background px-3 py-2 font-medium text-muted-foreground">
                  {item}
                </span>
              ))}
            </div>
            <button
              onClick={() => document.getElementById("ai_sales_support-card")?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Bot className="h-4 w-4" />
              Quero escalar meu provedor com IA
            </button>
          </div>
        </div>
      </section>

      <div className="mb-5">
        <h3 className="font-heading text-2xl font-bold">Integrações possíveis</h3>
        <p className="text-sm text-muted-foreground">Conecte os canais em rotas seguras de backend e acompanhe o status em uma única tela.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((integration) => {
          const Icon = integration.icon;
          const config = integration.config;
          const status = config?.status || "disconnected";
          const StatusIcon = statusConfig[status]?.icon || XCircle;
          const isTesting = busyService === `${integration.service}:test`;
          const isConfiguring = busyService === `${integration.service}:configure`;
          const isSyncing = busyService === `${integration.service}:sync`;

          return (
            <div key={integration.service} id={`${integration.service}-card`}>
            <Card className="flex min-h-[360px] flex-col p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${integration.color}`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusConfig[status]?.color}`}>
                  <StatusIcon className={`h-3.5 w-3.5 ${status === "pending" ? "" : ""}`} />
                  {statusConfig[status]?.label || status}
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{integration.category} · {integration.provider}</p>
                <h4 className="font-heading text-lg font-bold">{integration.display_name}</h4>
                <p className="min-h-[44px] text-sm leading-5 text-muted-foreground">{integration.description}</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {integration.fields.map((field) => (
                  <span key={field} className="rounded-md bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
                    {field}
                  </span>
                ))}
              </div>

              <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>Última sincronização</span>
                  <span className="font-medium text-foreground">{formatSyncDate(config?.last_sync)}</span>
                </div>
                {config?.error_message && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                    {config.error_message}
                  </p>
                )}
              </div>

              <div className="mt-auto grid grid-cols-3 gap-2 pt-4">
                <button
                  onClick={() => handleConfigure(integration)}
                  disabled={!!busyService}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                >
                  {isConfiguring ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
                  Configurar
                </button>
                <button
                  onClick={() => handleTestConnection(integration)}
                  disabled={!!busyService}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                >
                  {isTesting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />}
                  Testar
                </button>
                <button
                  onClick={() => handleSync(integration)}
                  disabled={!!busyService || !integration.sync}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSyncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Sincronizar
                </button>
              </div>

              {integration.service === "evolution_go" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowInstanceManager(true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-2 text-xs font-semibold hover:bg-muted"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Instâncias
                  </button>
                  <button
                    onClick={() => setShowQrCode(true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-2 text-xs font-semibold hover:bg-muted"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    QR Code
                  </button>
                </div>
              )}
            </Card>
            </div>
          );
        })}
      </div>

      {showInstanceManager && <InstanceManagerModal onClose={() => setShowInstanceManager(false)} />}
      {showQrCode && <EvolutionQrCodeModal onClose={() => setShowQrCode(false)} />}
    </PageContainer>
  );
}