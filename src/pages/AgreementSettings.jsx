import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { PageContainer, Card } from "@/components/ui/app-card";
import { agreementApi } from "@/functions/agreementApi";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Save, Loader2, Settings, MessageSquare, RefreshCw, CheckCircle } from "lucide-react";

const DEFAULT_SETTINGS = {
  tolerance_days_overdue: 5,
  days_to_mark_broken: 15,
  auto_message_active: "Olá, {nome}. Verificamos que você possui um acordo ativo conosco.\n\nPróxima parcela:\nValor: R$ {valor}\nVencimento: {vencimento}\n\nPara evitar bloqueio ou quebra do acordo, mantenha o pagamento em dia.",
  auto_message_overdue: "Olá, {nome}. Identificamos que existe uma parcela do seu acordo em atraso.\n\nValor: R$ {valor}\nVencimento: {vencimento}\n\nRegularize o quanto antes para evitar a quebra do acordo.",
  auto_message_broken: "Olá, {nome}. Seu acordo consta como quebrado devido ao atraso das parcelas.\n\nPodemos te ajudar com uma nova renegociação. Deseja falar com o setor financeiro?",
  allow_unblock_on_agreement: false,
  require_zapsign: false,
  require_serasa: false,
  send_whatsapp_reminder: true,
  responsible_sector: "",
  default_agent: "",
};

export default function AgreementSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [running, setRunning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    agreementApi({ action: "get_settings" }).then((res) => {
      if (res?.data?.data) setSettings({ ...DEFAULT_SETTINGS, ...res.data.data });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const set = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await agreementApi({ action: "save_settings", data: settings });
      if (res?.data?.success) {
        toast({ title: "Configurações salvas com sucesso" });
      } else {
        toast({ title: res?.data?.error?.message || "Falha ao salvar", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRunVerification = async () => {
    setRunning(true);
    try {
      const res = await agreementApi({ action: "run_verification" });
      if (res?.data?.success) {
        const d = res.data.data;
        toast({ title: `Verificação concluída: ${d.checked} verificados, ${d.updated} atualizados, ${d.broken} quebrados` });
      } else {
        toast({ title: "Falha na verificação", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro na verificação", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/agreements" className="p-2 rounded-lg hover:bg-accent transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><Settings className="w-5 h-5" /> Configurações de Acordo</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Defina regras, tolerâncias e mensagens automáticas</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRunVerification}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Rodar Verificação
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>
        </div>
      </div>

      <div className="space-y-4 max-w-3xl">
        {/* Tolerância */}
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Regras de Status</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Dias de tolerância (acordo vencido)</label>
              <input
                type="number" min={0} max={30}
                value={settings.tolerance_days_overdue}
                onChange={(e) => set("tolerance_days_overdue", parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-xs text-muted-foreground mt-1">Dias após vencimento antes de marcar como "Vencido"</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Dias para marcar como quebrado</label>
              <input
                type="number" min={1} max={90}
                value={settings.days_to_mark_broken}
                onChange={(e) => set("days_to_mark_broken", parseInt(e.target.value) || 15)}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-xs text-muted-foreground mt-1">Dias de atraso para marcar como "Quebrado"</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Setor responsável por renegociação</label>
              <input
                type="text"
                value={settings.responsible_sector || ""}
                onChange={(e) => set("responsible_sector", e.target.value)}
                placeholder="Ex: Financeiro"
                className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Atendente padrão para acordos</label>
              <input
                type="text"
                value={settings.default_agent || ""}
                onChange={(e) => set("default_agent", e.target.value)}
                placeholder="Nome ou ID do atendente"
                className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </Card>

        {/* Funcionalidades */}
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Funcionalidades</h3>
          <div className="space-y-3">
            {[
              { key: "allow_unblock_on_agreement", label: "Permitir desbloqueio mediante acordo", desc: "Clientes com acordo ativo podem ter o serviço desbloqueado" },
              { key: "require_zapsign", label: "Exigir assinatura ZapSign", desc: "Acordo só fica ativo após o cliente assinar o documento" },
              { key: "require_serasa", label: "Exigir validação Serasa antes de criar acordo", desc: "Consulta score Serasa antes de criar o acordo" },
              { key: "send_whatsapp_reminder", label: "Enviar lembrete automático pelo WhatsApp", desc: "Envia mensagem no WhatsApp ao rodar a verificação" },
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  checked={!!settings[key]}
                  onChange={(e) => set(key, e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-primary"
                />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </Card>

        {/* Mensagens automáticas */}
        <Card className="p-5">
          <h3 className="font-semibold mb-1 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Mensagens Automáticas</h3>
          <p className="text-xs text-muted-foreground mb-4">Use {"{nome}"}, {"{valor}"} e {"{vencimento}"} como variáveis</p>
          <div className="space-y-4">
            {[
              { key: "auto_message_active",  label: "Mensagem para acordo ATIVO" },
              { key: "auto_message_overdue", label: "Mensagem para acordo VENCIDO" },
              { key: "auto_message_broken",  label: "Mensagem para acordo QUEBRADO" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>
                <textarea
                  rows={4}
                  value={settings[key] || ""}
                  onChange={(e) => set(key, e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                />
              </div>
            ))}
          </div>
        </Card>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Salvar Configurações
          </button>
        </div>
      </div>
    </PageContainer>
  );
}
