import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, StatCard, Card } from "@/components/ui/app-card";
import { FileSignature, CheckCircle, Clock, XCircle, Send, Plus } from "lucide-react";

const docTypeConfig = {
  contrato: { label: "Contrato", color: "bg-blue-100 text-blue-700" },
  termo_adesao: { label: "Termo de Adesão", color: "bg-purple-100 text-purple-700" },
  termo_comodato: { label: "Termo de Comodato", color: "bg-amber-100 text-amber-700" },
  termo_permanencia: { label: "Termo de Permanência", color: "bg-indigo-100 text-indigo-700" },
  aceite_eletronico: { label: "Aceite Eletrônico", color: "bg-teal-100 text-teal-700" },
};

const statusConfig = {
  pendente: { label: "Pendente", color: "bg-amber-100 text-amber-700", icon: Clock },
  assinado: { label: "Assinado", color: "bg-green-100 text-green-700", icon: CheckCircle },
  expirado: { label: "Expirado", color: "bg-red-100 text-red-700", icon: XCircle },
  cancelado: { label: "Cancelado", color: "bg-gray-100 text-gray-700", icon: XCircle },
};

export default function Signatures() {
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSignatures(); }, []);

  const loadSignatures = async () => {
    try {
      const data = await base44.entities.SignatureRequest.list("-created_date", 50);
      setSignatures(data);
    } catch { setSignatures([]); } finally { setLoading(false); }
  };

  const pending = signatures.filter((s) => s.status === "pendente").length;
  const signed = signatures.filter((s) => s.status === "assinado").length;
  const expired = signatures.filter((s) => s.status === "expirado").length;

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Assinatura Eletrônica</h2>
          <p className="text-sm text-muted-foreground">Contratos, termos e aceites via ZapSign</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Enviar Documento
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Pendentes" value={pending} icon={Clock} color="warning" />
        <StatCard title="Assinados" value={signed} icon={CheckCircle} color="accent" />
        <StatCard title="Expirados" value={expired} icon={XCircle} color="danger" />
        <StatCard title="Total" value={signatures.length} icon={FileSignature} color="primary" />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-semibold px-4 py-3">Cliente</th>
                <th className="text-left font-semibold px-4 py-3">Tipo</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-left font-semibold px-4 py-3">Data Envio</th>
                <th className="text-left font-semibold px-4 py-3">Data Assinatura</th>
                <th className="text-left font-semibold px-4 py-3">Provedor</th>
                <th className="text-right font-semibold px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
              ) : signatures.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma assinatura encontrada</td></tr>
              ) : (
                signatures.map((s) => {
                  const StatusIcon = statusConfig[s.status]?.icon || Clock;
                  return (
                    <tr key={s.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium">{s.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{s.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${docTypeConfig[s.document_type]?.color || docTypeConfig.contrato.color}`}>
                          {docTypeConfig[s.document_type]?.label || s.document_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${statusConfig[s.status]?.color || statusConfig.pendente.color}`}>
                          <StatusIcon className="w-3 h-3" /> {statusConfig[s.status]?.label || s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.created_date ? new Date(s.created_date).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.signed_date ? new Date(s.signed_date).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="px-4 py-3">{s.provider || "ZapSign"}</td>
                      <td className="px-4 py-3 text-right">
                        <button className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20">
                          <Send className="w-3.5 h-3.5" /> Reenviar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}