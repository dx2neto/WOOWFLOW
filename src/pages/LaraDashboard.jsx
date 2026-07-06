import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { StatCard, Card } from "@/components/ui/app-card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Bot, CheckCircle2, ArrowRightCircle, MessagesSquare } from "lucide-react";

const RESOLVED_STATUSES = ["resolvido", "finalizado"];
const ESCALATED_STATUSES = ["aguardando_atendimento", "em_atendimento"];

export default function LaraDashboard() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    const unsubscribe = base44.entities.Conversation.subscribe((event) => {
      setConversations((prev) => {
        if (event.type === "create") return [event.data, ...prev.filter((c) => c.id !== event.data.id)];
        if (event.type === "update") return prev.map((c) => (c.id === event.data.id ? event.data : c));
        if (event.type === "delete") return prev.filter((c) => c.id !== event.data.id);
        return prev;
      });
    });
    return unsubscribe;
  }, []);

  const loadConversations = async () => {
    try {
      const data = await base44.entities.Conversation.filter({ is_ai: true }, "-last_message_time", 500);
      setConversations(data);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = conversations.length;
    const resolved = conversations.filter((c) => RESOLVED_STATUSES.includes(c.status)).length;
    const escalated = conversations.filter((c) => ESCALATED_STATUSES.includes(c.status)).length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, resolved, escalated, resolutionRate };
  }, [conversations]);

  const chartData = [
    { name: "Resolvido pela IA", value: stats.resolved, color: "#22c55e" },
    { name: "Escalado para humano", value: stats.escalated, color: "#f59e0b" },
    { name: "Em andamento", value: Math.max(stats.total - stats.resolved - stats.escalated, 0), color: "#94a3b8" },
  ];

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Carregando painel da Lara...</div>;
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-heading">Painel da Lara</h1>
            <p className="text-sm text-muted-foreground">Métricas em tempo real dos atendimentos da IA</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard title="Total de Atendimentos" value={stats.total} icon={MessagesSquare} color="purple" />
          <StatCard title="Taxa de Resolução Automática" value={`${stats.resolutionRate}%`} icon={CheckCircle2} color="accent" subtitle={`${stats.resolved} resolvidos pela IA`} />
          <StatCard title="Escalados para Humano" value={stats.escalated} icon={ArrowRightCircle} color="warning" />
        </div>

        <Card title="Distribuição dos Atendimentos" className="p-5">
          {stats.total === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhum atendimento da Lara registrado ainda</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}