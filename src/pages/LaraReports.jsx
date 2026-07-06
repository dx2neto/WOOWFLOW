import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { StatCard, Card } from "@/components/ui/app-card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BarChart3, CheckCircle2, ArrowRightCircle, MessagesSquare } from "lucide-react";

const RESOLVED_STATUSES = ["resolvido", "finalizado"];
const ESCALATED_STATUSES = ["aguardando_atendimento", "em_atendimento"];

export default function LaraReports() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const data = await base44.entities.Conversation.filter({ is_ai: true }, "-last_message_time", 1000);
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

  const dailyData = useMemo(() => {
    const map = {};
    conversations.forEach((c) => {
      const dateRef = c.last_message_time || c.created_date;
      if (!dateRef) return;
      const day = new Date(dateRef).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      if (!map[day]) map[day] = { day, total: 0, resolvido: 0, escalado: 0, sortKey: new Date(dateRef).setHours(0, 0, 0, 0) };
      map[day].total += 1;
      if (RESOLVED_STATUSES.includes(c.status)) map[day].resolvido += 1;
      if (ESCALATED_STATUSES.includes(c.status)) map[day].escalado += 1;
    });
    return Object.values(map).sort((a, b) => a.sortKey - b.sortKey).slice(-14);
  }, [conversations]);

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Carregando relatórios da Lara...</div>;
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-heading">Relatórios da Lara</h1>
            <p className="text-sm text-muted-foreground">Performance da IA nos últimos dias</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard title="Total de Atendimentos" value={stats.total} icon={MessagesSquare} color="purple" />
          <StatCard title="Taxa de Resolução Automática" value={`${stats.resolutionRate}%`} icon={CheckCircle2} color="accent" subtitle={`${stats.resolved} resolvidos pela IA`} />
          <StatCard title="Escalados para Humano" value={stats.escalated} icon={ArrowRightCircle} color="warning" />
        </div>

        <Card title="Atendimentos por Dia" className="p-5">
          {dailyData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhum atendimento da Lara registrado ainda</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="resolvido" name="Resolvido pela IA" fill="#22c55e" stackId="a" />
                <Bar dataKey="escalado" name="Escalado para humano" fill="#f59e0b" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}