import React, { useState } from "react";
import { useEntityList, useEntityFilter } from "@/hooks/useEntityQueries";
import { PageContainer, Card } from "@/components/ui/app-card";
import { StatCard } from "@/components/ui/app-card";
import IntegrationStatusGrid from "@/components/audit/IntegrationStatusGrid";
import ErrorLogTable from "@/components/audit/ErrorLogTable";
import DependencyMap from "@/components/audit/DependencyMap";
import { ShieldCheck, AlertTriangle, Plug, Activity, Database, RefreshCw, MessageCircle, FileSignature } from "lucide-react";

export default function SystemAudit() {
  const [tab, setTab] = useState("overview");

  const { data: errorLogs = [], isLoading: loadingErrors } = useEntityList("ErrorLog", "-created_date", 100);
  const { data: integrationLogs = [], isLoading: loadingIntLogs } = useEntityList("IntegrationLog", "-created_date", 100);
  const { data: configs = [], isLoading: loadingConfigs } = useEntityList("IntegrationConfig", "-updated_at", 200);
  const { data: evoFailures = [], isLoading: loadingEvo } = useEntityFilter("IntegrationLog", { integration: "evolutionApi", status: "falha" }, "-created_date", 50);

  const stats = {
    totalErrors: errorLogs.length,
    critical: errorLogs.filter((e) => e.severity === "critica").length,
    activeIntegrations: configs.filter((c) => c.status === "connected").length,
    failedIntegrations: configs.filter((c) => c.status === "error").length,
  };

  const tabs = [
    { key: "overview",  label: "Visão Geral",     icon: ShieldCheck },
    { key: "errors",    label: "Erros",            icon: AlertTriangle },
    { key: "evo",       label: "Evolution API",   icon: MessageCircle },
    { key: "deps",      label: "Dependências",     icon: Database },
  ];

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-heading">Painel de Auditoria do Sistema</h2>
        <p className="text-sm text-muted-foreground">Centralize alertas, erros e status de integrações em um único lugar</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Erros Registrados" value={stats.totalErrors} icon={AlertTriangle} color="danger" subtitle={`${stats.critical} crítica(s)`} />
        <StatCard title="Integrações Ativas" value={stats.activeIntegrations} icon={Plug} color="accent" />
        <StatCard title="Integrações com Falha" value={stats.failedIntegrations} icon={AlertTriangle} color="warning" />
        <StatCard title="Falhas Evolution API" value={evoFailures.length} icon={MessageCircle} color="purple" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto scrollbar-thin">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Visão Geral ─────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          <Card title="Status das Integrações" className="p-5">
            <IntegrationStatusGrid configs={configs} loading={loadingConfigs} />
          </Card>

          <Card title="Últimos Erros Críticos" className="p-5">
            <ErrorLogTable errors={errorLogs.filter((e) => ["critica","alta"].includes(e.severity)).slice(0, 10)} loading={loadingErrors} />
          </Card>
        </div>
      )}

      {/* ── Erros ───────────────────────────────────────────────────────── */}
      {tab === "errors" && (
        <Card title="Log de Erros do Sistema" className="p-5">
          <ErrorLogTable errors={errorLogs} loading={loadingErrors} />
        </Card>
      )}

      {/* ── Evolution API ────────────────────────────────────────────────── */}
      {tab === "evo" && (
        <div className="space-y-4">
          <Card title="Falhas de Envio — Evolution API" className="p-5">
            {loadingEvo ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" /> Carregando falhas...
              </div>
            ) : evoFailures.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                Nenhuma falha registrada na Evolution API
              </div>
            ) : (
              <div className="space-y-2">
                {evoFailures.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50">
                    <MessageCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-red-800">{log.action || "Envio de mensagem"}</p>
                      <p className="text-xs text-red-600 mt-0.5">{log.details || "Falha no envio via Evolution API"}</p>
                      <p className="text-[10px] text-red-400 mt-1">{new Date(log.created_date).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Histórico de Integrações" className="p-5">
            {loadingIntLogs ? (
              <div className="text-center py-6 text-sm text-muted-foreground">Carregando...</div>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto scrollbar-thin">
                {integrationLogs.slice(0, 50).map((log) => (
                  <div key={log.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card text-sm">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${log.status === "sucesso" ? "bg-emerald-500" : "bg-red-500"}`} />
                    <span className="font-medium flex-shrink-0">{log.integration}</span>
                    <span className="text-muted-foreground truncate flex-1">{log.action}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{new Date(log.created_date).toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Dependências ────────────────────────────────────────────────── */}
      {tab === "deps" && (
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-base mb-1 flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" /> Mapa de Dependências
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Relação entre IXCSoft, automações de contrato e integrações externas. Verifique se não há elos perdidos.
            </p>
            <DependencyMap />
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> Pontos de Atenção
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span className="text-amber-800">Garanta que todo ContractTemplate tenha <code className="font-mono text-xs">ixc_plan_ids</code> preenchido para mapeamento automático.</span>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                <Plug className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <span className="text-blue-800">A Evolution API deve estar conectada para que lembretes de cobrança e confirmações de instalação sejam enviados.</span>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-purple-50 border border-purple-200">
                <FileSignature className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <span className="text-purple-800">O token do ZapSign deve estar válido para geração de contratos e termos de adesão.</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}