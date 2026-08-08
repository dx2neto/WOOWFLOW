import React, { useState, useMemo } from "react";
import { PageContainer, Card, StatCard } from "@/components/ui/app-card";
import { RefreshCw, History, CheckCircle2, XCircle, AlertTriangle, Copy, Filter, MessageSquare } from "lucide-react";
import SyncLogRow from "@/components/evolutionlogs/SyncLogRow";
import { useEntityFilter } from "@/hooks/useEntityQueries";
import { format } from "date-fns";

const actionLabels = {
  sync_history: "Histórico",
  send_message: "Envio de mensagem",
  get_contacts: "Contatos",
  get_chats: "Conversas",
  list_instances: "Instâncias",
  test_connection: "Teste de conexão",
};

const SYNC_STATUS_TONE = {
  synced: "bg-green-100 text-green-700",
  duplicate: "bg-blue-100 text-blue-700",
  error: "bg-red-100 text-red-700",
  filtered: "bg-slate-100 text-slate-600",
  rate_limited: "bg-orange-100 text-orange-700",
};

const SYNC_STATUS_LABEL = {
  synced: "Sincronizada",
  duplicate: "Duplicada",
  error: "Erro",
  filtered: "Filtrada",
  rate_limited: "Rate limit",
};

export default function EvolutionSyncLogs() {
  const [tab, setTab] = useState("messages");

  // Logs de API (sincronização manual)
  const { data: logs = [], isLoading: loading, refetch } = useEntityFilter("IntegrationLog", { integration: "evolutionApi" }, "-created_date", 300);

  // Logs detalhados por mensagem (webhook)
  const { data: syncLogs = [], isLoading: loadingSync, refetch: refetchSync } = useEntityFilter("MessageSyncLog", {}, "-created_date", 300);

  const [statusFilter, setStatusFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");

  const actions = useMemo(() => ["all", ...new Set(logs.map((l) => l.action))], [logs]);

  const stats = useMemo(() => ({
    total: logs.length,
    success: logs.filter((l) => l.status === "sucesso").length,
    failed: logs.filter((l) => l.status === "falha").length,
  }), [logs]);

  const syncStats = useMemo(() => ({
    total: syncLogs.length,
    synced: syncLogs.filter((l) => l.sync_status === "synced").length,
    duplicates: syncLogs.filter((l) => l.sync_status === "duplicate").length,
    errors: syncLogs.filter((l) => l.sync_status === "error").length,
    filtered: syncLogs.filter((l) => l.sync_status === "filtered").length,
    rateLimited: syncLogs.filter((l) => l.sync_status === "rate_limited").length,
  }), [syncLogs]);

  const filtered = logs.filter(
    (log) => (statusFilter === "all" || log.status === statusFilter) && (actionFilter === "all" || log.action === actionFilter)
  );

  const filteredSyncLogs = useMemo(() => {
    let result = syncLogs;
    if (statusFilter !== "all") result = result.filter((l) => l.sync_status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((l) =>
        (l.phone || "").includes(q) ||
        (l.wa_message_id || "").toLowerCase().includes(q) ||
        (l.error_message || "").toLowerCase().includes(q) ||
        (l.message_preview || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [syncLogs, statusFilter, search]);

  const isLoading = tab === "messages" ? loadingSync : loading;

  return (
    <PageContainer>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold font-heading flex items-center gap-2">
            <History className="w-6 h-6 text-primary" /> Logs de Sincronização WhatsApp
          </h2>
          <p className="text-sm text-muted-foreground">Rastreie cada mensagem sincronizada, identifique falhas e resolva rapidamente.</p>
        </div>
        <button
          onClick={() => tab === "messages" ? refetchSync() : refetch()}
          disabled={isLoading}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5">
        <button
          onClick={() => { setTab("messages"); setStatusFilter("all"); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === "messages" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
        >
          <MessageSquare className="w-3.5 h-3.5 inline mr-1" /> Mensagens
        </button>
        <button
          onClick={() => { setTab("api"); setStatusFilter("all"); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === "api" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
        >
          <History className="w-3.5 h-3.5 inline mr-1" /> API & Sync
        </button>
      </div>

      {/* Stats */}
      {tab === "messages" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <StatCard title="Total" value={syncStats.total} icon={MessageSquare} color="purple" />
          <StatCard title="Sincronizadas" value={syncStats.synced} icon={CheckCircle2} color="accent" />
          <StatCard title="Duplicadas" value={syncStats.duplicates} icon={Copy} color="indigo" />
          <StatCard title="Erros" value={syncStats.errors} icon={XCircle} color="danger" />
          <StatCard title="Filtradas" value={syncStats.filtered} icon={Filter} color="warning" />
          <StatCard title="Rate limit" value={syncStats.rateLimited} icon={AlertTriangle} color="danger" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <StatCard title="Total de tentativas" value={stats.total} icon={History} color="purple" />
          <StatCard title="Sucesso" value={stats.success} icon={CheckCircle2} color="accent" />
          <StatCard title="Falhas" value={stats.failed} icon={XCircle} color="danger" />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {tab === "messages" ? (
          <>
            {[
              ["all", "Todos"],
              ["synced", "Sincronizadas"],
              ["duplicate", "Duplicadas"],
              ["error", "Erros"],
              ["filtered", "Filtradas"],
              ["rate_limited", "Rate limit"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusFilter === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
              >
                {label}
              </button>
            ))}
            <div className="relative flex-1 min-w-[200px] ml-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por telefone, erro ou conteúdo..."
                className="w-full h-8 px-3 bg-muted/60 rounded-lg text-xs focus:outline-none focus:bg-card focus:ring-1 focus:ring-primary"
              />
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Tabela */}
      {tab === "messages" ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium">Data/Hora</th>
                <th className="text-left px-4 py-3 font-medium">Telefone</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Direção</th>
                <th className="text-left px-4 py-3 font-medium">Preview</th>
                <th className="text-left px-4 py-3 font-medium">Erro</th>
                <th className="text-left px-4 py-3 font-medium">Instância</th>
              </tr>
            </thead>
            <tbody>
              {loadingSync ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Carregando...</td></tr>
              ) : filteredSyncLogs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground"><MessageSquare className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />Nenhuma mensagem registrada</td></tr>
              ) : (
                filteredSyncLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                      {log.created_date ? format(new Date(log.created_date), "dd/MM HH:mm:ss") : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-xs">{log.phone || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${SYNC_STATUS_TONE[log.sync_status] || SYNC_STATUS_TONE.filtered}`}>
                        {SYNC_STATUS_LABEL[log.sync_status] || log.sync_status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{log.direction || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-[200px] truncate">{log.message_preview || "—"}</td>
                    <td className="px-4 py-2.5 text-red-600 text-xs max-w-[250px] truncate">{log.error_message || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{log.instance || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      ) : (
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
      )}
    </PageContainer>
  );
}