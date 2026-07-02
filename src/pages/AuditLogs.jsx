import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, Card } from "@/components/ui/Card";
import { ScrollText, Search } from "lucide-react";
import { format } from "date-fns";

const actionClasses = {
  create: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  login: "bg-purple-100 text-purple-700",
  export: "bg-amber-100 text-amber-700",
  send: "bg-indigo-100 text-indigo-700",
};

const actionLabels = { create: "Criação", update: "Atualização", delete: "Exclusão", login: "Login", export: "Exportação", send: "Envio" };

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const data = await base44.entities.AuditLog.list("-created_date", 200);
      setLogs(data);
      setLoading(false);
    })();
  }, []);

  const filtered = logs.filter((l) => {
    const matchesSearch = !search || l.user_name?.toLowerCase().includes(search.toLowerCase()) || l.module?.toLowerCase().includes(search.toLowerCase()) || l.description?.toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === "all" || l.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  return (
    <PageContainer>
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-heading">Logs de Auditoria</h2>
        <p className="text-sm text-muted-foreground">Histórico de ações realizadas pelos usuários no sistema</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por usuário, módulo ou descrição..."
            className="w-full h-10 pl-10 pr-4 bg-muted/60 rounded-lg text-sm border border-transparent focus:border-primary focus:bg-card focus:outline-none"
          />
        </div>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="h-10 px-3 bg-muted/60 rounded-lg text-sm border border-transparent focus:border-primary focus:bg-card focus:outline-none">
          <option value="all">Todas as ações</option>
          {Object.entries(actionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-5 py-3 font-medium">Data/Hora</th>
              <th className="text-left px-5 py-3 font-medium">Usuário</th>
              <th className="text-left px-5 py-3 font-medium">Ação</th>
              <th className="text-left px-5 py-3 font-medium">Módulo</th>
              <th className="text-left px-5 py-3 font-medium">Descrição</th>
              <th className="text-left px-5 py-3 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Carregando logs...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  <ScrollText className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
                  Nenhum log encontrado
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">{log.created_date ? format(new Date(log.created_date), "dd/MM/yyyy HH:mm") : "—"}</td>
                  <td className="px-5 py-3 font-medium">{log.user_name}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${actionClasses[log.action] || actionClasses.update}`}>
                      {actionLabels[log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{log.module}</td>
                  <td className="px-5 py-3 text-muted-foreground">{log.description || "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{log.ip_address || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
}