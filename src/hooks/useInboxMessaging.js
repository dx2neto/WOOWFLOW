import { useState, useCallback } from "react";
import { evolutionApi } from "@/functions/evolutionApi";
import { useToast } from "@/components/ui/use-toast";

/**
 * Hook que encapsula a lógica de envio de mensagens do Inbox:
 * - Envio de texto (reply ou nota interna)
 * - Estado da caixa de mensagem
 * - Chamada WhatsApp
 *
 * @param {object} params
 * @param {object} params.selected - Conversa selecionada
 * @param {string} params.selectedInstance - Instância WhatsApp ativa
 * @param {function} params.msgCreate - Mutation de criação de Message
 * @param {function} params.convUpdate - Mutation de update de Conversation
 */
export function useInboxMessaging({ selected, selectedInstance, msgCreate, convUpdate }) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [messageMode, setMessageMode] = useState("reply");

  const sendMessageContent = async (content) => {
    if (!content?.trim() || !selected || sending) return;
    setSending(true);
    try {
      let waMessageId = null;
      if (messageMode === "reply" && selected.channel === "whatsapp") {
        if (!selectedInstance) { toast({ title: "Nenhuma instância WhatsApp selecionada", variant: "destructive" }); return; }
        const resp = await evolutionApi({ action: "send_message", phone: selected.phone, message: content, instance: selectedInstance });
        const d = resp?.data || {};
        if (d.error || !d.success) { toast({ title: "Falha ao enviar", description: d.error || "Verifique se a instância está conectada.", variant: "destructive" }); return; }
        waMessageId = d.wa_message_id || d.provider_message_id || null;
      }
      const now = new Date().toISOString();
      const direction = messageMode === "internal" ? "internal" : "out";
      await msgCreate.mutateAsync({
        conversation_id: selected.id, content, direction, type: "text",
        status: direction === "out" && selected.channel === "whatsapp" ? "sent" : "delivered",
        timestamp: now, sender_name: "Atendente",
        provider: selected.channel === "whatsapp" ? "evolution_api" : selected.channel,
        phone: selected.phone,
        chat_jid: selected.channel === "whatsapp" ? `${String(selected.phone || "").replace(/\D/g, "")}@s.whatsapp.net` : undefined,
        instance_id: selectedInstance || selected.instance || undefined,
        assigned_user_id: selected.assigned_user_id || null,
        ...(waMessageId ? { wa_message_id: waMessageId, provider_message_id: waMessageId } : {}),
      });
      if (direction !== "internal") {
        await convUpdate.mutateAsync({ id: selected.id, data: { last_message: content, last_message_time: now, status: "em_atendimento", unread: false } });
      }
    } catch { toast({ title: "Erro ao enviar mensagem", variant: "destructive" }); }
    finally { setSending(false); }
  };

  const handleSend = async () => {
    const content = message.trim();
    if (!content) return;
    setMessage("");
    await sendMessageContent(content);
  };

  const handleWhatsAppCall = useCallback(() => {
    if (!selected?.phone) return;
    const phone = selected.phone.replace(/\D/g, "");
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `whatsapp://send?phone=${phone}`;
    } else {
      window.open(`https://wa.me/${phone}`, "_blank", "noopener,noreferrer");
    }
  }, [selected]);

  return {
    message, setMessage, sending, messageMode, setMessageMode,
    sendMessageContent, handleSend, handleWhatsAppCall,
  };
}