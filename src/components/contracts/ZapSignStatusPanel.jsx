import React, { useEffect, useState } from "react";
import { zapsignApi } from "@/functions/zapsignApi";
import { Card } from "@/components/ui/app-card";
import { useToast } from "@/components/ui/use-toast";
import {
  FileSignature, CheckCircle, Clock, XCircle, AlertTriangle,
  ExternalLink, RefreshCw, Loader2,
} from "lucide-react";

const STATUS_CFG = {
  pendente:  { label: "Pendente",  color: "bg-amber-100 text-amber-700",  dot: "bg-amber-500",  Icon: Clock },
  assinado:  { label: "Assinado",  color: "bg-green-100 text-green-700",  dot: "bg-green-500",  Icon: CheckCircle },
  expirado:  { label: "Expirado",  color: "bg-red-100 text-red-700",      dot: "bg-red-500",    Icon: XCircle },
  cancelado: { label: "Cancelado", color: "bg-gray-100 text-gray-600",    dot: "bg-gray-400",  Icon: XCircle },
  erro:      { label: "Erro",      color: "bg-red-100 text-red-700",      dot: "bg-red-500",    Icon: AlertTriangle },
};

export default function ZapSignStatusPanel() {
  const { toast } = useToast();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await zapsignApi({ action: "list_docs", limit: 50 });
      if (res?.data?.success) setDocs(res.data.data || []);
      else setDocs([]);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await zapsignApi({ action: "sync_status" });
      if (res?.data?.success) {
        toast({ title: `${res.data.data.updated} documento(s) atualizado(s)` });
        await load();
      } else {
        toast({ title: res?.data?.error?.message || "Falha na sincronização", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro na sincronização", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const pending = docs.filter((d) => d.status === "pendente").length;
  const signed  = docs.filter((d) => d.status === "assinado").length;
  const expired = docs.filter((d) => d.status === "expirado").length;

  const recent = [...docs]
    .sort((a, b) => new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime())
    .slice(0, 6);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-fuchsia-600 flex items-center justify-center">
            <FileSignature className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold font-heading text-sm">Assinaturas ZapSign</h3>
            <p className="text-xs text-muted-foreground">Status dos contratos enviados</p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="text-center p-2 rounded-lg bg-muted/50">
          <p className="text-xl font-bold">{docs.length}</p>
          <p className="text-[10px] uppercase text-muted-foreground font-semibold">Total</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-amber-50">
          <p className="text-xl font-bold text-amber-700">{pending}</p>
          <p className="text-[10px] uppercase text-amber-700 font-semibold">Pendentes</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-green-50">
          <p className="text-xl font-bold text-green-700">{signed}</p>
          <p className="text-[10px] uppercase text-green-700 font-semibold">Assinados</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-red-50">
          <p className="text-xl font-bold text-red-700">{expired}</p>
          <p className="text-[10px] uppercase text-red-700 font-semibold">Expirados</p>
        </div>
      </div>

      {loading ? (
        <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
      ) : recent.length === 0 ? (
        <p className="text-center py-6 text-sm text-muted-foreground">Nenhum documento enviado ainda</p>
      ) : (
        <div className="space-y-1.5">
          {recent.map((doc) => {
            const cfg = STATUS_CFG[doc.status] || STATUS_CFG.pendente;
            const Icon = cfg.Icon;
            return (
              <div key={doc.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.customer_name || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {doc.template_name || doc.document_type || "Documento"}
                    {doc.created_date && ` · ${new Date(doc.created_date).toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${cfg.color}`}>
                  <Icon className="w-3 h-3" /> {cfg.label}
                </span>
                {doc.sign_url && (
                  <a href={doc.sign_url} target="_blank" rel="noopener noreferrer"
                    className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10" title="Abrir link">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}