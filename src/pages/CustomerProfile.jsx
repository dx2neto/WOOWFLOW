import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { PageContainer, Card, StatCard } from "@/components/ui/app-card";
import { ixcApi } from "@/functions/ixcApi";
import { evolutionApi } from "@/functions/evolutionApi";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft, User, Phone, Mail, MapPin, FileText,
  DollarSign, Wrench, Wifi, WifiOff, Send, Loader2,
  CheckCircle, AlertTriangle, Clock
} from "lucide-react";
import CustomerTimeline from "@/components/customers/CustomerTimeline";
import CustomerConversationsHistory from "@/components/customers/CustomerConversationsHistory";
import AgreementCheckPanel from "@/components/agreements/AgreementCheckPanel";

const STATUS_CONTRATO = {
  A:  { label: "Ativo",     color: "bg-green-100 text-green-700" },
  CA: { label: "Cancelado", color: "bg-red-100 text-red-700" },
  I:  { label: "Inativo",   color: "bg-gray-100 text-gray-700" },
};
const STATUS_INTERNET = {
  A: { label: "Online",   color: "bg-blue-100 text-blue-700",   icon: Wifi },
  S: { label: "Suspenso", color: "bg-amber-100 text-amber-700", icon: WifiOff },
  I: { label: "Inativo",  color: "bg-gray-100 text-gray-700",   icon: WifiOff },
};
const STATUS_FATURA = {
  P: { label: "Paga",    color: "bg-green-100 text-green-700" },
  A: { label: "Aberta",  color: "bg-amber-100 text-amber-700" },
  C: { label: "Cancel.", color: "bg-gray-100 text-gray-700" },
};
const STATUS_OS = {
  A:  { label: "Aberta",       color: "bg-blue-100 text-blue-700" },
  E:  { label: "Em andamento", color: "bg-amber-100 text-amber-700" },
  F:  { label: "Fechada",      color: "bg-green-100 text-green-700" },
  C:  { label: "Cancelada",    color: "bg-red-100 text-red-700" },
  AG: { label: "Agendada",     color: "bg-purple-100 text-purple-700" },
};

const fmtBRL  = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const TABS = [
  { key: "timeline",  label: "Linha do Tempo" },
  { key: "conversas", label: "Histórico de Conversas" },
  { key: "contratos", label: "Contratos" },
  { key: "financeiro",label: "Financeiro" },
  { key: "os",        label: "Ordens de Serviço" },
  { key: "acordo",    label: "Verificação de Acordo" },
];

export default function CustomerProfile() {
  const { id } = useParams();
  const { toast } = useToast();

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("timeline");

  const [contratos, setContratos]         = useState([]);
  const [loadingContratos, setLoadingContratos] = useState(false);
  const [contratosFetched, setContratosFetched] = useState(false);

  const [faturas, setFaturas]             = useState([]);
  const [loadingFaturas, setLoadingFaturas]     = useState(false);
  const [faturasFetched, setFaturasFetched]     = useState(false);

  const [ordens, setOrdens]               = useState([]);
  const [loadingOS, setLoadingOS]         = useState(false);
  const [osFetched, setOsFetched]         = useState(false);

  const [sendingId, setSendingId] = useState(null);

  useEffect(() => { loadCustomer(); }, [id]);

  const loadCustomer = async () => {
    setLoading(true);
    try {
      const response = await ixcApi({ action: "cliente_por_id", clientId: id });
      setCustomer((response?.data?.result?.registros || [])[0] || null);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "contratos" && !contratosFetched) {
      setContratosFetched(true);
      setLoadingContratos(true);
      ixcApi({ action: "contratos", clientId: id })
        .then((res) => setContratos(res?.data?.result?.registros || []))
        .catch(() => setContratos([]))
        .finally(() => setLoadingContratos(false));
    }
    if (tab === "financeiro" && !faturasFetched) {
      setFaturasFetched(true);
      setLoadingFaturas(true);
      ixcApi({ action: "faturas_cliente", clientId: id })
        .then((res) => setFaturas(res?.data?.result?.registros || []))
        .catch(() => setFaturas([]))
        .finally(() => setLoadingFaturas(false));
    }
    if (tab === "os" && !osFetched) {
      setOsFetched(true);
      setLoadingOS(true);
      ixcApi({ action: "os", clientId: id, limit: 50 })
        .then((res) => setOrdens(res?.data?.data || []))
        .catch(() => setOrdens([]))
        .finally(() => setLoadingOS(false));
    }
  }, [tab]);

  const handleSendFatura = async (fatura, type) => {
    if (!customer?.phone) {
      toast({ title: "Cliente sem telefone cadastrado", variant: "destructive" });
      return;
    }
    setSendingId(`${type}-${fatura.id}`);
    try {
      const msg = type === "pix"
        ? `Olá ${customer.name}, segue o código PIX para pagamento da fatura de ${fmtBRL(fatura.value)} (venc. ${fmtDate(fatura.due_date)}).\nCódigo PIX: ${fatura.pix_code || "Indisponível"}`
        : `Olá ${customer.name}, segue o boleto da fatura de ${fmtBRL(fatura.value)} (venc. ${fmtDate(fatura.due_date)}).\nLinha digitável: ${fatura.linha_digitavel || "Indisponível"}`;
      const r = await evolutionApi({ action: "send_message", phone: customer.phone, message: msg });
      toast({ title: r?.data?.success ? `${type === "pix" ? "PIX" : "Boleto"} enviado via WhatsApp` : "Falha ao enviar mensagem", variant: r?.data?.success ? "default" : "destructive" });
    } catch {
      toast({ title: "Erro ao enviar mensagem", variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  if (loading) {
    return <PageContainer><p className="text-sm text-muted-foreground py-16 text-center">Carregando cliente...</p></PageContainer>;
  }

  if (!customer) {
    return (
      <PageContainer>
        <Link to="/customers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <p className="text-sm text-muted-foreground">Cliente não encontrado no IXCSoft.</p>
      </PageContainer>
    );
  }

  const faturasAbertas = faturas.filter((f) => f.status === "A");
  const totalEmAberto  = faturasAbertas.reduce((s, f) => s + (f.value || 0), 0);

  return (
    <PageContainer>
      <Link to="/customers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar para clientes
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-4 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
          {customer.name?.charAt(0)?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold font-heading">{customer.name}</h2>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
            {customer.phone    && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{customer.phone}</span>}
            {customer.email    && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{customer.email}</span>}
            {customer.city     && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{customer.city}</span>}
            {customer.cpf_cnpj && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{customer.cpf_cnpj}</span>}
          </div>
          <div className="mt-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${customer.contract_status === "ativo" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {customer.contract_status === "ativo" ? "Ativo" : "Inativo"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Linha do Tempo ─────────────────────────────────── */}
      {tab === "timeline" && (
        <Card title="Linha do Tempo" className="p-5">
          <CustomerTimeline phone={customer.phone} clientId={customer.id} />
        </Card>
      )}

      {/* ── Histórico de Conversas (todos os canais) ───────── */}
      {tab === "conversas" && (
        <Card title="Histórico de Conversas — Todos os Canais" className="overflow-hidden">
          <CustomerConversationsHistory phone={customer.phone} email={customer.email} />
        </Card>
      )}

      {/* ── Contratos ──────────────────────────────────────── */}
      {tab === "contratos" && (
        <Card title="Contratos IXCSoft" className="overflow-hidden">
          {loadingContratos ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Carregando contratos...</p>
          ) : contratos.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Nenhum contrato encontrado</p>
          ) : (
            <div className="divide-y divide-border">
              {contratos.map((c) => {
                const st   = STATUS_CONTRATO[c.status] || { label: c.status, color: "bg-muted text-muted-foreground" };
                const inet = STATUS_INTERNET[c.internet_status] || null;
                return (
                  <div key={c.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <p className="font-semibold flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        Contrato #{c.id} — {c.plan_name || "Plano não informado"}
                        {(c.download || c.upload) && (
                          <span className="text-xs text-muted-foreground font-normal">({c.download}/{c.upload})</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${st.color}`}>{st.label}</span>
                        {inet && (
                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${inet.color}`}>
                            <inet.icon className="w-3 h-3" />{inet.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      {c.city         && <div><p className="text-xs text-muted-foreground">Cidade</p><p className="font-medium">{c.city}</p></div>}
                      {c.vendor_name  && <div><p className="text-xs text-muted-foreground">Vendedor</p><p className="font-medium">{c.vendor_name}</p></div>}
                      {c.start_date   && <div><p className="text-xs text-muted-foreground">Ativação</p><p className="font-medium">{fmtDate(c.start_date)}</p></div>}
                      {c.renewal_date && <div><p className="text-xs text-muted-foreground">Vencimento</p><p className="font-medium">{fmtDate(c.renewal_date)}</p></div>}
                      {c.ip           && <div><p className="text-xs text-muted-foreground">IP</p><p className="font-mono text-xs">{c.ip}</p></div>}
                      {c.mac          && <div><p className="text-xs text-muted-foreground">MAC</p><p className="font-mono text-xs">{c.mac}</p></div>}
                      {c.olt          && <div><p className="text-xs text-muted-foreground">OLT</p><p className="font-medium">{c.olt}</p></div>}
                      {c.cto          && <div><p className="text-xs text-muted-foreground">CTO</p><p className="font-medium">{c.cto}</p></div>}
                    </div>
                    {c.address && (
                      <p className="mt-2 text-sm text-muted-foreground"><MapPin className="w-3.5 h-3.5 inline mr-1" />{c.address}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── Financeiro ─────────────────────────────────────── */}
      {tab === "financeiro" && (
        <div className="space-y-4">
          {!loadingFaturas && faturas.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard title="Total de Faturas"  value={faturas.length}        icon={DollarSign}    color="primary" />
              <StatCard title="Faturas em Aberto" value={faturasAbertas.length} icon={AlertTriangle} color="warning" />
              <StatCard title="Valor em Aberto"   value={fmtBRL(totalEmAberto)} icon={DollarSign}    color="danger" />
            </div>
          )}
          <Card title="Histórico de Faturas" className="overflow-hidden">
            {loadingFaturas ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Carregando faturas...</p>
            ) : faturas.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma fatura encontrada</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left font-semibold px-4 py-3">ID</th>
                      <th className="text-left font-semibold px-4 py-3">Vencimento</th>
                      <th className="text-left font-semibold px-4 py-3">Pagamento</th>
                      <th className="text-left font-semibold px-4 py-3">Valor</th>
                      <th className="text-left font-semibold px-4 py-3">Status</th>
                      <th className="text-right font-semibold px-4 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {faturas.map((f) => {
                      const sf = STATUS_FATURA[f.status] || { label: f.status, color: "bg-muted text-muted-foreground" };
                      return (
                        <tr key={f.id} className="border-b border-border hover:bg-muted/30">
                          <td className="px-4 py-3 text-xs text-muted-foreground">#{f.id}</td>
                          <td className="px-4 py-3">{fmtDate(f.due_date)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{fmtDate(f.payment_date)}</td>
                          <td className="px-4 py-3 font-semibold">{fmtBRL(f.value)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${sf.color}`}>{sf.label}</span>
                          </td>
                          <td className="px-4 py-3">
                            {f.status === "A" && (
                              <div className="flex items-center justify-end gap-1">
                                {f.pix_code && (
                                  <button disabled={!!sendingId} onClick={() => handleSendFatura(f, "pix")}
                                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50">
                                    {sendingId === `pix-${f.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} PIX
                                  </button>
                                )}
                                <button disabled={!!sendingId} onClick={() => handleSendFatura(f, "boleto")}
                                  className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50">
                                  {sendingId === `boleto-${f.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Boleto
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Ordens de Serviço ──────────────────────────────── */}
      {tab === "os" && (
        <Card title="Ordens de Serviço" className="overflow-hidden">
          {loadingOS ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Carregando OS...</p>
          ) : ordens.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma OS encontrada</p>
          ) : (
            <div className="divide-y divide-border">
              {ordens.map((o) => {
                const so = STATUS_OS[o.status] || { label: o.status || "—", color: "bg-muted text-muted-foreground" };
                return (
                  <div key={o.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <p className="font-semibold flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-muted-foreground" />
                        OS #{o.id} — {o.subject || "Sem assunto"}
                      </p>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${so.color}`}>{so.label}</span>
                    </div>
                    {o.description && <p className="text-sm text-muted-foreground mb-2">{o.description}</p>}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {o.tech_name      && <span className="flex items-center gap-1"><User className="w-3 h-3" />{o.tech_name}</span>}
                      {o.open_date      && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Abertura: {fmtDate(o.open_date)}</span>}
                      {o.scheduled_date && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Agendada: {fmtDate(o.scheduled_date)}</span>}
                      {o.close_date     && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-600" />Fechada: {fmtDate(o.close_date)}</span>}
                    </div>
                    {o.solution && (
                      <p className="mt-2 text-sm bg-green-50 text-green-800 px-3 py-2 rounded-lg">
                        <strong>Solução:</strong> {o.solution}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── Verificação de Acordo ──────────────────────────── */}
      {tab === "acordo" && (
        <div className="max-w-lg">
          <AgreementCheckPanel
            conversation={{
              id: customer?.id,
              phone: customer?.phone,
              customer_id: customer?.id,
              cpf_cnpj: customer?.cpf_cnpj,
              customer_name: customer?.name,
            }}
            instance={null}
          />
        </div>
      )}
    </PageContainer>
  );
}