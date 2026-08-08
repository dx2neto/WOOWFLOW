import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useEntityList } from "@/hooks/useEntityQueries";
import { Card } from "@/components/ui/app-card";
import { format, isPast, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search, Phone, MapPin, DollarSign, Clock, AlertTriangle,
  CheckCircle, MessageCircle, RefreshCw, User,
} from "lucide-react";

const stageLabels = {
  novo_lead: "Novo Lead",
  primeiro_contato: "Primeiro Contato",
  qualificacao: "Qualificação",
  proposta_enviada: "Proposta Enviada",
  aguardando_retorno: "Aguardando Retorno",
  agendamento: "Agendamento",
  preparar_contrato: "Preparar Contrato",
  venda_fechada: "Venda Fechada",
  venda_perdida: "Venda Perdida",
};

const stageColors = {
  novo_lead: "bg-blue-100 text-blue-700",
  primeiro_contato: "bg-indigo-100 text-indigo-700",
  qualificacao: "bg-purple-100 text-purple-700",
  proposta_enviada: "bg-amber-100 text-amber-700",
  aguardando_retorno: "bg-orange-100 text-orange-700",
  agendamento: "bg-teal-100 text-teal-700",
  preparar_contrato: "bg-violet-100 text-violet-700",
  venda_fechada: "bg-green-100 text-green-700",
  venda_perdida: "bg-red-100 text-red-700",
};

function slaStatus(nextContact) {
  if (!nextContact) return { label: "Sem prazo", tone: "text-muted-foreground", icon: Clock };
  const date = parseISO(nextContact);
  if (isPast(date) && !isToday(date)) return { label: "Atrasado", tone: "text-red-600", icon: AlertTriangle };
  if (isToday(date)) return { label: "Hoje", tone: "text-amber-600", icon: Clock };
  return { label: format(date, "dd/MM", { locale: ptBR }), tone: "text-green-600", icon: CheckCircle };
}

export default function ContactsTab({ user }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: allLeads = [], isLoading: loading, refetch } = useEntityList("Lead", "-created_date", 200);
  const [search, setSearch] = useState("");

  // Realtime: invalida cache quando leads mudam
  useEffect(() => {
    const unsub = base44.entities.Lead.subscribe(() => {
      qc.invalidateQueries({ queryKey: ["Lead"] });
    });
    return unsub;
  }, [qc]);

  // Filtra leads do vendedor atual (ou todos se admin)
  const leads = user?.role === "admin"
    ? allLeads
    : allLeads.filter((l) => l.vendor === user?.full_name || !l.vendor);

  const activeLeads = leads.filter((l) => l.stage !== "venda_fechada" && l.stage !== "venda_perdida");
  const filtered = activeLeads.filter((l) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [l.name, l.phone, l.city, l.plan_interest].filter(Boolean).some((v) => v.toLowerCase().includes(term));
  });

  const overdue = activeLeads.filter((l) => l.next_contact && isPast(parseISO(l.next_contact)) && !isToday(parseISO(l.next_contact))).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Contatos ativos</p>
          <p className="mt-1 text-2xl font-black">{activeLeads.length}</p>
        </Card>
        <Card className="p-4 border-red-200">
          <p className="text-xs font-semibold uppercase text-red-700">SLA atrasado</p>
          <p className="mt-1 text-2xl font-black text-red-700">{overdue}</p>
        </Card>
        <Card className="p-4 border-green-200">
          <p className="text-xs font-semibold uppercase text-green-700">Valor pipeline</p>
          <p className="mt-1 text-2xl font-black text-green-700">
            R$ {activeLeads.reduce((s, l) => s + (l.estimated_value || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Vendedor</p>
          <p className="mt-1 text-sm font-bold truncate">{user?.full_name || "—"}</p>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone, cidade..."
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button onClick={() => refetch()} className="rounded-lg border border-border p-2 hover:bg-muted" title="Recarregar">
          <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" /> Carregando contatos...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <User className="mx-auto mb-3 h-10 w-10 opacity-30" />
          Nenhum contato encontrado
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((lead) => {
            const sla = slaStatus(lead.next_contact);
            const SlaIcon = sla.icon;
            return (
              <Card key={lead.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-bold text-white flex-shrink-0">
                    {lead.name?.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm truncate">{lead.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${stageColors[lead.stage] || "bg-muted text-muted-foreground"}`}>
                        {stageLabels[lead.stage] || lead.stage}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.phone}</span>}
                      {lead.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {lead.city}</span>}
                      {lead.plan_interest && <span>{lead.plan_interest}</span>}
                      {lead.estimated_value > 0 && <span className="flex items-center gap-1 font-semibold text-green-600"><DollarSign className="h-3 w-3" /> R$ {lead.estimated_value.toLocaleString("pt-BR")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold ${sla.tone}`}>
                        <SlaIcon className="h-3.5 w-3.5" /> {sla.label}
                      </span>
                      {lead.next_contact && (
                        <p className="text-[11px] text-muted-foreground">Próx: {format(parseISO(lead.next_contact), "dd/MM/yyyy", { locale: ptBR })}</p>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(`/inbox?conversation=${lead.phone}`)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Responder
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}