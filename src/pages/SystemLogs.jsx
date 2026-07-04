import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, Card } from "@/components/ui/Card";
import { AlertTriangle, Plug, Search } from "lucide-react";
import { format } from "date-fns";

const integrationFilters = [
  { key: "all", label: "Todas" },
  { key: "ixcApi", label: "IXC" },
  { key: "zapsignApi", label: "ZapSign" },
  { key: "evolutionApi", label: "Evolution" },
];

export default function SystemLogs() {
  const [tab, setTab] = useState("errors");
  const [errorLogs, setErrorLogs] = useState([]);
  const [integrationLogs, setIntegrationLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [integrationFilter, setIntegrationFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [errs, ints] = await Promise.all([
        base44.entities.ErrorLog.list("-created_date", 200),
        base44.entities.IntegrationLog.list("-created_date", 200),
      ]);
      setErrorLogs(errs);
      setIntegrationLogs(ints);
      setLoading(false);
    })();
  }, []);

  const filteredIntegrationLogs = integrationLogs
    .filter((log) => integrationFilter === "all" || log.integration === integrationFilter)
    .filter((log) =>
      !search ||
      log.action?.toLowerCase().includes(search.toLowerCase()) ||
      log.details?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <PageContainer>
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-heading">Logs do Sistema</h2>
        <p className="text-sm text-muted-foreground">Histórico de erros e chamadas de integração das automações</p>
      </div>

      <div className="flex gap-1.5 mb-4">
        <button onClick={() => setTab("errors")} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === "errors" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
          Erros
        </button>
        <button onClick={() => setTab("integrations")} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === "integrations" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
          Integrações
        </button>
      </div>

      {tab === "errors" ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 font-medium">Data/Hora</th>
                <th className="text-left px-5 py-3 font-medium">Função</th>
                <th className="text-left px-5 py-3 font-medium">Severidade</th>
                <th className="text-left px-5 py-3 font-medium">Mensagem de Erro</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">Carregando...</td></tr>
              ) : errorLogs.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-muted-foreground"><AlertTriangle className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />Nenhum erro registrado</td></tr>
              ) : (
                errorLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">{log.created_date ? format(new Date(log.created_date), "dd/MM/yyyy HH:mm") : "—"}</td>
                    <td className="px-5 py-3 font-medium">{log.function_name}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-700">{log.severity}</span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{log.error_message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
            <div className="flex gap-1.5">
              {integrationFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setIntegrationFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${integrationFilter === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por ação ou detalhes..."
                className="w-full h-9 pl-9 pr-3 bg-muted/60 rounded-lg text-sm focus:outline-none focus:bg-card focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 font-medium">Data/Hora</th>
                <th className="text-left px-5 py-3 font-medium">Integração</th>
                <th className="text-left px-5 py-3 font-medium">Ação</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-left px-5 py-3 font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Carregando...</td></tr>
              ) : filteredIntegrationLogs.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground"><Plug className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />Nenhum log de integração encontrado</td></tr>
              ) : (
                filteredIntegrationLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">{log.created_date ? format(new Date(log.created_date), "dd/MM/yyyy HH:mm") : "—"}</td>
                    <td className="px-5 py-3 font-medium">{log.integration}</td>
                    <td className="px-5 py-3 text-muted-foreground">{log.action || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${log.status === "sucesso" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{log.details || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}
    </PageContainer>
  );
}