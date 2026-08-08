import { useState, useRef, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { evolutionApi } from "@/functions/evolutionApi";

/**
 * Hook que encapsula toda a lógica de envio de mensagens no Inbox:
 * - Envio de texto (reply / internal)
 * - Anexos de mídia (imagem, áudio, documento) delegados ao hook de Evolution
 * - Estado de envio e modo de mensagem
 *
 * @param {object} params
 * @param {object} params.selected           - Conversa selecionada
 * @param {string} params.selectedInstance    - Instância WhatsApp ativa
 * @param {function} params.msgCreate         - Mutation de criação de mensagem
 * @param {function} params.convUpdate        - Mutation de atualização de conversa
 */
export function useInboxMessaging({ selected, selectedInstance, msgCreate, convUpdate, handleSendFile }) {
  const { toast } = useToast();

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [messageMode, setMessageMode] = useState("reply");

  const fileInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const sendMessageContent = useCallback(async (content) => {
    if (!content?.trim() || !selected || sending) return;
    setSending(true);
    try {
      let waMessageId = null;
      if (messageMode === "reply" && selected.channel === "whatsapp") {
        if (!selectedInstance) {
          toast({ title: "Nenhuma instância WhatsApp selecionada", variant: "destructive" });
          return;
        }
        const resp = await evolutionApi({ action: "send_message", phone: selected.phone, message: content, instance: selectedInstance });
        const d = resp?.data || {};
        if (d.error || !d.success) {
          toast({ title: "Falha ao enviar", description: d.error || "Verifique se a instância está conectada.", variant: "destructive" });
          return;
        }
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
        ...(waMessageId ? { wa_message_id: waMessageId, provider_message_id: waMessageId } : {}),
      });
      if (direction !== "internal") {
        await convUpdate.mutateAsync({ id: selected.id, data: { last_message: content, last_message_time: now, status: "em_atendimento", unread: false } });
      }
    } catch {
      toast({ title: "Erro ao enviar mensagem", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }, [selected, selectedInstance, messageMode, sending, msgCreate, convUpdate, toast]);

  const handleSend = useCallback(async () => {
    const content = message.trim();
    if (!content) return;
    setMessage("");
    await sendMessageContent(content);
  }, [message, sendMessageContent]);

  const handleAttachClick = useCallback(() => fileInputRef.current?.click(), []);
  const handleAudioClick = useCallback(() => audioInputRef.current?.click(), []);
  const handleFileChange = useCallback((e) => {
    const f = e.target.files?.[0];
    if (f && handleSendFile) handleSendFile(f);
    e.target.value = "";
  }, [handleSendFile]);

  const handleAudioChange = useCallback((e) => {
    const f = e.target.files?.[0];
    if (f && handleSendFile) handleSendFile(f, "audio");
    e.target.value = "";
  }, [handleSendFile]);

  return {
    message, setMessage,
    sending, setSending,
    messageMode, setMessageMode,
    fileInputRef, audioInputRef, messagesEndRef,
    handleAttachClick, handleAudioClick, handleFileChange, handleAudioChange,
    sendMessageContent, handleSend,
  };
}