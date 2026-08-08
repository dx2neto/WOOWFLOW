import React, { useMemo, useState } from "react";
import { useEntityList, useEntityFilter } from "@/hooks/useEntityQueries";
import { PageContainer, StatCard, Card } from "@/components/ui/app-card";
import AlertFeed from "@/components/audit/AlertFeed";
import ErrorLogTable from "@/components/audit/ErrorLogTable";
import IntegrationStatusGrid from "@/components/audit/IntegrationStatusGrid";
import DependencyMap from "@/components/audit/DependencyMap";
import {
  ShieldCheck, AlertTriangle, Plug, Activity, RefreshCw, ListChecks,
  Database, MessageCircle, FileSignature, Bug, Eye,
} from "lucide-react";

const SEVERITY_ORDER = { critica: 0, alta: 1, media: 2, baixa: 3 };

export default function AuditCenter() {
  const [tab, setTab] = useState("feed");
  const [filter, setFilter] = useState("all");

  const { data: errorLogs = [], isLoading: loadingErrors } = useEntityList("ErrorLog", "-created_date", 200);
  const { data: integrationLogs = [], isLoading: loadingIntLogs } = useEntityList("IntegrationLog", "-created_date", 200);
  const { data: auditLogs = [], isLoading: loadingAudit } = useEntityList("AuditLog", "-created_date", 200);
  const { data: configs = [], isLoading: loadingConfigs } = useEntityList("IntegrationConfig", "-updated_at", 200);
  const { data: evoFailures = [], isLoading: loadingEvo } = useEntityFilter(
    "IntegrationLog", { integration: "evolutionApi", status: "falha" }, "-created_date", 50
  );

  // ── Feed unificado de alertas ─────────────────────────────────────────────
  const alerts = useMemo(() => {
    const items = [];

    for (const e of errorLogs) {
      items.push({
        id: `err_${e.id}`,
        type: "error",
        severity: e.severity || "alta",
        title: e.error_message || "Erro no sistema",
        source: e.function_name || "Sistema",
        detail: e.action || "",
        timestamp: e.created_date,
        context: e.error_context,
        stack: e.stack_trace,
      });
    }

    for (const l of integrationLogs) {
      if (l.status === "falha") {
        items.push({
          id: `int_${l.id}`,
          type: "integration",
          severity: "alta",
          title: `Falha: ${l.integration}`,
          source: l.integration,
          detail: l.action || "",
          timestamp: l.created_date,
          context: l.details,
        });
      }
    }

    for (const c of configs) {
      if (c.status === "error" || c.status === "disconnected") {
        items.push({
          id: `cfg_${c.id}`,
          type: "config",
          severity: c.status === "error" ? "alta" : "media",
          title: `${c.display_name || c.service} — ${c.status === "error" ? "com erro" : "desconectada"}`,
          source: c.service,
          detail: c.error_message || "Verifique a configuração",
          timestamp: c.updated_at || c.created_at,
        });
      }
    }

    for (const a of auditLogs) {
      if (["delete", "export", "login"].includes(a.action)) {
        items.push({
          id: `aud_${a.id}`,
          type: "audit",
          severity: a.action === "delete" ? "media" : "baixa",
          title: `${a.user_name} — ${a.action.toUpperCase()}`,
          source: a.module || "Auditoria",
          detail: a.description || "",
          timestamp: a.created_date,
        });
      }
    }

    return items.sort((a, b) => {
      const sevDiff = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
      if (sevDiff !== 0) return sevDiff;
      return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
    });
  }, [errorLogs, integrationLogs, configs, auditLogs]);

  // ── Estatísticas ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const critical = alerts.filter((a) => a.severity === "critica").length;
    const high = alerts.filter((a) => a.severity === "alta").length;
    const integrationIssues = alerts.filter((a) => a.type === "integration" || a.type === "config").length;
    const recent = alerts.filter((a) => {
      const ts = new Date(a.timestamp || 0).getTime();
      return ts > Date.now() - 24 * 60 * 60 * 1000;
    }).length;
    return { total: alerts.length, critical, high, integrationIssues, recent };
  }, [alerts]);

  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.type === filter || a.severity === filter);

  const loading = loadingErrors || loadingIntLogs || loadingConfigs || loadingAudit;

  const filters = [
    { key: "all",         label: "Todos",            count: alerts.length },
    { key: "critica",     label: "Críticos",         count: stats.critical },
    { key: "alta",        label: "Alta Prioridade",  count: stats.high },
    { key: "error",       label: "Erros",            count: alerts.filter((a) => a.type === "error").length },
    { key: "integration", label: "Integrações",      count: alerts.filter((a) => a.type === "integration" || a.type === "config").length },
    { key: "audit",       label: "Auditoria",        count: alerts.filter((a) => a.type === "audit").length },
  ];

  const tabs = [
    { key: "feed",  label: "Feed de Alertas",    icon: ListChecks },
    { key: "integ", label: "Status de Integrações", icon: Plug },
    { key: "errors", label: "Erros Detalhados",    icon: Bug },
    { key: "deps",  label: "Mapa de Dependências", icon: Database },
  ];

  const evoFailCount = evoFailures.length;

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-heading flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" /> Painel de Auditoria
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Centralize todos os alertas e erros do sistema em um único painel visual para resolução rápida de pendências
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Total de Alertas" value={stats.total} icon={ListChecks} color="primary" subtitle={`${stats.recent} nas últimas 24h`} />
        <StatCard title="Críticos" value={stats.critical} icon={AlertTriangle} color="danger" />
        <StatCard title="Alta Prioridade" value={stats.high} icon={Activity} color="warning" />
        <StatCard title="Problemas de Integração" value={stats.integrationIssues} icon={Plug} color="purple" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-border overflow-x-auto scrollbar-thin">
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

      {/* ── Feed de Alertas ─────────────────────────────────────────────── */}
      {tab === "feed" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  filter === f.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/40"
                }`}
              >
                {f.label} <span className="opacity-70">({f.count})</span>
              </button>
            ))}
          </div>
          <AlertFeed alerts={filtered} loading={loading} />
        </div>
      )}

      {/* ── Status de Integrações ─────────────────────────────────────────── */}
      {tab === "integ" && (
        <div className="space-y-4">
          <Card title="Status das Integrações" className="p-5">
            <IntegrationStatusGrid configs={configs} loading={loadingConfigs} />
          </Card>

          <Card title="Falhas — Evolution API" className="p-5">
            {loadingEvo ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" /> Carregando falhas...
              </div>
            ) : evoFailCount === 0 ? (
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

      {/* ── Erros Detalhados ──────────────────────────────────────────────── */}
      {tab === "errors" && (
        <Card title="Log de Erros do Sistema" className="p-5">
          <ErrorLogTable errors={errorLogs} loading={loadingErrors} />
        </Card>
      )}

      {/* ── Mapa de Dependências ──────────────────────────────────────────── */}
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
              <Eye className="w-5 h-5 text-primary" /> Pontos de Atenção
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