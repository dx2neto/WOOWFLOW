import React, { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { salesPipelineApi } from "@/functions/salesPipelineApi";
import { useEntityList } from "@/hooks/useEntityQueries";
import { PageContainer, StatCard, Card } from "@/components/ui/app-card";
import IntegrationHealthCard from "@/components/monitor/IntegrationHealthCard";
import SyncErrorTimeline from "@/components/monitor/SyncErrorTimeline";
import {
  Activity, RefreshCw, AlertTriangle, CheckCircle, XCircle,
  Server, Clock, Zap,
} from "lucide-react";

const REFRESH_INTERVAL = 30_000;

export default function IntegrationMonitor() {
  const qc = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Health check em tempo real (pinga IXC, Evolution, ZapSign, Crédito) ────
  const {
    data: healthResp,
    isLoading: loadingHealth,
    isFetching: fetchingHealth,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ["integration-health-check"],
    queryFn: () => salesPipelineApi({ action: "health_check" }),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10_000,
  });

  const health = healthResp?.data || {};

  // ── Logs de sincronização recentes ──────────────────────────────────────
  const { data: syncLogs = [], isLoading: loadingSync } = useEntityList(
    "IntegrationLog", "-created_date", 100
  );

  // ── Erros recentes do sistema ───────────────────────────────────────────
  const { data: errorLogs = [], isLoading: loadingErrors } = useEntityList(
    "ErrorLog", "-created_date", 50
  );

  // ── Estatísticas derivadas ──────────────────────────────────────────────
  const integrations = React.useMemo(() => {
    const list = [];
    const entries = Object.entries(health);
    for (const [key, val] of entries) {
      list.push({ key, ...val });
    }
    return list;
  }, [health]);

  const onlineCount = integrations.filter((i) => i.status === "ONLINE" || i.status === "CONFIGURED").length;
  const offlineCount = integrations.filter((i) => i.status === "OFFLINE").length;
  const syncFailures = syncLogs.filter((l) => l.status === "falha");
  const recentErrors = errorLogs.slice(0, 20);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchHealth(),
      qc.invalidateQueries({ queryKey: ["IntegrationLog"] }),
      qc.invalidateQueries({ queryKey: ["ErrorLog"] }),
    ]);
    setTimeout(() => setIsRefreshing(false), 500);
  }, [refetchHealth, qc]);

  const lastUpdate = healthResp ? new Date().toLocaleTimeString("pt-BR") : "—";

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold font-heading flex items-center gap-2">
            <Server className="w-6 h-6 text-primary" /> Monitor de Integrações
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Status em tempo real de todas as integrações e sincronizações de dados
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            Atualizado: {lastUpdate}
            <span className="ml-1 inline-flex items-center gap-1 text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Auto-refresh 30s
            </span>
          </span>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing || fetchingHealth}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${(isRefreshing || fetchingHealth) ? "animate-spin" : ""}`} />
            Atualizar agora
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          title="Integrações Online"
          value={onlineCount}
          icon={CheckCircle}
          color="accent"
          subtitle={`de ${integrations.length} totais`}
        />
        <StatCard
          title="Offline / com Falha"
          value={offlineCount}
          icon={XCircle}
          color="danger"
          subtitle={offlineCount === 0 ? "Tudo funcionando" : "Requer atenção"}
        />
        <StatCard
          title="Falhas de Sincronização"
          value={syncFailures.length}
          icon={AlertTriangle}
          color="warning"
          subtitle="últimas 100 operações"
        />
        <StatCard
          title="Erros de Sistema"
          value={errorLogs.length}
          icon={Zap}
          color="purple"
          subtitle="registrados recentemente"
        />
      </div>

      {/* Grid de integrações em tempo real */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="font-semibold font-heading">Status das Integrações</h3>
        </div>

        {loadingHealth ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-36 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : integrations.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <Server className="w-10 h-10 mx-auto mb-2 opacity-40" />
            Nenhuma integração configurada. Verifique as credenciais nas configurações.
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {integrations.map((int) => (
              <IntegrationHealthCard key={int.key} integration={int} />
            ))}
          </div>
        )}
      </div>

      {/* Timeline de erros de sincronização */}
      <SyncErrorTimeline
        syncLogs={syncLogs}
        errorLogs={errorLogs}
        loading={loadingSync || loadingErrors}
      />
    </PageContainer>
  );
}