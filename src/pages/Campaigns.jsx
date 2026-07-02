import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, StatCard, Card } from "@/components/ui/Card";
import { Plus, Send, CheckCircle, Eye, MessageSquare, Calendar, Users } from "lucide-react";

const typeConfig = {
  cobranca: { label: "Cobrança", color: "bg-red-100 text-red-700" },
  promocao: { label: "Promoção", color: "bg-green-100 text-green-700" },
  manutencao: { label: "Manutenção", color: "bg-amber-100 text-amber-700" },
  instabilidade: { label: "Instabilidade", color: "bg-orange-100 text-orange-700" },
  pesquisa: { label: "Pesquisa", color: "bg-blue-100 text-blue-700" },
  pos_venda: { label: "Pós-venda", color: "bg-purple-100 text-purple-700" },
  retencao: { label: "Retenção", color: "bg-indigo-100 text-indigo-700" },
  upgrade: { label: "Upgrade", color: "bg-teal-100 text-teal-700" },
  aniversario: { label: "Aniversário", color: "bg-pink-100 text-pink-700" },
  renovacao: { label: "Renovação", color: "bg-sky-100 text-sky-700" },
};

const statusConfig = {
  rascunho: { label: "Rascunho", color: "bg-gray-100 text-gray-700" },
  agendada: { label: "Agendada", color: "bg-blue-100 text-blue-700" },
  enviando: { label: "Enviando", color: "bg-amber-100 text-amber-700" },
  concluida: { label: "Concluída", color: "bg-green-100 text-green-700" },
  cancelada: { label: "Cancelada", color: "bg-red-100 text-red-700" },
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCampaigns(); }, []);

  const loadCampaigns = async () => {
    try {
      const data = await base44.entities.Campaign.list("-created_date", 50);
      setCampaigns(data);
    } catch (e) { setCampaigns([]); } finally { setLoading(false); }
  };

  const totalSent = campaigns.reduce((s, c) => s + (c.total_sent || 0), 0);
  const totalDelivered = campaigns.reduce((s, c) => s + (c.total_delivered || 0), 0);
  const totalRead = campaigns.reduce((s, c) => s + (c.total_read || 0), 0);
  const totalReplied = campaigns.reduce((s, c) => s + (c.total_replied || 0), 0);

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Campanhas WhatsApp</h2>
          <p className="text-sm text-muted-foreground">Disparos em massa e comunicação com clientes</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Nova Campanha
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Enviado" value={totalSent} icon={Send} color="primary" />
        <StatCard title="Entregues" value={totalDelivered} icon={CheckCircle} color="accent" />
        <StatCard title="Lidos" value={totalRead} icon={Eye} color="indigo" />
        <StatCard title="Respondidos" value={totalReplied} icon={MessageSquare} color="purple" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">Carregando campanhas...</div>
        ) : campaigns.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">Nenhuma campanha encontrada</div>
        ) : (
          campaigns.map((c) => (
            <Card key={c.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${typeConfig[c.type]?.color || typeConfig.promocao.color}`}>
                    {typeConfig[c.type]?.label || c.type}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusConfig[c.status]?.color || statusConfig.rascunho.color}`}>
                    {statusConfig[c.status]?.label || c.status}
                  </span>
                </div>
              </div>
              <h3 className="font-semibold mb-2">{c.name}</h3>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{c.message_template || "Sem template definido"}</p>
              {c.segment && <p className="text-xs text-muted-foreground mb-3">📋 Segmento: {c.segment}</p>}

              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="text-center p-2 bg-muted/40 rounded-lg">
                  <p className="text-sm font-bold">{c.total_sent || 0}</p>
                  <p className="text-xs text-muted-foreground">Enviado</p>
                </div>
                <div className="text-center p-2 bg-muted/40 rounded-lg">
                  <p className="text-sm font-bold">{c.total_delivered || 0}</p>
                  <p className="text-xs text-muted-foreground">Entregue</p>
                </div>
                <div className="text-center p-2 bg-muted/40 rounded-lg">
                  <p className="text-sm font-bold">{c.total_read || 0}</p>
                  <p className="text-xs text-muted-foreground">Lido</p>
                </div>
                <div className="text-center p-2 bg-muted/40 rounded-lg">
                  <p className="text-sm font-bold">{c.total_replied || 0}</p>
                  <p className="text-xs text-muted-foreground">Resp.</p>
                </div>
              </div>

              {c.scheduled_date && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {new Date(c.scheduled_date).toLocaleString("pt-BR")}
                </p>
              )}
            </Card>
          ))
        )}
      </div>
    </PageContainer>
  );
}