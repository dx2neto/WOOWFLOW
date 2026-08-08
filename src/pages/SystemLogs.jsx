import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, Card } from "@/components/ui/app-card";
import { AlertTriangle, ChevronDown, ChevronRight, Plug, Search } from "lucide-react";
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
  const [expandedError, setExpandedError] = useState(null);

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
                <th className="text-left px-5 py-3 font-medium w-8"></th>
                <th className="text-left px-5 py-3 font-medium">Data/Hora</th>
                <th className="text-left px-5 py-3 font-medium">Função</th>
                <th className="text-left px-5 py-3 font-medium">Ação</th>
                <th className="text-left px-5 py-3 font-medium">Severidade</th>
                <th className="text-left px-5 py-3 font-medium">Mensagem de Erro</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Carregando...</td></tr>
              ) : errorLogs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground"><AlertTriangle className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />Nenhum erro registrado</td></tr>
              ) : (
                errorLogs.map((log) => {
                  const hasDetails = log.stack_trace || log.error_context;
                  const isOpen = expandedError === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-5 py-3 text-center">
                          {hasDetails && (
                            <button onClick={() => setExpandedError(isOpen ? null : log.id)} className="text-muted-foreground hover:text-foreground">
                              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">{log.created_date ? format(new Date(log.created_date), "dd/MM/yyyy HH:mm") : "—"}</td>
                        <td className="px-5 py-3 font-medium">{log.function_name}</td>
                        <td className="px-5 py-3 text-muted-foreground">{log.action || "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                            log.severity === "critica" ? "bg-red-100 text-red-700"
                            : log.severity === "alta" ? "bg-orange-100 text-orange-700"
                            : log.severity === "media" ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                          }`}>{log.severity}</span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{log.error_message}</td>
                      </tr>
                      {isOpen && hasDetails && (
                        <tr className="bg-muted/10">
                          <td></td>
                          <td colSpan={5} className="px-5 py-3">
                            {log.error_context && (
                              <div className="mb-2">
                                <p className="text-xs font-semibold text-muted-foreground mb-1">Contexto:</p>
                                <pre className="text-xs bg-background border border-border rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all">{log.error_context}</pre>
                              </div>
                            )}
                            {log.stack_trace && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-1">Stack Trace:</p>
                                <pre className="text-xs bg-background border border-border rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all">{log.stack_trace}</pre>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
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