import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, Card } from "@/components/ui/app-card";
// Note: lucide-react removed Instagram and Facebook icons; Camera/Globe used as substitutes
import {
  MessageCircle, Database, FileSignature, ShieldCheck, Camera,
  Globe, Send, CheckCircle, XCircle, Settings, RefreshCw, Plus, QrCode,
  Mail, Phone, Bot, MessageSquare, RadioTower
} from "lucide-react";
import { evolutionApi } from "@/functions/evolutionApi";
import { omnichannelApi } from "@/functions/omnichannelApi";
import { ixcApi } from "@/functions/ixcApi";
import { zapsignApi } from "@/functions/zapsignApi";
import { serasaApi } from "@/functions/serasaApi";
import InstanceManagerModal from "@/components/integrations/InstanceManagerModal";
import EvolutionQrCodeModal from "@/components/integrations/EvolutionQrCodeModal";
import GoogleSheetsSyncCard from "@/components/integrations/GoogleSheetsSyncCard";

const testFunctions = {
  evolution_api: evolutionApi,
  ixc_provedor: ixcApi,
  zapsign: zapsignApi,
  validacadastro: serasaApi,
};

const omnichannelServices = new Set([
  "instagram",
  "facebook",
  "messenger",
  "tiktok",
  "email",
  "telefone",
  "chat_interno",
  "chat_externo",
  "webchat",
  "ai_assistant",
]);

const integrations = [
  {
    service: "evolution_api",
    display_name: "Evolution Go",
    description: "WhatsApp Business API para envio e recebimento de mensagens",
    icon: MessageCircle,
    color: "from-green-500 to-green-600",
    status: "pending",
    fields: ["URL da API", "API Key", "Nome da Instância"],
  },
  {
    service: "ixc_provedor",
    display_name: "IXC Provedor",
    description: "ERP para provedores de internet - clientes, contratos, financeiro, OS",
    icon: Database,
    color: "from-blue-500 to-blue-600",
    status: "disconnected",
    fields: ["URL do IXC", "Token de API"],
  },
  {
    service: "zapsign",
    display_name: "ZapSign",
    description: "Assinatura eletrônica de contratos e documentos",
    icon: FileSignature,
    color: "from-purple-500 to-purple-600",
    status: "disconnected",
    fields: ["API Token"],
  },
  {
    service: "validacadastro",
    display_name: "ValidaCadastro",
    description: "Validação de CPF/CNPJ e dados cadastrais",
    icon: ShieldCheck,
    color: "from-indigo-500 to-indigo-600",
    status: "disconnected",
    fields: ["API Token"],
  },
  {
    service: "instagram",
    display_name: "Instagram Business",
    description: "Recebimento de mensagens do Instagram Direct",
    icon: Camera,
    color: "from-pink-500 to-rose-600",
    status: "disconnected",
    fields: ["OAuth - Conectar conta"],
  },
  {
    service: "facebook",
    display_name: "Facebook Messenger",
    description: "Recebimento de mensagens do Facebook Messenger pela API Meta",
    icon: Globe,
    color: "from-blue-600 to-blue-700",
    status: "disconnected",
    fields: ["META_APP_ID", "META_PAGE_ACCESS_TOKEN", "Webhook Meta"],
  },
  {
    service: "messenger",
    display_name: "Messenger",
    description: "Canal Meta Messenger centralizado na Inbox",
    icon: MessageCircle,
    color: "from-cyan-500 to-blue-600",
    status: "disconnected",
    fields: ["META_PAGE_ACCESS_TOKEN", "META_VERIFY_TOKEN"],
  },
  {
    service: "tiktok",
    display_name: "TikTok",
    description: "Mensagens e leads do TikTok gerenciados pelo backend",
    icon: RadioTower,
    color: "from-slate-700 to-rose-600",
    status: "disconnected",
    fields: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "Webhook"],
  },
  {
    service: "email",
    display_name: "E-mail + IA",
    description: "Caixa IMAP/SMTP com sugestão e resposta automática por IA",
    icon: Mail,
    color: "from-orange-500 to-amber-600",
    status: "disconnected",
    fields: ["IMAP", "SMTP", "AI_PROVIDER"],
  },
  {
    service: "telefone",
    display_name: "Telefone / PABX",
    description: "Atendimentos telefônicos e URA na mesma fila",
    icon: Phone,
    color: "from-indigo-500 to-violet-600",
    status: "disconnected",
    fields: ["PABX_API_URL", "PABX_API_TOKEN"],
  },
  {
    service: "chat_interno",
    display_name: "Chat interno",
    description: "Mensagens entre usuários e equipes dentro da plataforma",
    icon: MessageSquare,
    color: "from-amber-500 to-yellow-600",
    status: "pending",
    fields: ["Usuários", "Equipes", "Histórico"],
  },
  {
    service: "webchat",
    display_name: "Chat para site",
    description: "Widget externo para captar visitantes e abrir conversas na Inbox",
    icon: MessageSquare,
    color: "from-purple-500 to-fuchsia-600",
    status: "pending",
    fields: ["Widget", "Origem do site", "Webhook"],
  },
  {
    service: "chat_externo",
    display_name: "Chat externo",
    description: "Entrada de conversas de portais, apps e páginas externas",
    icon: MessageSquare,
    color: "from-violet-500 to-indigo-600",
    status: "pending",
    fields: ["Origem", "Identificador externo", "Webhook"],
  },
  {
    service: "ai_assistant",
    display_name: "IA 24h",
    description: "Assistente para sugerir ou responder automaticamente nos canais conectados",
    icon: Bot,
    color: "from-emerald-500 to-teal-600",
    status: "disconnected",
    fields: ["AI_PROVIDER", "AI_API_KEY", "Resposta automática"],
  },
  {
    service: "telegram",
    display_name: "Telegram Bot",
    description: "Bot para recebimento de mensagens do Telegram",
    icon: Send,
    color: "from-sky-500 to-sky-600",
    status: "disconnected",
    fields: ["Bot Token"],
  },
];

const statusConfig = {
  connected: { label: "Conectado", color: "text-green-600 bg-green-50", icon: CheckCircle },
  disconnected: { label: "Desconectado", color: "text-gray-500 bg-gray-50", icon: XCircle },
  error: { label: "Erro", color: "text-red-600 bg-red-50", icon: XCircle },
  pending: { label: "Pendente", color: "text-amber-600 bg-amber-50", icon: RefreshCw },
};

export default function Integrations() {
  const [configs, setConfigs] = useState({});
  const [testingService, setTestingService] = useState(null);
  const [showInstanceManager, setShowInstanceManager] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const data = await base44.entities.IntegrationConfig.list();
      const map = {};
      data.forEach((c) => { map[c.service] = c; });
      setConfigs(map);
    } catch {}
  };

  const getStatus = (service) => {
    return configs[service]?.status || integrations.find((i) => i.service === service)?.status || "disconnected";
  };

  const handleTestConnection = async (int) => {
    const testFn = testFunctions[int.service];
    setTestingService(int.service);
    try {
      const response = testFn
        ? await testFn(int.service === "evolution_api" ? { action: "test_connection" } : {})
        : await omnichannelApi({ action: "test_connection", service: int.service, display_name: int.display_name });
      const success = response?.data?.success;
      const pending = response?.data?.status === "pending";
      const payload = {
        service: int.service,
        display_name: int.display_name,
        status: success ? "connected" : pending ? "pending" : "error",
        error_message: success ? "" : response?.data?.error || response?.data?.details?.message || "Integração aguardando configuração.",
        last_sync: new Date().toISOString(),
      };
      const existing = configs[int.service];
      if (existing) {
        await base44.entities.IntegrationConfig.update(existing.id, payload);
      } else {
        await base44.entities.IntegrationConfig.create(payload);
      }
    } catch {
      const existing = configs[int.service];
      const payload = { service: int.service, display_name: int.display_name, status: "error", last_sync: new Date().toISOString() };
      if (existing) await base44.entities.IntegrationConfig.update(existing.id, payload);
      else await base44.entities.IntegrationConfig.create(payload);
    } finally {
      setTestingService(null);
      await loadConfigs();
    }
  };

  return (
    <PageContainer>
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-heading">Integrações</h2>
        <p className="text-sm text-muted-foreground">Conecte seus serviços e canais de atendimento</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((int) => {
          const Icon = int.icon;
          const status = getStatus(int.service);
          const StatusIcon = statusConfig[status]?.icon || XCircle;
          return (
            <Card key={int.service} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${int.color} flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[status]?.color}`}>
                  <StatusIcon className="w-3.5 h-3.5" /> {statusConfig[status]?.label}
                </span>
              </div>

              <h3 className="font-semibold mb-1">{int.display_name}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{int.description}</p>

              <div className="space-y-1 mb-4">
                {int.fields.map((field) => (
                  <p key={field} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground" /> {field}
                  </p>
                ))}
              </div>

              <div className="flex gap-2">
                {int.service === "evolution_api" && (
                  <>
                    <button
                      onClick={() => setShowInstanceManager(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted"
                    >
                      <Settings className="w-4 h-4" /> Instâncias
                    </button>
                    <button
                      onClick={() => setShowQrCode(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted"
                    >
                      <QrCode className="w-4 h-4" /> QR Code
                    </button>
                  </>
                )}
                {(testFunctions[int.service] || omnichannelServices.has(int.service)) ? (
                  status === "connected" ? (
                    <>
                      {int.service !== "evolution_api" && (
                        <button className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">
                          <Settings className="w-4 h-4" /> Configurar
                        </button>
                      )}
                      <button
                        onClick={() => handleTestConnection(int)}
                        disabled={testingService === int.service}
                        className="flex items-center justify-center px-3 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 text-muted-foreground ${testingService === int.service ? "animate-spin" : ""}`} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleTestConnection(int)}
                      disabled={testingService === int.service}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                    >
                      {testingService === int.service ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      {testingService === int.service ? "Testando..." : "Conectar"}
                    </button>
                  )
                ) : (
                  <button className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                    <Plus className="w-4 h-4" /> Conectar
                  </button>
                )}
              </div>
            </Card>
          );
        })}
        <GoogleSheetsSyncCard />
      </div>

      {showInstanceManager && (
        <InstanceManagerModal onClose={() => setShowInstanceManager(false)} />
      )}
      {showQrCode && (
        <EvolutionQrCodeModal onClose={() => setShowQrCode(false)} />
      )}
    </PageContainer>
  );
}
