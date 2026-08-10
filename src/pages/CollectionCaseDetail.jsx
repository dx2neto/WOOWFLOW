import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { PageContainer, Card } from "@/components/ui/app-card";
import { collectionsApi } from "@/functions/collectionsApi";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft, Clock, PhoneCall, CalendarClock, Handshake, CheckCircle, XCircle,
  User, DollarSign, History, Loader2, Send, Plus,
} from "lucide-react";

const STATUS_CONFIG = {
  aberto:              { label: "Aberto",             color: "bg-gray-100 text-gray-600",     icon: Clock },
  em_contato:          { label: "Em Contato",         color: "bg-blue-100 text-blue-700",     icon: PhoneCall },
  promessa_pagamento:  { label: "Promessa de Pgto.",  color: "bg-amber-100 text-amber-700",   icon: CalendarClock },
  negociando:          { label: "Negociando",         color: "bg-purple-100 text-purple-700", icon: Handshake },
  pago:                { label: "Pago",               color: "bg-green-100 text-green-700",   icon: CheckCircle },
  perdido:             { label: "Perdido",            color: "bg-red-100 text-red-700",       icon: XCircle },
};

const CHANNEL_LABEL = { whatsapp: "WhatsApp", call: "Ligação", email: "E-mail", manual: "Manual" };
const TYPE_LABEL = { lembrete: "Lembrete", oferta_negociacao: "Oferta de Negociação", contato_manual: "Contato Manual", follow_up_promessa: "Follow-up de Promessa" };
const RESULT_LABEL = { enviado: "Enviado", falha: "Falha", sem_resposta: "Sem Resposta", promessa: "Promessa", recusa: "Recusa" };

const fmtBRL  = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("pt-BR") : "—";

export default function CollectionCaseDetail() {
  const { id } = useParams();
  const { toast } = useToast();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    channel: "manual", type: "contato_manual", result: "enviado",
    message: "", send_whatsapp: false, new_status: "", next_action_date: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await collectionsApi({ action: "get_case", caseId: id });
      if (res?.data?.data) setData(res.data.data);
      else toast({ title: "Caso não encontrado", variant: "destructive" });
    } catch {
      toast({ title: "Erro ao carregar caso", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const collectionCase = data?.case;
  const attempts = data?.attempts || [];

  const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.aberto;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${cfg.color}`}>
        <Icon className="w-4 h-4" /> {cfg.label}
      </span>
    );
  };

  const handleLogAttempt = async () => {
    if (form.channel === "whatsapp" && form.send_whatsapp && !form.message) {
      toast({ title: "Mensagem é obrigatória para envio via WhatsApp", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await collectionsApi({
        action: "log_attempt",
        caseId: id,
        data: {
          channel: form.channel,
          type: form.type,
          result: form.result,
          message: form.message || undefined,
          send_whatsapp: form.channel === "whatsapp" && form.send_whatsapp,
          new_status: form.new_status || undefined,
          next_action_date: form.next_action_date || undefined,
        },
      });
      if (res?.data?.success) {
        toast({ title: "Tentativa registrada" });
        setShowForm(false);
        setForm({ channel: "manual", type: "contato_manual", result: "enviado", message: "", send_whatsapp: false, new_status: "", next_action_date: "" });
        load();
      } else {
        toast({ title: res?.data?.error?.message || "Falha ao registrar tentativa", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao registrar tentativa", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  if (!collectionCase) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p>Caso de cobrança não encontrado</p>
          <Link to="/central-cobranca" className="mt-4 text-primary text-sm hover:underline">← Voltar</Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/central-cobranca" className="p-2 rounded-lg hover:bg-accent transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{collectionCase.customer_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={collectionCase.status} />
              {collectionCase.days_late > 0 && (
                <span className="text-xs text-red-600 font-medium">{collectionCase.days_late} dias em atraso</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Registrar Tentativa
        </button>
      </div>

      {showForm && (
        <Card className="p-4 mb-6">
          <h3 className="font-semibold text-sm mb-3">Nova Tentativa</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Canal</label>
              <select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))} className="w-full px-3 py-2 text-sm border rounded-lg bg-background">
                {Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Tipo</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 text-sm border rounded-lg bg-background">
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Resultado</label>
              <select value={form.result} onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))} className="w-full px-3 py-2 text-sm border rounded-lg bg-background">
                {Object.entries(RESULT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Novo Status (opcional)</label>
              <select value={form.new_status} onChange={(e) => setForm((f) => ({ ...f, new_status: e.target.value }))} className="w-full px-3 py-2 text-sm border rounded-lg bg-background">
                <option value="">Manter atual</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Mensagem / Observação</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Próxima Ação</label>
              <input
                type="date"
                value={form.next_action_date}
                onChange={(e) => setForm((f) => ({ ...f, next_action_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-background"
              />
              {form.channel === "whatsapp" && (
                <label className="flex items-center gap-2 mt-3 text-sm">
                  <input type="checkbox" checked={form.send_whatsapp} onChange={(e) => setForm((f) => ({ ...f, send_whatsapp: e.target.checked }))} />
                  Enviar mensagem via WhatsApp agora
                </label>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLogAttempt}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Salvar
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-accent transition-colors">
              Cancelar
            </button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Dados do Cliente</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Nome</dt><dd className="font-medium">{collectionCase.customer_name || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Telefone</dt><dd>{collectionCase.customer_phone || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">CPF/CNPJ</dt><dd>{collectionCase.customer_cpf_cnpj || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Cidade</dt><dd>{collectionCase.customer_city || "—"}</dd></div>
          </dl>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Dados Financeiros</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Valor Original</dt><dd className="font-mono">{fmtBRL(collectionCase.original_amount)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Valor Atual</dt><dd className="font-mono font-semibold text-primary">{fmtBRL(collectionCase.current_amount)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Vencimento</dt><dd>{fmtDate(collectionCase.due_date)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Próxima Ação</dt><dd>{fmtDate(collectionCase.next_action_date)}</dd></div>
            <div className="flex justify-between border-t pt-2"><dt className="text-muted-foreground font-medium">Tentativas</dt><dd className="font-bold">{collectionCase.attempts_count || 0}</dd></div>
          </dl>
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b flex items-center gap-2">
          <History className="w-4 h-4" />
          <h3 className="font-semibold text-sm">Histórico de Tentativas</h3>
        </div>
        {attempts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <History className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">Nenhuma tentativa registrada ainda</p>
          </div>
        ) : (
          <div className="divide-y">
            {attempts.map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${a.result === "enviado" || a.result === "promessa" ? "bg-green-400" : a.result === "falha" || a.result === "recusa" ? "bg-red-400" : "bg-amber-400"}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {CHANNEL_LABEL[a.channel] || a.channel} — {TYPE_LABEL[a.type] || a.type}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{RESULT_LABEL[a.result] || a.result}</span>
                  </p>
                  {a.message && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">{a.message}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtDateTime(a.created_date)}{a.performed_by ? ` · ${a.performed_by}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
