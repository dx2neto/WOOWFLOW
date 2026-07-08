import React, { useState, useEffect } from "react";
import { PageContainer, StatCard, Card } from "@/components/ui/app-card";
import { supabase } from "@/lib/supabaseClient";
import { Building2, Users, Search, CheckCircle, Clock, Ban } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const statusStyles = {
  ativo: "bg-green-100 text-green-700",
  trial: "bg-blue-100 text-blue-700",
  suspenso: "bg-amber-100 text-amber-700",
  cancelado: "bg-red-100 text-red-700",
};

const statusLabels = {
  ativo: "Ativo",
  trial: "Trial",
  suspenso: "Suspenso",
  cancelado: "Cancelado",
};

export default function PlatformOrganizations() {
  const [orgs, setOrgs] = useState([]);
  const [counts, setCounts] = useState({});
  const [plansById, setPlansById] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: orgData }, { data: planData }, { data: profileData }] = await Promise.all([
        supabase.from("organizations").select("*").order("created_at", { ascending: false }),
        supabase.from("plans").select("id,name"),
        supabase.from("profiles").select("organization_id"),
      ]);

      setOrgs(orgData || []);
      setPlansById(
        (planData || []).reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {})
      );
      setCounts(
        (profileData || []).reduce((acc, p) => {
          if (!p.organization_id) return acc;
          acc[p.organization_id] = (acc[p.organization_id] || 0) + 1;
          return acc;
        }, {})
      );
      setLoading(false);
    })();
  }, []);

  const filtered = search
    ? orgs.filter((o) => o.name?.toLowerCase().includes(search.toLowerCase()))
    : orgs;

  const ativos = orgs.filter((o) => o.status === "ativo").length;
  const trials = orgs.filter((o) => o.status === "trial").length;
  const totalUsers = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <PageContainer>
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-heading text-foreground">Organizacoes</h2>
        <p className="text-sm text-muted-foreground">
          Gestao das empresas assinantes da plataforma WOOWFLOW
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total" value={orgs.length} icon={Building2} color="primary" />
        <StatCard title="Ativas" value={ativos} icon={CheckCircle} color="accent" />
        <StatCard title="Em trial" value={trials} icon={Clock} color="indigo" />
        <StatCard title="Usuarios" value={totalUsers} icon={Users} color="purple" />
      </div>

      <Card title="Empresas cadastradas" action={
        <div className="relative w-64 max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Buscar empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      }>
        {loading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            Nenhuma organizacao encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="px-5 py-3 font-medium">Empresa</th>
                  <th className="px-5 py-3 font-medium">Plano</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Usuarios</th>
                  <th className="px-5 py-3 font-medium">Criada em</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((org) => (
                  <tr key={org.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <div className="font-medium text-foreground">{org.name}</div>
                      {org.email && <div className="text-xs text-muted-foreground">{org.email}</div>}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {plansById[org.plan_id] || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <Badge className={`${statusStyles[org.status] || "bg-muted text-foreground"} border-0`}>
                        {statusLabels[org.status] || org.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{counts[org.id] || 0}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {org.created_at ? new Date(org.created_at).toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
