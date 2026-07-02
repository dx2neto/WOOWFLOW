import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { StatCard } from "@/components/ui/Card";
import { Phone, PhoneMissed, Clock, Radio } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { callReasons } from "../constants";

export default function DashboardTab() {
  const [trunks, setTrunks] = useState([]);
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    base44.entities.SipTrunk.list().then(setTrunks);
    base44.entities.Call.list("-start_time", 200).then(setCalls);
  }, []);

  const online = trunks.filter((t) => t.status === "online" || t.status === "registrado").length;
  const lost = calls.filter((c) => c.status === "perdida" || c.status === "abandonada").length;
  const active = calls.filter((c) => c.status === "em_andamento" || c.status === "aguardando").length;
  const avgWait = calls.length ? Math.round(calls.reduce((s, c) => s + (c.wait_time_seconds || 0), 0) / calls.length) : 0;

  const reasonCounts = {};
  calls.forEach((c) => { reasonCounts[c.call_reason] = (reasonCounts[c.call_reason] || 0) + 1; });
  const chartData = Object.entries(reasonCounts).map(([k, v]) => ({ name: callReasons[k] || k, chamadas: v }));

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Troncos Online" value={`${online}/${trunks.length}`} icon={Radio} color="accent" />
        <StatCard title="Ligações Ativas" value={active} icon={Phone} color="primary" />
        <StatCard title="Ligações Perdidas" value={lost} icon={PhoneMissed} color="danger" />
        <StatCard title="Espera Média" value={`${avgWait}s`} icon={Clock} color="indigo" />
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Chamadas por Motivo de Contato</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={70} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="chamadas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}