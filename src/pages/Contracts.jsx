import React, { useState, useEffect, useCallback } from "react";
import { PageContainer, StatCard, Card } from "@/components/ui/app-card";
import { ixcApi } from "@/functions/ixcApi";
import { Search, FileText, CheckCircle, XCircle, Download, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";

const STATUS_MAP = {
  ativo:     { label: "Ativo",     color: "bg-green-100 text-green-700" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700" },
  A:         { label: "Ativo",     color: "bg-green-100 text-green-700" },
  CA:        { label: "Cancelado", color: "bg-red-100 text-red-700" },
  I:         { label: "Inativo",   color: "bg-gray-100 text-gray-700" },
};

const INTERNET_MAP = {
  A: { label: "Online",   color: "bg-blue-100 text-blue-700",   icon: Wifi },
  S: { label: "Suspenso", color: "bg-amber-100 text-amber-700", icon: WifiOff },
  I: { label: "Inativo",  color: "bg-gray-100 text-gray-700",   icon: WifiOff },
};

export default function Contracts() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async (st = statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await ixcApi({
        action: "contratos",
        status: st !== "all" ? st : undefined,
      });
      if (res?.data?.error) { setError(res.data.error); setContracts([]); return; }
      setContracts(res?.data?.result?.registros || []);
    } catch {
      setError("Não foi possível carregar os contratos do IXC Provedor.");
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = contracts.filter((c) => {
    const q = search.toLowerCase();
    return !q
      || c.customer_name?.toLowerCase().includes(q)
      || c.plan_name?.toLowerCase().includes(q)
      || c.city?.toLowerCase().includes(q)
      || c.vendor_name?.toLowerCase().includes(q)
      || String(c.id).includes(q);
  });

  const ativos     = contracts.filter((c) => c.status === "A" || c.status === "ativo");
  const cancelados = contracts.filter((c) => c.status === "CA" || c.status === "cancelado" || c.status === "I");
  const online     = contracts.filter((c) => c.internet_status === "A");
  const suspensos  = contracts.filter((c) => c.internet_status === "S");

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Contratos</h2>
          <p className="text-sm text-muted-foreground">{contracts.length} contratos carregados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load(statusFilter)} className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => exportToCsv("contratos.csv", filtered.map((c) => ({
              id: c.id, cliente: c.customer_name, telefone: c.phone,
              plano: c.plan_name, velocidade: c.download ? `${c.download}/${c.upload}` : "—",
              vendedor: c.vendor_name, cidade: c.city,
              status: STATUS_MAP[c.status]?.label || c.status,
              internet: INTERNET_MAP[c.internet_status]?.label || c.internet_status || "—",
              ativacao: c.start_date, vencimento: c.renewal_date,
              ip: c.ip, mac: c.mac, olt: c.olt, cto: c.cto,
            })))}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            <Download className="w-4 h-4" /> Exportar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total"      value={contracts.length}  icon={FileText}    color="primary" />
        <StatCard title="Ativos"     value={ativos.length}     icon={CheckCircle} color="accent" />
        <StatCard title="Cancelados" value={cancelados.length} icon={XCircle}     color="danger" />
        <StatCard title="Online"     value={online.length}     icon={Wifi}        color="indigo" />
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, plano, cidade ou vendedor..."
              className="w-full h-10 pl-9 pr-4 bg-muted/60 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex gap-1.5">
            {[["all", "Todos"], ["A", "Ativos"], ["CA", "Cancelados"]].map(([k, l]) => (
              <button
                key={k}
                onClick={() => { setStatusFilter(k); load(k); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left font-semibold px-4 py-3">ID</th>
                <th className="text-left font-semibold px-4 py-3">Cliente</th>
                <th className="text-left font-semibold px-4 py-3">Plano / Velocidade</th>
                <th className="text-left font-semibold px-4 py-3">Cidade</th>
                <th className="text-left font-semibold px-4 py-3">Vendedor</th>
                <th className="text-left font-semibold px-4 py-3">Internet</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-left font-semibold px-4 py-3">Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Carregando contratos...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum contrato encontrado</td></tr>
              ) : (
                filtered.map((c) => {
                  const st   = STATUS_MAP[c.status] || { label: c.status || "—", color: "bg-muted text-muted-foreground" };
                  const inet = INTERNET_MAP[c.internet_status] || null;
                  return (
                    <tr key={c.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground text-xs">#{c.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{c.customer_name || "—"}</p>
                        {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-muted-foreground">{c.plan_name || "—"}</p>
                        {(c.download || c.upload) && (
                          <p className="text-xs text-muted-foreground">{c.download}/{c.upload}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.city || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.vendor_name || "—"}</td>
                      <td className="px-4 py-3">
                        {inet ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${inet.color}`}>
                            <inet.icon className="w-3 h-3" />{inet.label}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.renewal_date ? new Date(c.renewal_date).toLocaleDateString("pt-BR") : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground flex items-center gap-4">
          <span>Exibindo {filtered.length} de {contracts.length} contrato(s)</span>
          {suspensos.length > 0 && (
            <span className="text-amber-600 font-medium">• {suspensos.length} suspenso(s)</span>
          )}
        </div>
      </Card>
    </PageContainer>
  );
}
