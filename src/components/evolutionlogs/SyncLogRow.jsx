import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

function parseDetails(details) {
  try {
    return JSON.parse(details);
  } catch {
    return null;
  }
}

export default function SyncLogRow({ log, expanded, onToggle }) {
  const parsed = parseDetails(log.details);
  const summary = parsed
    ? log.status === "sucesso"
      ? `${parsed.created ?? 0} mensagem(s) criada(s) de ${parsed.found ?? 0} encontrada(s)`
      : `${parsed.attempts?.length ?? 0} endpoint(s) falharam`
    : log.details || "—";

  return (
    <>
      <tr className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer" onClick={onToggle}>
        <td className="px-5 py-3 text-muted-foreground whitespace-nowrap" style={{ minWidth: "9rem" }}>
          {log.created_date ? format(new Date(log.created_date), "dd/MM/yyyy HH:mm:ss") : "—"}
        </td>
        <td className="px-5 py-3 text-muted-foreground">{log.action || "—"}</td>
        <td className="px-5 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${log.status === "sucesso" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {log.status}
          </span>
        </td>
        <td className="px-5 py-3 font-medium">{parsed?.phone || "—"}</td>
        <td className="px-5 py-3 text-muted-foreground">{parsed?.instance || "—"}</td>
        <td className="px-5 py-3 text-muted-foreground">{summary}</td>
        <td className="px-5 py-3 text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border bg-muted/10">
          <td colSpan={6} className="px-5 py-4">
            {parsed?.attempts?.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-muted-foreground">Tentativas de endpoint</p>
                {parsed.attempts.map((attempt, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-background p-3 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono font-semibold">{attempt.endpoint}</span>
                      <span className={`px-2 py-0.5 rounded-md font-medium ${attempt.status >= 200 && attempt.status < 300 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        HTTP {attempt.status || "sem resposta"}
                      </span>
                    </div>
                    {attempt.error && (
                      <pre className="whitespace-pre-wrap break-all text-muted-foreground bg-muted/40 rounded p-2 mt-1">
                        {typeof attempt.error === "string" ? attempt.error : JSON.stringify(attempt.error, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <pre className="whitespace-pre-wrap break-all text-xs text-muted-foreground bg-muted/40 rounded p-3">
                {log.details || "Sem detalhes adicionais"}
              </pre>
            )}
          </td>
        </tr>
      )}
    </>
  );
}