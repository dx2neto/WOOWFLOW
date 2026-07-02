import React, { useState } from "react";
import { PageContainer, Card, StatCard } from "@/components/ui/Card";
import { Download, TrendingUp, Clock, Users, DollarSign, Star, Trophy, FileBarChart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

const attendantData = [
  { name: "Ana Paula", atendimentos: 145, resolucao: 92, satisfaction: 4.8 },
  { name: "Carlos Silva", atendimentos: 132, resolucao: 88, satisfaction: 4.7 },
  { name: "Mariana Costa", atendimentos: 128, resolucao: 95, satisfaction: 4.9 },
  { name: "Pedro Santos", atendimentos: 110, resolucao: 85, satisfaction: 4.5 },
  { name: "Julia Lima", atendimentos: 98, resolucao: 90, satisfaction: 4.6 },
];

const conversionData = [
  { month: "Jan", leads: 120, vendas: 45 },
  { month: "Fev", leads: 145, vendas: 52 },
  { month: "Mar", leads: 160, vendas: 58 },
  { month: "Abr", leads: 135, vendas: 48 },
  { month: "Mai", leads: 180, vendas: 67 },
  { month: "Jun", leads: 195, vendas: 72 },
];

const cityData = [
  { city: "São Paulo", clientes: 420, vendas: 28 },
  { city: "Campinas", clientes: 280, vendas: 18 },
  { city: "Santos", clientes: 190, vendas: 12 },
  { city: "Guarulhos", clientes: 150, vendas: 9 },
  { city: "Osasco", clientes: 120, vendas: 7 },
];

export default function Reports() {
  const [period, setPeriod] = useState("Este mês");

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Relatórios Gerenciais</h2>
          <p className="text-sm text-muted-foreground">Indicadores detalhados de atendimento e vendas</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-10 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:border-primary"
          >
            <option>Hoje</option><option>Ontem</option><option>Esta semana</option>
            <option>Este mês</option><option>Últimos 30 dias</option><option>Últimos 90 dias</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Taxa de Conversão" value="36.9%" icon={TrendingUp} color="accent" trend={4} />
        <StatCard title="Tempo Médio Resposta" value="2m 34s" icon={Clock} color="primary" trend={-8} />
        <StatCard title="NPS Médio" value="78" icon={Star} color="purple" trend={3} />
        <StatCard title="SLA Cumprido" value="87%" icon={Trophy} color="indigo" trend={5} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card title="Conversão de Vendas" className="p-5">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={conversionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="leads" fill="#3b82f6" name="Leads" radius={[4, 4, 0, 0]} />
              <Bar dataKey="vendas" fill="#22c55e" name="Vendas" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Desempenho por Cidade" className="p-5">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cityData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="city" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip contentStyle={{ borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="clientes" fill="#3b82f6" name="Clientes" radius={[0, 4, 4, 0]} />
              <Bar dataKey="vendas" fill="#22c55e" name="Vendas" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Ranking de Atendentes" className="overflow-hidden mb-6">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-semibold px-4 py-3">#</th>
                <th className="text-left font-semibold px-4 py-3">Atendente</th>
                <th className="text-left font-semibold px-4 py-3">Atendimentos</th>
                <th className="text-left font-semibold px-4 py-3">Taxa Resolução</th>
                <th className="text-left font-semibold px-4 py-3">Satisfação</th>
                <th className="text-left font-semibold px-4 py-3">Tempo Médio</th>
              </tr>
            </thead>
            <tbody>
              {attendantData.map((att, i) => (
                <tr key={att.name} className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-gray-200 text-gray-700" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"}`}>
                      {i + 1}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{att.name}</td>
                  <td className="px-4 py-3">{att.atendimentos}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${att.resolucao}%` }} />
                      </div>
                      <span className="text-xs">{att.resolucao}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1"><Star className="w-4 h-4 text-amber-400" fill="currentColor" /> {att.satisfaction}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{Math.floor(Math.random() * 5 + 2)}m {Math.floor(Math.random() * 59)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Exportar Relatórios" className="p-5">
          <div className="space-y-2">
            {["PDF", "Excel (XLSX)", "CSV"].map((format) => (
              <button key={format} className="w-full flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 text-sm font-medium">
                <FileBarChart className="w-4 h-4 text-primary" /> Relatório Completo - {format}
                <Download className="w-4 h-4 text-muted-foreground ml-auto" />
              </button>
            ))}
          </div>
        </Card>

        <Card title="Resumo Financeiro" className="p-5">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Cobranças enviadas</span><span className="font-semibold">89</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">PIX recebidos</span><span className="font-semibold text-green-600">67</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Boletos pagos</span><span className="font-semibold text-green-600">45</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Desbloqueios</span><span className="font-semibold">18</span></div>
            <div className="flex justify-between border-t border-border pt-2"><span className="font-medium">Total recebido</span><span className="font-bold text-green-600">R$ 28.450,00</span></div>
          </div>
        </Card>

        <Card title="Motivos de Cancelamento" className="p-5">
          <div className="space-y-2 text-sm">
            {[
              { reason: "Preço", count: 12, pct: 40 },
              { reason: "Sem cobertura", count: 8, pct: 27 },
              { reason: "Não respondeu", count: 5, pct: 17 },
              { reason: "Concorrente", count: 3, pct: 10 },
              { reason: "Outro", count: 2, pct: 6 },
            ].map((m) => (
              <div key={m.reason}>
                <div className="flex justify-between mb-1">
                  <span>{m.reason}</span><span className="text-muted-foreground">{m.count}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${m.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}