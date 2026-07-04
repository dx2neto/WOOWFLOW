import React, { useState } from "react";
import { PageContainer, Card } from "@/components/ui/app-card";
import { Building2, Users, Calendar, Palette, Save } from "lucide-react";

const sectors = [
  { name: "Comercial", color: "bg-amber-500" },
  { name: "Suporte Técnico", color: "bg-blue-500" },
  { name: "Financeiro", color: "bg-green-500" },
  { name: "Cobrança", color: "bg-red-500" },
  { name: "Retenção", color: "bg-purple-500" },
  { name: "Pós-venda", color: "bg-indigo-500" },
  { name: "Ouvidoria", color: "bg-rose-500" },
  { name: "NOC", color: "bg-teal-500" },
];

const holidays = [
  { date: "01/01", name: "Confraternização Universal" },
  { date: "21/04", name: "Tiradentes" },
  { date: "01/05", name: "Dia do Trabalho" },
  { date: "07/09", name: "Independência" },
  { date: "12/10", name: "Nossa Senhora Aparecida" },
  { date: "02/11", name: "Finados" },
  { date: "15/11", name: "Proclamação da República" },
  { date: "25/12", name: "Natal" },
];

export default function Settings() {
  const [tab, setTab] = useState("company");

  const tabs = [
    { key: "company", label: "Empresa", icon: Building2 },
    { key: "sectors", label: "Setores", icon: Users },
    { key: "schedule", label: "Horários e Feriados", icon: Calendar },
    { key: "appearance", label: "Aparência", icon: Palette },
  ];

  return (
    <PageContainer>
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-heading">Configurações</h2>
        <p className="text-sm text-muted-foreground">Gerencie as configurações da plataforma</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-border overflow-x-auto scrollbar-thin">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "company" && (
        <Card title="Dados da Empresa" className="p-6 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nome da Empresa</label>
              <input type="text" defaultValue="NetProvedor Telecom" className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">CNPJ</label>
              <input type="text" defaultValue="12.345.678/0001-90" className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Telefone</label>
              <input type="text" defaultValue="(11) 4000-0000" className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">WhatsApp Oficial</label>
              <input type="text" defaultValue="(11) 99999-0000" className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">E-mail</label>
              <input type="email" defaultValue="contato@netprovedor.com.br" className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Cidade</label>
              <input type="text" defaultValue="São Paulo - SP" className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1.5 block">Endereço</label>
              <input type="text" defaultValue="Av. Paulista, 1000 - São Paulo, SP" className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
              <Save className="w-4 h-4" /> Salvar
            </button>
          </div>
        </Card>
      )}

      {tab === "sectors" && (
        <Card title="Setores de Atendimento" className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sectors.map((s) => (
              <div key={s.name} className="flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-muted/30">
                <div className={`w-3 h-3 rounded-full ${s.color}`} />
                <span className="flex-1 text-sm font-medium">{s.name}</span>
                <button className="text-xs text-muted-foreground hover:text-primary">Editar</button>
              </div>
            ))}
          </div>
          <button className="mt-4 flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:bg-muted/50 w-full justify-center">
            + Adicionar Setor
          </button>
        </Card>
      )}

      {tab === "schedule" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Horário de Atendimento" className="p-6">
            <div className="space-y-3">
              {["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"].map((day) => (
                <div key={day} className="flex items-center gap-3">
                  <span className="w-20 text-sm font-medium">{day}</span>
                  <input type="time" defaultValue="08:00" className="h-9 px-2 border border-border rounded text-sm" />
                  <span className="text-muted-foreground">até</span>
                  <input type="time" defaultValue="18:00" className="h-9 px-2 border border-border rounded text-sm" />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Feriados Cadastrados" className="p-6">
            <div className="space-y-2">
              {holidays.map((h) => (
                <div key={h.date} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium w-16">{h.date}</span>
                  <span className="text-sm text-muted-foreground flex-1">{h.name}</span>
                </div>
              ))}
            </div>
            <button className="mt-4 flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:bg-muted/50 w-full justify-center">
              + Adicionar Feriado
            </button>
          </Card>
        </div>
      )}

      {tab === "appearance" && (
        <Card title="Personalização Visual" className="p-6 max-w-2xl">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Cor Primária</label>
              <div className="flex gap-2">
                {["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-red-500", "bg-teal-500"].map((color) => (
                  <button key={color} className={`w-10 h-10 rounded-lg ${color} ring-2 ring-offset-2 ${color === "bg-blue-500" ? "ring-primary" : "ring-transparent"}`} />
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Logo da Empresa</label>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:bg-muted/30 cursor-pointer">
                <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Clique para enviar o logo</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Modo do Tema</label>
              <div className="flex gap-2">
                <button className="flex-1 p-3 border-2 border-primary rounded-lg text-sm font-medium">Claro</button>
                <button className="flex-1 p-3 border-2 border-border rounded-lg text-sm">Escuro</button>
                <button className="flex-1 p-3 border-2 border-border rounded-lg text-sm">Automático</button>
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
              <Save className="w-4 h-4" /> Salvar
            </button>
          </div>
        </Card>
      )}
    </PageContainer>
  );
}