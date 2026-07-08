import React, { useEffect, useState } from "react";
import { zapsignApi } from "@/functions/zapsignApi";
import { useToast } from "@/components/ui/use-toast";
import { FileSignature, Loader2, Send, CheckCircle } from "lucide-react";

const DOC_TYPE_LABEL = {
  contrato: "Contrato", termo_adesao: "Termo de Adesão", termo_comodato: "Termo de Comodato",
  termo_permanencia: "Termo de Permanência", aceite_eletronico: "Aceite Eletrônico", aditivo: "Aditivo",
};

export default function ContractTemplatePicker({ conversation }) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);
  const [sentIds, setSentIds] = useState([]);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const res = await zapsignApi({ action: "list_templates" });
      if (res?.data?.success) {
        setTemplates((res.data.data || []).filter((t) => t.active !== false && t.zapsign_template_id));
      }
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(template) {
    if (!conversation?.phone || !conversation?.customer_name) {
      toast({ title: "Conversa sem telefone ou nome do cliente", variant: "destructive" });
      return;
    }
    setSendingId(template.id);
    try {
      const res = await zapsignApi({
        action: "create_manual",
        templateId: template.id,
        customerName: conversation.customer_name,
        customerPhone: conversation.phone,
        sendWhatsApp: true,
      });
      if (res?.data?.success) {
        toast({ title: res.data.data?.whatsapp_sent ? "Documento enviado por WhatsApp!" : "Documento criado com sucesso." });
        setSentIds((prev) => [...prev, template.id]);
      } else {
        toast({ title: res?.data?.error?.message || "Falha ao enviar documento", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao enviar documento", variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando modelos...
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        <FileSignature className="mx-auto mb-2 h-8 w-8 opacity-40" />
        Nenhum modelo de contrato pronto para envio. Configure o ID do template ZapSign em Assinatura de Contratos.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-thin">
      <p className="mb-2 px-1 text-xs font-bold uppercase text-muted-foreground">Enviar contrato para {conversation?.customer_name || "o cliente"}</p>
      <div className="space-y-2">
        {templates.map((t) => {
          const sent = sentIds.includes(t.id);
          const sending = sendingId === t.id;
          return (
            <div key={t.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{DOC_TYPE_LABEL[t.document_type] || t.document_type}</p>
                </div>
                <FileSignature className="h-4 w-4 flex-shrink-0 text-primary" />
              </div>
              <button
                onClick={() => handleSend(t)}
                disabled={sending || Boolean(sendingId)}
                className={`mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                  sent ? "bg-emerald-100 text-emerald-700" : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {sending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...</>
                ) : sent ? (
                  <><CheckCircle className="h-3.5 w-3.5" /> Enviado novamente</>
                ) : (
                  <><Send className="h-3.5 w-3.5" /> Enviar com 1 clique</>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}