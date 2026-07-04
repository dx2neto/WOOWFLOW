import React, { useState } from "react";
import { PageContainer, StatCard, Card } from "@/components/ui/Card";
import FinancialPanel from "@/components/dashboard/FinancialPanel";
import {
  Inbox, DollarSign, Send, Clock, CheckCircle, TrendingUp,
  Star, AlertCircle, Zap, MessageSquare
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";

const channelData = [
  { channel: "WhatsApp", atendimentos: 420 },
  { channel: "Instagram", atendimentos: 120 },
  { channel: "Messenger", atendimentos: 85 },
  { channel: "Telegram", atendimentos: 45 },
  { channel: "WebChat", atendimentos: 60 },
  { channel: "Telefone", atendimentos: 30 },
];

const sectorData = [
  { name: "Suporte Técnico", value: 280, color: "#3b82f6" },
  { name: "Financeiro", value: 180, color: "#22c55e" },
  { name: "Comercial", value: 150, color: "#f59e0b" },
  { name: "Cobrança", value: 90, color: "#ef4444" },
  { name: "Retenção", value: 60, color: "#a855f7" },
];

const trendData = [
  { day: "Seg", atendimentos: 120, resolvidos: 95 },
  { day: "Ter", atendimentos: 145, resolvidos: 120 },
  { day: "Qua", atendimentos: 130, resolvidos: 110 },
  { day: "Qui", atendimentos: 165, resolvidos: 140 },
  { day: "Sex", atendimentos: 180, resolvidos: 155 },
  { day: "Sáb", atendimentos: 90, resolvidos: 75 },
  { day: "Dom", atendimentos: 55, resolvidos: 48 },
];

const npsData = [
  { month: "Jan", nps: 62 },
  { month: "Fev", nps: 65 },
  { month: "Mar", nps: 68 },
  { month: "Abr", nps: 72 },
  { month: "Mai", nps: 75 },
  { month: "Jun", nps: 78 },
];

const attendantRanking = [
  { name: "Ana Paula", atendimentos: 145, satisfaction: 4.8 },
  { name: "Carlos Silva", atendimentos: 132, satisfaction: 4.7 },
  { name: "Mariana Costa", atendimentos: 128, satisfaction: 4.9 },
  { name: "Pedro Santos", atendimentos: 110, satisfaction: 4.5 },
];

const periods = ["Hoje", "Ontem", "Esta semana", "Este mês", "Últimos 30 dias", "Últimos 60 dias", "Últimos 90 dias"];

export default function Dashboard() {
  const [period, setPeriod] = useState("Hoje");
  const [stats, setStats] = useState({
    open: 47, inProgress: 23, resolved: 156, leads: 34,
    chargesSent: 89, pixReceived: 67, defaulters: 42, unblocks: 18
  });

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Visão Geral</h2>
          <p className="text-sm text-muted-foreground">Indicadores em tempo real do seu provedor</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="h-10 px-4 rounded-lg border border-border bg-card text-sm font-medium focus:outline-none focus:border-primary"
        >
          {periods.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>

      <FinancialPanel />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Atendimentos Abertos" value={stats.open} icon={Inbox} color="primary" trend={12} />
        <StatCard title="Em Andamento" value={stats.inProgress} icon={MessageSquare} color="indigo" trend={5} />
        <StatCard title="Finalizados" value={stats.resolved} icon={CheckCircle} color="accent" trend={18} />
        <StatCard title="Leads em Negociação" value={stats.leads} icon={TrendingUp} color="purple" trend={8} />
        <StatCard title="Cobranças Enviadas" value={stats.chargesSent} icon={Send} color="warning" trend={15} />
        <StatCard title="PIX Recebidos" value={stats.pixReceived} icon={Zap} color="accent" trend={22} />
        <StatCard title="Clientes Inadimplentes" value={stats.defaulters} icon={AlertCircle} color="danger" trend={-5} />
        <StatCard title="Desbloqueios WhatsApp" value={stats.unblocks} icon={DollarSign} color="primary" trend={10} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Atendimentos por Dia" className="lg:col-span-2 p-5">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
              <Area type="monotone" dataKey="atendimentos" stroke="#3b82f6" strokeWidth={2} fill="url(#colorAtt)" name="Atendimentos" />
              <Area type="monotone" dataKey="resolvidos" stroke="#22c55e" strokeWidth={2} fill="url(#colorRes)" name="Resolvidos" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Atendimentos por Setor" className="p-5">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={sectorData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                {sectorData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card title="Atendimentos por Canal" className="p-5">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={channelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="channel" type="category" tick={{ fontSize: 11 }} width={70} />
              <Tooltip contentStyle={{ borderRadius: 8 }} />
              <Bar dataKey="atendimentos" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Evolução do NPS" className="p-5">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={npsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[50, 100]} />
              <Tooltip contentStyle={{ borderRadius: 8 }} />
              <Line type="monotone" dataKey="nps" stroke="#a855f7" strokeWidth={3} dot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Ranking de Atendentes" className="p-5">
          <div className="space-y-3">
            {attendantRanking.map((att, i) => (
              <div key={att.name} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-gray-200 text-gray-700" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{att.name}</p>
                  <p className="text-xs text-muted-foreground">{att.atendimentos} atendimentos</p>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Star className="w-4 h-4 text-amber-400" fill="currentColor" />
                  <span className="font-semibold">{att.satisfaction}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Tempos Médios" className="p-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-muted/40 rounded-lg">
              <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">2m 34s</p>
              <p className="text-xs text-muted-foreground">Primeira resposta</p>
            </div>
            <div className="text-center p-4 bg-muted/40 rounded-lg">
              <CheckCircle className="w-6 h-6 text-accent mx-auto mb-2" />
              <p className="text-2xl font-bold">18m 12s</p>
              <p className="text-xs text-muted-foreground">Resolução média</p>
            </div>
          </div>
        </Card>

        <Card title="SLA de Atendimento" className="p-5">
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>SLA cumprido</span>
                <span className="font-semibold text-green-600">87%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: "87%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>SLA vencido</span>
                <span className="font-semibold text-red-600">13%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: "13%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Pesquisa enviada</span>
                <span className="font-semibold text-blue-600">72%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: "72%" }} />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}