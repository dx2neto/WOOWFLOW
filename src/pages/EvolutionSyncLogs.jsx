import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, Card, StatCard } from "@/components/ui/app-card";
import { RefreshCw, History, CheckCircle2, XCircle } from "lucide-react";
import SyncLogRow from "@/components/evolutionlogs/SyncLogRow";

const actionLabels = {
  sync_history: "Histórico",
  send_message: "Envio de mensagem",
  get_contacts: "Contatos",
  get_chats: "Conversas",
  list_instances: "Instâncias",
  test_connection: "Teste de conexão",
};

export default function EvolutionSyncLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const loadLogs = async () => {
    setLoading(true);
    const data = await base44.entities.IntegrationLog.filter(
      { integration: "evolutionApi" },
      "-created_date",
      300
    );
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const actions = useMemo(() => ["all", ...new Set(logs.map((l) => l.action))], [logs]);

  const stats = useMemo(() => ({
    total: logs.length,
    success: logs.filter((l) => l.status === "sucesso").length,
    failed: logs.filter((l) => l.status === "falha").length,
  }), [logs]);

  const filtered = logs.filter(
    (log) => (statusFilter === "all" || log.status === statusFilter) && (actionFilter === "all" || log.action === actionFilter)
  );

  return (
    <PageContainer>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold font-heading flex items-center gap-2">
            <History className="w-6 h-6 text-primary" /> Logs de Integração WhatsApp
          </h2>
          <p className="text-sm text-muted-foreground">Acompanhe o status de cada tentativa de sincronização e identifique rapidamente mensagens ou contatos com falha.</p>
        </div>
        <button
          onClick={loadLogs}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <StatCard title="Total de tentativas" value={stats.total} icon={History} color="purple" />
        <StatCard title="Sucesso" value={stats.success} icon={CheckCircle2} color="accent" />
        <StatCard title="Falhas" value={stats.failed} icon={XCircle} color="danger" />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {[
          ["all", "Todas"],
          ["sucesso", "Sucesso"],
          ["falha", "Falha"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusFilter === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
          >
            {label}
          </button>
        ))}
        <span className="w-px bg-border mx-1" />
        {actions.map((key) => (
          <button
            key={key}
            onClick={() => setActionFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${actionFilter === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
          >
            {key === "all" ? "Todas as ações" : actionLabels[key] || key}
          </button>
        ))}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-5 py-3 font-medium">Data/Hora</th>
              <th className="text-left px-5 py-3 font-medium">Ação</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Telefone</th>
              <th className="text-left px-5 py-3 font-medium">Instância</th>
              <th className="text-left px-5 py-3 font-medium">Resumo</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground"><History className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />Nenhuma tentativa registrada</td></tr>
            ) : (
              filtered.map((log) => (
                <SyncLogRow
                  key={log.id}
                  log={log}
                  expanded={expandedId === log.id}
                  onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
}