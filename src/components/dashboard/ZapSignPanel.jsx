import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, StatCard } from "@/components/ui/app-card";
import { zapsignApi } from "@/functions/zapsignApi";
import { Link } from "react-router-dom";
import { FileSignature, Clock, CheckCircle, XCircle, ArrowRight, Loader2, RefreshCw } from "lucide-react";

export default function ZapSignPanel() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["zapsignDashboard"],
    queryFn: async () => {
      const res = await zapsignApi({ action: "dashboard" });
      return res?.data?.success ? res.data.data : null;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (isLoading) return (
    <Card className="p-5 mb-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando ZapSign...
      </div>
    </Card>
  );
  if (!data) return null;

  const total = data.total || 0;
  const pending = data.pending || 0;
  const signed = data.signed || 0;
  const expired = data.expired || 0;
  const cancelled = data.cancelled || 0;
  const signedPct = total > 0 ? Math.round((signed / total) * 100) : 0;

  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-base flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-primary" /> ZapSign — Contratos em Tempo Real
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            disabled={isFetching}
            title="Atualizar"
            className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          <Link to="/signatures" className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
            Ver todos <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard title="Pendentes" value={pending} icon={Clock} color="warning" />
        <StatCard title="Assinados" value={signed} icon={CheckCircle} color="accent" />
        <StatCard title="Expirados" value={expired} icon={XCircle} color="danger" />
        <StatCard title="Cancelados" value={cancelled} icon={XCircle} color="primary" />
      </div>

      {total > 0 && (
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Taxa de assinatura</span>
            <span className="font-semibold text-green-600">{signedPct}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full transition-all duration-700"
              style={{ width: `${signedPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {signed} de {total} documento(s) assinado(s)
          </p>
        </div>
      )}

      {pending > 0 && (
        <div className="mt-4 flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-700 font-medium">
            {pending} documento(s) aguardando assinatura
          </p>
          <Link to="/signatures" className="text-xs font-semibold text-amber-700 hover:underline whitespace-nowrap ml-3">
            Gerenciar →
          </Link>
        </div>
      )}
    </Card>
  );
}