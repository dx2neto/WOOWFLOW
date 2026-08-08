import { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { evolutionApi } from "@/functions/evolutionApi";
import { useToast } from "@/components/ui/use-toast";

async function uploadFile(file) {
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return file_url;
}

/**
 * Hook que encapsula toda a lógica de Evolution API no Inbox:
 * - Gestão de instâncias (lista, seleção, persistência em localStorage)
 * - Sincronização de histórico de conversas
 * - Busca de contatos no WhatsApp
 * - Importação de conversas do WhatsApp
 * - Envio de mídia (imagem, áudio, documento)
 *
 * @param {object} params
 * @param {array}  params.conversations      - Lista de conversas do React Query
 * @param {object} params.selected            - Conversa selecionada
 * @param {string} params.selectedId           - ID da conversa selecionada
 * @param {function} params.setSelectedId      - Setter do ID selecionado
 * @param {function} params.convCreate         - Mutation de criação de conversa
 * @param {function} params.convUpdate         - Mutation de atualização de conversa
 * @param {function} params.convBulkCreate     - Mutation de criação em massa
 * @param {function} params.msgCreate          - Mutation de criação de mensagem
 */
export function useEvolutionInbox({
  conversations = [],
  selected,
  selectedId,
  setSelectedId,
  convCreate,
  convUpdate,
  convBulkCreate,
  msgCreate,
}) {
  const { toast } = useToast();

  const [instances, setInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState(() => localStorage.getItem("evolution_instance") || "");
  const [syncingHistory, setSyncingHistory] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [waResults, setWaResults] = useState([]);
  const [searchingWa, setSearchingWa] = useState(false);
  const [loadingConvsFromWa, setLoadingConvsFromWa] = useState(false);

  // ── Carregar instâncias ──────────────────────────────────────────────────
  const loadInstances = useCallback(async () => {
    try {
      const response = await evolutionApi({ action: "list_instances" });
      const list = response?.data?.instances || [];
      setInstances(list);
      if (list.length > 0 && !selectedInstance) {
        const connected = list.find((i) => ["connected", "open"].includes(i.state));
        const name = (connected || list[0])?.name || "";
        if (name) {
          setSelectedInstance(name);
          localStorage.setItem("evolution_instance", name);
        }
      }
    } catch {
      setInstances([]);
    }
  }, [selectedInstance]);

  useEffect(() => { loadInstances(); }, []);

  const handleInstanceChange = useCallback((name) => {
    setSelectedInstance(name);
    localStorage.setItem("evolution_instance", name);
  }, []);

  // ── Sincronizar histórico ──────────────────────────────────────────────────
  const syncEvolutionHistory = useCallback(async (conv, showToast = true) => {
    if (!conv?.phone) return;
    try {
      const response = await evolutionApi({
        action: "sync_history",
        phone: conv.phone,
        conversation_id: conv.id,
        instance: selectedInstance || conv.instance,
        limit: 100,
      });
      const data = response?.data || {};
      if (showToast) {
        if (!data.success)
          toast({ title: "Erro ao solicitar histórico", description: data.error, variant: "destructive" });
        else if (data.requested)
          toast({ title: "Histórico solicitado", description: "Mensagens chegarão via webhook em instantes." });
        else toast({ title: data.note || "Histórico já disponível localmente" });
      }
    } catch {
      if (showToast) toast({ title: "Erro ao sincronizar histórico", variant: "destructive" });
    }
  }, [selectedInstance, toast]);

  // ── Importar conversas do WhatsApp ─────────────────────────────────────────
  const handleLoadWhatsAppConversations = useCallback(async () => {
    if (!selectedInstance || loadingConvsFromWa) return;
    setLoadingConvsFromWa(true);
    try {
      let entries = [];
      const chatsResp = await evolutionApi({ action: "get_chats", instance: selectedInstance });
      if (chatsResp?.data?.success && Array.isArray(chatsResp.data.chats) && chatsResp.data.chats.length > 0) {
        entries = chatsResp.data.chats.map((c) => ({
          jid: c.jid, phone: c.phone, name: c.name,
          last_message: c.last_message, last_message_time: c.last_message_time,
        }));
      } else {
        const response = await evolutionApi({ action: "get_contacts", instance: selectedInstance });
        if (response?.data?.error) {
          toast({ title: "Falha ao carregar conversas", description: response.data.error, variant: "destructive" });
          return;
        }
        const raw = response?.data?.contacts || {};
        const rawEntries = Array.isArray(raw) ? raw : Object.entries(raw).map(([jid, info]) => ({ jid, ...info }));
        entries = rawEntries
          .map((e) => {
            const jid = e.jid || e.JID || e.Jid || e.id || "";
            return {
              jid, phone: jid.split("@")[0],
              name: e.FullName || e.PushName || e.BusinessName || e.name,
              last_message: null, last_message_time: null,
            };
          })
          .filter((e) => e.jid.includes("@s.whatsapp.net"));
      }
      const existingPhones = new Set(conversations.map((c) => c.phone));
      const toCreate = entries
        .filter((e) => e.phone && !existingPhones.has(e.phone))
        .map((e) => ({
          customer_name: e.name || e.phone, phone: e.phone,
          channel: "whatsapp", instance: selectedInstance, status: "novo", sector: "Atendimento",
          last_message: e.last_message || null,
          last_message_time: e.last_message_time || new Date().toISOString(),
        }));
      if (toCreate.length === 0) {
        toast({ title: "Nenhuma conversa nova encontrada" });
        return;
      }
      await convBulkCreate.mutateAsync(toCreate);
      toast({ title: `${toCreate.length} conversa(s) importada(s) do WhatsApp` });
    } catch {
      toast({ title: "Erro ao carregar conversas", variant: "destructive" });
    } finally {
      setLoadingConvsFromWa(false);
    }
  }, [selectedInstance, loadingConvsFromWa, conversations, convBulkCreate, toast]);

  // ── Busca de contatos no WhatsApp (debounced) ──────────────────────────────
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("all");

  useEffect(() => {
    const term = query.trim().toLowerCase();
    if (!term || !selectedInstance || ["instagram", "facebook", "telefone", "email"].includes(channel)) {
      setWaResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchingWa(true);
      try {
        const response = await evolutionApi({ action: "get_contacts", instance: selectedInstance });
        const raw = response?.data?.contacts || {};
        const entries = Array.isArray(raw) ? raw : Object.entries(raw).map(([jid, info]) => ({ jid, ...info }));
        const existingPhones = new Set(conversations.map((c) => c.phone));
        const matches = [];
        for (const e of entries) {
          const jid = e.jid || e.JID || e.Jid || e.id || "";
          if (!jid?.includes("@s.whatsapp.net")) continue;
          const phone = jid.split("@")[0];
          if (!phone || existingPhones.has(phone)) continue;
          const name = e.FullName || e.PushName || e.BusinessName || e.name || phone;
          if (!name.toLowerCase().includes(term) && !phone.includes(term)) continue;
          matches.push({ phone, name });
        }
        setWaResults(matches.slice(0, 20));
      } catch {
        setWaResults([]);
      } finally {
        setSearchingWa(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [query, channel, selectedInstance, conversations]);

  const startConversationFromWa = useCallback(async (contact) => {
    try {
      const now = new Date().toISOString();
      const created = await convCreate.mutateAsync({
        customer_name: contact.name, phone: contact.phone,
        channel: "whatsapp", instance: selectedInstance, status: "novo", sector: "Atendimento",
        last_message: "Conversa iniciada via busca Evolution Go", last_message_time: now,
      });
      setSelectedId(created.id);
      setQuery("");
      setWaResults([]);
    } catch {
      toast({ title: "Erro ao iniciar conversa", variant: "destructive" });
    }
  }, [selectedInstance, convCreate, setSelectedId, toast]);

  // ── Enviar mídia ───────────────────────────────────────────────────────────
  const handleSendFile = useCallback(async (file, mediaType) => {
    if (!file || !selected) return;
    if (selected.channel !== "whatsapp") {
      toast({ title: "Envio de mídia disponível apenas para WhatsApp", variant: "destructive" });
      return;
    }
    if (!selectedInstance) {
      toast({ title: "Nenhuma instância WhatsApp selecionada", variant: "destructive" });
      return;
    }
    setSendingMedia(true);
    try {
      const type = mediaType || (file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "document");
      const fileUrl = await uploadFile(file);
      const action = type === "audio" ? "send_audio" : "send_media";
      const resp = await evolutionApi({
        action, phone: selected.phone, url: fileUrl, type,
        filename: file.name, caption: file.name, instance: selectedInstance,
      });
      if (resp?.data?.error || !resp?.data?.success) {
        toast({ title: "Falha ao enviar arquivo", description: resp?.data?.error, variant: "destructive" });
        return;
      }
      const now = new Date().toISOString();
      const pid = resp?.data?.wa_message_id || resp?.data?.provider_message_id || null;
      await msgCreate.mutateAsync({
        conversation_id: selected.id, content: type === "image" ? file.name : `[${type}] ${file.name}`, direction: "out", type,
        status: "sent", timestamp: now, sender_name: "Atendente", provider: "evolution_api",
        phone: selected.phone, chat_jid: `${String(selected.phone || "").replace(/\D/g, "")}@s.whatsapp.net`,
        instance_id: selectedInstance || selected.instance || undefined,
        assigned_user_id: selected.assigned_user_id || null,
        file_name: file.name, mime_type: file.type, caption: file.name, media_url: fileUrl,
        ...(pid ? { wa_message_id: pid, provider_message_id: pid } : {}),
      });
      await convUpdate.mutateAsync({
        id: selected.id,
        data: { last_message: `[${type}] ${file.name}`, last_message_time: now, status: "em_atendimento", unread: false },
      });
      toast({ title: "Arquivo enviado!" });
    } catch {
      toast({ title: "Erro ao enviar arquivo", variant: "destructive" });
    } finally {
      setSendingMedia(false);
    }
  }, [selected, selectedInstance, toast, msgCreate, convUpdate]);

  // ── Estado derivado da instância selecionada ───────────────────────────────
  const selectedInstanceState = useMemo(() => {
    const inst = instances.find((i) => i.name === selectedInstance) || instances[0];
    if (!inst) return "disconnected";
    return ["connected", "open"].includes(inst.state) ? "connected" : inst.state === "connecting" ? "pending" : instances.length > 0 ? "error" : "disconnected";
  }, [instances, selectedInstance]);

  return {
    // Estado
    instances,
    selectedInstance,
    syncingHistory,
    sendingMedia,
    waResults,
    searchingWa,
    loadingConvsFromWa,
    selectedInstanceState,
    query,
    channel,
    // Setters
    setSelectedInstance: handleInstanceChange,
    setQuery,
    setChannel,
    // Handlers
    loadInstances,
    syncEvolutionHistory,
    handleLoadWhatsAppConversations,
    startConversationFromWa,
    handleSendFile,
  };
}