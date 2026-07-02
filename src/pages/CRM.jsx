import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, Card } from "@/components/ui/Card";
import { ChannelBadge } from "@/components/Badges";
import { Plus, Phone, Mail, MapPin, Calendar, DollarSign, MessageSquare } from "lucide-react";

const stages = [
  { key: "novo_lead", label: "Novo Lead", color: "border-t-blue-500" },
  { key: "primeiro_contato", label: "Primeiro Contato", color: "border-t-indigo-500" },
  { key: "qualificacao", label: "Qualificação", color: "border-t-purple-500" },
  { key: "proposta_enviada", label: "Proposta Enviada", color: "border-t-amber-500" },
  { key: "aguardando_retorno", label: "Aguardando Retorno", color: "border-t-orange-500" },
  { key: "agendamento", label: "Agendamento", color: "border-t-teal-500" },
  { key: "venda_fechada", label: "Venda Fechada", color: "border-t-green-500" },
  { key: "venda_perdida", label: "Venda Perdida", color: "border-t-red-500" },
];

export default function CRM() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState(null);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      const data = await base44.entities.Lead.list("-created_date", 200);
      setLeads(data);
    } catch (e) {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (stage) => {
    if (!draggedId) return;
    const lead = leads.find((l) => l.id === draggedId);
    if (lead && lead.stage !== stage) {
      setLeads(leads.map((l) => l.id === draggedId ? { ...l, stage } : l));
      try {
        await base44.entities.Lead.update(draggedId, { stage });
      } catch (e) {}
    }
    setDraggedId(null);
  };

  const totalValue = leads.filter(l => l.stage !== "venda_perdida").reduce((sum, l) => sum + (l.estimated_value || 0), 0);
  const wonLeads = leads.filter((l) => l.stage === "venda_fechada").length;

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Funil de Vendas</h2>
          <p className="text-sm text-muted-foreground">{leads.length} oportunidades · R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em negociação · {wonLeads} vendas fechadas</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Novo Lead
        </button>
      </div>

      <div className="overflow-x-auto scrollbar-thin pb-4">
        <div className="flex gap-4 min-w-max">
          {stages.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage.key);
            const stageValue = stageLeads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);
            return (
              <div
                key={stage.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(stage.key)}
                className={`w-72 flex-shrink-0 bg-card rounded-xl border border-border border-t-4 ${stage.color} flex flex-col`}
              >
                <div className="p-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{stage.label}</p>
                    <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded-full">{stageLeads.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">R$ {stageValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </div>

                <div className="p-2 space-y-2 min-h-[200px] flex-1 overflow-y-auto scrollbar-thin">
                  {stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => setDraggedId(lead.id)}
                      className="bg-background border border-border rounded-lg p-3 cursor-grab hover:shadow-md transition-shadow active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-sm leading-tight">{lead.name}</p>
                        <ChannelBadge channel={lead.origin} />
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {lead.phone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {lead.phone}</p>}
                        {lead.city && <p className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {lead.city}</p>}
                        {lead.plan_interest && <p className="flex items-center gap-1.5"><DollarSign className="w-3 h-3" /> {lead.plan_interest}</p>}
                      </div>
                      {lead.estimated_value > 0 && (
                        <p className="text-sm font-bold text-primary mt-2">R$ {lead.estimated_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      )}
                      {lead.vendor && (
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-bold">
                            {lead.vendor.charAt(0)}
                          </div>
                          <span className="text-xs text-muted-foreground">{lead.vendor}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">Arraste leads para cá</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
}