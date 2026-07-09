import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, Card } from "@/components/ui/app-card";
import { RefreshCw, History, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import SyncLogRow from "@/components/evolutionlogs/SyncLogRow";

export default function EvolutionSyncLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const loadLogs = async () => {
    setLoading(true);
    const data = await base44.entities.IntegrationLog.filter(
      { integration: "evolutionApi", action: "sync_history" },
      "-created_date",
      200
    );
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = logs.filter((log) => statusFilter === "all" || log.status === statusFilter);

  return (
    <PageContainer>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold font-heading flex items-center gap-2">
            <History className="w-6 h-6 text-primary" /> Logs de Sincronização de Histórico
          </h2>
          <p className="text-sm text-muted-foreground">Veja exatamente por que a importação do histórico de mensagens do WhatsApp falhou ou teve sucesso em cada tentativa.</p>
        </div>
        <button
          onClick={loadLogs}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      <div className="flex gap-1.5 mb-4">
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
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-5 py-3 font-medium">Data/Hora</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Telefone</th>
              <th className="text-left px-5 py-3 font-medium">Instância</th>
              <th className="text-left px-5 py-3 font-medium">Resumo</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground"><History className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />Nenhuma tentativa de sincronização registrada</td></tr>
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