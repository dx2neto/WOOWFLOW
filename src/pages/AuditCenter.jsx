import React, { useMemo, useState } from "react";
import { useEntityList } from "@/hooks/useEntityQueries";
import { PageContainer, StatCard } from "@/components/ui/app-card";
import AlertFeed from "@/components/audit/AlertFeed";
import { ShieldCheck, AlertTriangle, Plug, Activity, RefreshCw, ListChecks } from "lucide-react";

const SEVERITY_ORDER = { critica: 0, alta: 1, media: 2, baixa: 3 };

export default function AuditCenter() {
  const [filter, setFilter] = useState("all");

  const { data: errorLogs = [], isLoading: loadingErrors } = useEntityList("ErrorLog", "-created_date", 200);
  const { data: integrationLogs = [], isLoading: loadingIntLogs } = useEntityList("IntegrationLog", "-created_date", 200);
  const { data: auditLogs = [], isLoading: loadingAudit } = useEntityList("AuditLog", "-created_date", 200);
  const { data: configs = [], isLoading: loadingConfigs } = useEntityList("IntegrationConfig", "-updated_at", 200);

  // ── Feed unificado de alertas ─────────────────────────────────────────────
  const alerts = useMemo(() => {
    const items = [];

    // Erros do sistema
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

    // Falhas de integração
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

    // Integrações com erro de configuração
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

    // Ações sensíveis do AuditLog
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
    { key: "all",           label: "Todos",            count: alerts.length },
    { key: "critica",       label: "Críticos",         count: stats.critical },
    { key: "alta",          label: "Alta Prioridade",  count: stats.high },
    { key: "error",         label: "Erros",            count: alerts.filter((a) => a.type === "error").length },
    { key: "integration",   label: "Integrações",      count: alerts.filter((a) => a.type === "integration" || a.type === "config").length },
    { key: "audit",         label: "Auditoria",        count: alerts.filter((a) => a.type === "audit").length },
  ];

  return (
    <PageContainer>
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-heading flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" /> Central de Alertas
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Todos os alertas e erros do sistema em um único painel, ordenados por criticidade
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Total de Alertas" value={stats.total} icon={ListChecks} color="primary" subtitle={`${stats.recent} nas últimas 24h`} />
        <StatCard title="Críticos" value={stats.critical} icon={AlertTriangle} color="danger" />
        <StatCard title="Alta Prioridade" value={stats.high} icon={Activity} color="warning" />
        <StatCard title="Problemas de Integração" value={stats.integrationIssues} icon={Plug} color="purple" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
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

      {/* Alert Feed */}
      <AlertFeed alerts={filtered} loading={loading} />
    </PageContainer>
  );
}