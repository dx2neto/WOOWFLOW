import React, { useState } from "react";
import { PageContainer, Card } from "@/components/ui/Card";
import { Bot, MessageSquare, Phone, Clock, Calendar, Zap, Plus, Play, Settings, Brain } from "lucide-react";
import FlowFormModal from "@/components/chatbot/FlowFormModal";

const intents = [
  { label: "Segunda via de boleto", icon: "📄", color: "bg-orange-50 text-orange-700" },
  { label: "Pagar com PIX", icon: "⚡", color: "bg-green-50 text-green-700" },
  { label: "Internet lenta", icon: "🐌", color: "bg-amber-50 text-amber-700" },
  { label: "Internet sem funcionar", icon: "❌", color: "bg-red-50 text-red-700" },
  { label: "Desbloqueio de confiança", icon: "🔓", color: "bg-blue-50 text-blue-700" },
  { label: "Mudança de plano", icon: "🔄", color: "bg-purple-50 text-purple-700" },
  { label: "Novo plano", icon: "🆕", color: "bg-teal-50 text-teal-700" },
  { label: "Cancelamento", icon: "👋", color: "bg-rose-50 text-rose-700" },
  { label: "Suporte técnico", icon: "🔧", color: "bg-indigo-50 text-indigo-700" },
  { label: "Agendamento de visita", icon: "📅", color: "bg-sky-50 text-sky-700" },
  { label: "Reclamação", icon: "😤", color: "bg-red-50 text-red-700" },
  { label: "Falar com atendente", icon: "👤", color: "bg-gray-50 text-gray-700" },
];

const initialFlows = [
  { id: 1, name: "Menu Principal WhatsApp", channel: "WhatsApp", status: "ativo", steps: 8 },
  { id: 2, name: "Cobrança Automática PIX", channel: "WhatsApp", status: "ativo", steps: 5 },
  { id: 3, name: "Boas-vindas Novo Cliente", channel: "WhatsApp", status: "ativo", steps: 3 },
  { id: 4, name: "Pesquisa de Satisfação", channel: "WhatsApp", status: "ativo", steps: 4 },
  { id: 5, name: "Fora do Horário", channel: "WhatsApp", status: "ativo", steps: 2 },
  { id: 6, name: "Menu Instagram", channel: "Instagram", status: "rascunho", steps: 6 },
];

export default function Chatbot() {
  const [tab, setTab] = useState("flows");
  const [flows, setFlows] = useState(initialFlows);
  const [showModal, setShowModal] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);

  const handleSaveFlow = (data) => {
    if (editingFlow) {
      setFlows(flows.map((f) => (f.id === editingFlow.id ? { ...f, ...data } : f)));
    } else {
      setFlows([...flows, { id: Date.now(), status: "rascunho", ...data }]);
    }
  };

  const toggleFlowStatus = (id) => {
    setFlows(flows.map((f) => (f.id === id ? { ...f, status: f.status === "ativo" ? "rascunho" : "ativo" } : f)));
  };

  const tabs = [
    { key: "flows", label: "Fluxos do Chatbot", icon: MessageSquare },
    { key: "ia", label: "Configuração da IA", icon: Brain },
    { key: "menu", label: "Menu de Intenções", icon: Bot },
  ];

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Chatbot e IA</h2>
          <p className="text-sm text-muted-foreground">Atendimento automatizado 24/7 com inteligência artificial</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-green-700">IA Ativa</span>
          </div>
          <button onClick={() => { setEditingFlow(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Novo Fluxo
          </button>
        </div>
      </div>

      {showModal && (
        <FlowFormModal
          flow={editingFlow}
          onClose={() => setShowModal(false)}
          onSave={handleSaveFlow}
        />
      )}

      <div className="flex gap-2 mb-6 border-b border-border">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "flows" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map((flow) => (
            <Card key={flow.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${flow.status === "ativo" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                  {flow.status === "ativo" ? "Ativo" : "Rascunho"}
                </span>
              </div>
              <h3 className="font-semibold mb-1">{flow.name}</h3>
              <p className="text-sm text-muted-foreground mb-3">{flow.channel} · {flow.steps} etapas</p>
              <div className="flex gap-2">
                <button onClick={() => { setEditingFlow(flow); setShowModal(true); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90">
                  <Play className="w-3.5 h-3.5" /> Editar
                </button>
                <button onClick={() => toggleFlowStatus(flow.id)} title="Ativar/Desativar" className="flex items-center justify-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-medium hover:bg-muted">
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "ia" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Capacidades da IA" className="p-5">
            <div className="space-y-3">
              {[
                { label: "Responder mensagens de texto", enabled: true },
                { label: "Interpretar e transcrever áudio", enabled: true },
                { label: "Identificar intenção do cliente", enabled: true },
                { label: "Consultar base de conhecimento", enabled: true },
                { label: "Encaminhar para setor correto", enabled: true },
                { label: "Sugerir respostas para atendente", enabled: true },
                { label: "Classificar sentimento do cliente", enabled: true },
                { label: "Detectar urgência e reclamações", enabled: false },
                { label: "Gerar resumo do atendimento", enabled: true },
                { label: "Coletar dados do cliente", enabled: true },
              ].map((cap) => (
                <div key={cap.label} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                  <span className="text-sm">{cap.label}</span>
                  <span className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-colors ${cap.enabled ? "bg-accent justify-end" : "bg-muted justify-start"}`}>
                    <span className="w-4 h-4 bg-white rounded-full shadow" />
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            <Card title="Horário de Funcionamento" className="p-5">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between p-2">
                  <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /> Funcionamento</span>
                  <span className="font-medium">24/7</span>
                </div>
                <div className="flex items-center justify-between p-2">
                  <span className="flex items-center gap-2"><Calendar className="w-4 h-4 text-muted-foreground" /> Respeitar horário comercial</span>
                  <span className="text-muted-foreground">Não</span>
                </div>
                <div className="flex items-center justify-between p-2">
                  <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /> Feriados cadastrados</span>
                  <span className="font-medium">12 feriados</span>
                </div>
              </div>
            </Card>

            <Card title="Transferência para Humano" className="p-5">
              <p className="text-sm text-muted-foreground mb-3">A IA transfere automaticamente para um atendente humano quando:</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Não sabe responder</li>
                <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Cliente solicita atendente</li>
                <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Detecta reclamação grave</li>
                <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Intenção de cancelamento</li>
              </ul>
            </Card>
          </div>
        </div>
      )}

      {tab === "menu" && (
        <Card title="Menu de Intenções Atendidas" className="p-5">
          <p className="text-sm text-muted-foreground mb-4">A IA identifica e responde automaticamente estas intenções:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {intents.map((intent) => (
              <div key={intent.label} className={`flex items-center gap-3 p-3 rounded-lg ${intent.color}`}>
                <span className="text-2xl">{intent.icon}</span>
                <span className="text-sm font-medium">{intent.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </PageContainer>
  );
}