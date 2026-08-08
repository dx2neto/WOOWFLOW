import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useConversations, useMessages, useEntityList, useEntityCreate, useEntityUpdate, useEntityBulkCreate, useEntityDelete } from "@/hooks/useEntityQueries";
import { MessageCircle, Headphones, Clock3, CheckCircle, Star, AlertCircle } from "lucide-react";
import { channelTabs, defaultForm, sameMsg } from "@/components/inbox/inboxConstants";
import InboxHeader from "@/components/inbox/InboxHeader";
import ConversationList from "@/components/inbox/ConversationList";
import ChatArea from "@/components/inbox/ChatArea";
import RightPanel from "@/components/inbox/RightPanel";
import MetricsBar from "@/components/inbox/MetricsBar";
import NewConversationModal from "@/components/inbox/modals/NewConversationModal";
import FinalizeModal from "@/components/inbox/modals/FinalizeModal";
import TransferModal from "@/components/inbox/modals/TransferModal";
import ClearConversationsModal from "@/components/inbox/modals/ClearConversationsModal";
import { evolutionApi } from "@/functions/evolutionApi";
import { ixcApi } from "@/functions/ixcApi";
import { serasaApi } from "@/functions/serasaApi";
import { zapsignApi } from "@/functions/zapsignApi";
import { useToast } from "@/components/ui/use-toast";

export default function Inbox() {
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { toast } = useToast();

  // ── React Query: conversas, mensagens, configs, templates, users ──────────
  const { data: conversations = [], isLoading: loading } = useConversations(100);
  const { data: messages = [], isLoading: loadingMessages } = useMessages();
  const { data: configList = [] } = useEntityList("IntegrationConfig", "-updated_at", 200);
  const { data: templates = [] } = useEntityList("MessageTemplate", "name", 100);
  const { data: users = [] } = useEntityList("User", "full_name", 100);

  const convCreate = useEntityCreate("Conversation");
  const convUpdate = useEntityUpdate("Conversation");
  const convBulkCreate = useEntityBulkCreate("Conversation");
  const msgCreate = useEntityCreate("Message");
  const convDeleteMany = useEntityDelete("Conversation");

  // ── Estado local de UI ────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [messageMode, setMessageMode] = useState("reply");
  const [channel, setChannel] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [rightTab, setRightTab] = useState("dados");
  const [actionLoading, setActionLoading] = useState(null);

  // Evolution GO
  const [instances, setInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState(() => localStorage.getItem("evolution_instance") || "");
  const [syncingHistory, setSyncingHistory] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [waResults, setWaResults] = useState([]);
  const [searchingWa, setSearchingWa] = useState(false);
  const [loadingConvsFromWa, setLoadingConvsFromWa] = useState(false);

  // Modais
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [creating, setCreating] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeNote, setFinalizeNote] = useState("");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferSector, setTransferSector] = useState("");
  const [transferAttendant, setTransferAttendant] = useState("");
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  const fileInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const selected = conversations.find((c) => c.id === selectedId);

  const configs = useMemo(() => {
    const map = {};
    configList.forEach((item) => { map[item.service] = item; });
    return map;
  }, [configList]);

  // ── Realtime: invalida cache de conversas ─────────────────────────────────
  useEffect(() => {
    const unsub = base44.entities.Conversation.subscribe(() => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    });
    return unsub;
  }, [qc]);

  // ── Realtime: invalida cache de mensagens da conversa selecionada ──────────
  useEffect(() => {
    if (!selectedId) return;
    const unsub = base44.entities.Message.subscribe((event) => {
      if (event.data.conversation_id !== selectedId) return;
      qc.invalidateQueries({ queryKey: ["messages", selectedId] });
    });
    return unsub;
  }, [selectedId, qc]);

  // ── Abre conversa via ?conversation=ID ────────────────────────────────────
  useEffect(() => {
    const cid = searchParams.get("conversation");
    if (cid && conversations.some((c) => c.id === cid)) setSelectedId(cid);
  }, [conversations, searchParams]);

  // ── Auto-seleciona primeira conversa ──────────────────────────────────────
  useEffect(() => {
    if (!selectedId && conversations.length > 0) setSelectedId(conversations[0].id);
  }, [conversations, selectedId]);

  // ── Marca como lida ao selecionar conversa ─────────────────────────────────
  useEffect(() => {
    if (!selected || !selected.unread) return;
    convUpdate.mutateAsync({ id: selected.id, data: { unread: false } }).catch(() => {});
    if (selected.channel === "whatsapp" && selectedInstance) {
      evolutionApi({ action: "mark_read", phone: selected.phone, instance: selectedInstance, conversation_id: selected.id }).catch(() => {});
    }
  }, [selectedId]);

  // ── Solicita histórico Evolution se não houver mensagens ───────────────────
  useEffect(() => {
    if (!selectedId || loadingMessages || messages.length > 0) return;
    const conv = conversations.find((c) => c.id === selectedId);
    if (conv?.channel === "whatsapp" && conv?.phone) {
      syncEvolutionHistory(conv, false).catch(() => {});
    }
  }, [selectedId, messages, loadingMessages]);

  // ── Scroll automático ─────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Fecha atalhos ao clicar fora ──────────────────────────────────────────
  useEffect(() => {
    if (!showShortcuts) return;
    const handler = (e) => {
      if (!e.target.closest("[data-shortcuts-panel]")) setShowShortcuts(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showShortcuts]);

  // ── Carregar instâncias Evolution Go ──────────────────────────────────────
  const loadInstances = useCallback(async () => {
    try {
      const response = await evolutionApi({ action: "list_instances" });
      const list = response?.data?.instances || [];
      setInstances(list);
      if (list.length > 0 && !selectedInstance) {
        const connected = list.find((i) => ["connected", "open"].includes(i.state));
        const name = (connected || list[0])?.name || "";
        if (name) { setSelectedInstance(name); localStorage.setItem("evolution_instance", name); }
      }
    } catch { setInstances([]); }
  }, [selectedInstance]);

  useEffect(() => { loadInstances(); }, []);

  const handleInstanceChange = (name) => {
    setSelectedInstance(name);
    localStorage.setItem("evolution_instance", name);
  };

  // ── Sincronizar histórico Evolution Go ────────────────────────────────────
  const syncEvolutionHistory = useCallback(async (conv, showToast = true) => {
    if (!conv?.phone) return;
    try {
      const response = await evolutionApi({
        action: "sync_history", phone: conv.phone, conversation_id: conv.id,
        instance: selectedInstance || conv.instance, limit: 100,
      });
      const data = response?.data || {};
      if (showToast) {
        if (!data.success) toast({ title: "Erro ao solicitar histórico", description: data.error, variant: "destructive" });
        else if (data.requested) toast({ title: "Histórico solicitado", description: "Mensagens chegarão via webhook em instantes." });
        else toast({ title: data.note || "Histórico já disponível localmente" });
      }
    } catch {
      if (showToast) toast({ title: "Erro ao sincronizar histórico", variant: "destructive" });
    }
  }, [selectedInstance, toast]);

  // ── Importar conversas do WhatsApp ─────────────────────────────────────────
  const handleLoadWhatsAppConversations = async () => {
    if (!selectedInstance || loadingConvsFromWa) return;
    setLoadingConvsFromWa(true);
    try {
      let entries = [];
      const chatsResp = await evolutionApi({ action: "get_chats", instance: selectedInstance });
      if (chatsResp?.data?.success && Array.isArray(chatsResp.data.chats) && chatsResp.data.chats.length > 0) {
        entries = chatsResp.data.chats.map((c) => ({ jid: c.jid, phone: c.phone, name: c.name, last_message: c.last_message, last_message_time: c.last_message_time }));
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
            return { jid, phone: jid.split("@")[0], name: e.FullName || e.PushName || e.BusinessName || e.name, last_message: null, last_message_time: null };
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
      if (toCreate.length === 0) { toast({ title: "Nenhuma conversa nova encontrada" }); return; }
      await convBulkCreate.mutateAsync(toCreate);
      toast({ title: `${toCreate.length} conversa(s) importada(s) do WhatsApp` });
    } catch {
      toast({ title: "Erro ao carregar conversas", variant: "destructive" });
    } finally { setLoadingConvsFromWa(false); }
  };

  // ── Busca de contatos no WhatsApp ──────────────────────────────────────────
  useEffect(() => {
    const term = query.trim().toLowerCase();
    if (!term || !selectedInstance || ["instagram","facebook","telefone","email"].includes(channel)) {
      setWaResults([]); return;
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
      } catch { setWaResults([]); }
      finally   { setSearchingWa(false); }
    }, 400);
    return () => clearTimeout(timeout);
  }, [query, channel, selectedInstance, conversations]);

  const startConversationFromWa = async (contact) => {
    try {
      const now = new Date().toISOString();
      const created = await convCreate.mutateAsync({
        customer_name: contact.name, phone: contact.phone,
        channel: "whatsapp", instance: selectedInstance, status: "novo", sector: "Atendimento",
        last_message: "Conversa iniciada via busca Evolution Go", last_message_time: now,
      });
      setSelectedId(created.id);
      setQuery(""); setWaResults([]);
    } catch { toast({ title: "Erro ao iniciar conversa", variant: "destructive" }); }
  };

  // ── Enviar mensagem ────────────────────────────────────────────────────────
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

  // ── Enviar mídia ───────────────────────────────────────────────────────────
  const handleSendFile = useCallback(async (file, mediaType) => {
    if (!file || !selected) return;
    if (selected.channel !== "whatsapp") { toast({ title: "Envio de mídia disponível apenas para WhatsApp", variant: "destructive" }); return; }
    if (!selectedInstance) { toast({ title: "Nenhuma instância WhatsApp selecionada", variant: "destructive" }); return; }
    setSendingMedia(true);
    try {
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload  = () => res(String(reader.result || "").split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const type = mediaType || (file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "document");
      const resp = await evolutionApi({ action: "send_media", phone: selected.phone, url: base64, type, filename: file.name, caption: file.name, instance: selectedInstance });
      if (resp?.data?.error || !resp?.data?.success) { toast({ title: "Falha ao enviar arquivo", description: resp?.data?.error, variant: "destructive" }); return; }
      const now = new Date().toISOString();
      const pid = resp?.data?.wa_message_id || resp?.data?.provider_message_id || null;
      await msgCreate.mutateAsync({
        conversation_id: selected.id, content: `[${type}] ${file.name}`, direction: "out", type,
        status: "sent", timestamp: now, sender_name: "Atendente", provider: "evolution_api",
        phone: selected.phone, chat_jid: `${String(selected.phone || "").replace(/\D/g, "")}@s.whatsapp.net`,
        instance_id: selectedInstance || selected.instance || undefined,
        file_name: file.name, mime_type: file.type, caption: file.name,
        ...(type === "image" && base64 ? { media_base64: base64 } : {}),
        ...(pid ? { wa_message_id: pid, provider_message_id: pid } : {}),
      });
      await convUpdate.mutateAsync({ id: selected.id, data: { last_message: `[${type}] ${file.name}`, last_message_time: now, status: "em_atendimento", unread: false } });
      toast({ title: "Arquivo enviado!" });
    } catch { toast({ title: "Erro ao enviar arquivo", variant: "destructive" }); }
    finally { setSendingMedia(false); }
  }, [selected, selectedInstance, toast, msgCreate, convUpdate]);

  const handleAttachClick = () => fileInputRef.current?.click();
  const handleAudioClick  = () => audioInputRef.current?.click();
  const handleFileChange  = (e) => { const f = e.target.files?.[0]; if (f) handleSendFile(f); e.target.value = ""; };
  const handleAudioChange = (e) => { const f = e.target.files?.[0]; if (f) handleSendFile(f, "audio"); e.target.value = ""; };

  const handleWhatsAppCall = useCallback(() => {
    if (!selected?.phone) return;
    window.open(`https://wa.me/${selected.phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer");
  }, [selected]);

  const handleSyncHistoryOnly = useCallback(async () => {
    if (!selected?.phone || syncingHistory) return;
    setSyncingHistory(true);
    try {
      const resp = await evolutionApi({ action: "sync_history", phone: selected.phone, conversation_id: selected.id, instance: selectedInstance || selected.instance, limit: 100 });
      const d = resp?.data || {};
      if (d.requested) toast({ title: "Histórico solicitado", description: "Mensagens chegarão em instantes via webhook." });
      else if (d.error) toast({ title: "Erro ao solicitar histórico", description: d.error, variant: "destructive" });
      else toast({ title: d.note || "Histórico já disponível localmente" });
    } catch { toast({ title: "Erro ao sincronizar histórico", variant: "destructive" }); }
    finally { setSyncingHistory(false); }
  }, [selected, selectedInstance, syncingHistory, toast]);

  // ── FINALIZAR conversa ─────────────────────────────────────────────────────
  const handleFinalize = async () => {
    if (!selected || finalizing) return;
    setFinalizing(true);
    try {
      const now = new Date().toISOString();
      await convUpdate.mutateAsync({ id: selected.id, data: { status: "finalizado", resolved_at: now } });
      if (finalizeNote.trim()) {
        await msgCreate.mutateAsync({
          conversation_id: selected.id, content: `[Encerrado] ${finalizeNote.trim()}`,
          direction: "internal", type: "system", timestamp: now, sender_name: "Sistema",
        });
      }
      setShowFinalizeModal(false);
      setFinalizeNote("");
      toast({ title: "Atendimento finalizado com sucesso!" });
    } catch { toast({ title: "Erro ao finalizar", variant: "destructive" }); }
    finally { setFinalizing(false); }
  };

  // ── TRANSFERIR conversa ────────────────────────────────────────────────────
  const handleTransfer = async () => {
    if (!selected || !transferSector || transferring) return;
    setTransferring(true);
    try {
      const now = new Date().toISOString();
      const attendantName = users.find((u) => u.id === transferAttendant)?.full_name || "";
      await convUpdate.mutateAsync({
        id: selected.id,
        data: {
          sector: transferSector, status: "aguardando_atendimento",
          ...(attendantName ? { attendant_name: attendantName, assigned_user_id: transferAttendant } : { attendant_name: null, assigned_user_id: null }),
        },
      });
      await msgCreate.mutateAsync({
        conversation_id: selected.id,
        content: `[Transferido para setor: ${transferSector}${attendantName ? ` · Atendente: ${attendantName}` : ""}]`,
        direction: "internal", type: "system", timestamp: now, sender_name: "Sistema",
      });
      setShowTransferModal(false);
      setTransferSector(""); setTransferAttendant("");
      toast({ title: `Conversa transferida para ${transferSector}` });
    } catch { toast({ title: "Erro ao transferir", variant: "destructive" }); }
    finally { setTransferring(false); }
  };

  // ── Nova conversa manual ──────────────────────────────────────────────────
  const createConversation = async (event) => {
    event.preventDefault();
    if (!form.customer_name.trim()) return;
    setCreating(true);
    try {
      const now = new Date().toISOString();
      const created = await convCreate.mutateAsync({
        ...form, customer_name: form.customer_name.trim(), phone: form.phone.trim(),
        protocol: `OMNI-${Date.now().toString().slice(-6)}`,
        last_message: "Conversa criada manualmente", last_message_time: now,
        instance: form.channel === "whatsapp" ? selectedInstance : undefined,
      });
      setSelectedId(created.id);
      setShowNewConversation(false);
      setForm(defaultForm);
      toast({ title: "Conversa criada" });
    } catch { toast({ title: "Erro ao criar conversa", variant: "destructive" }); }
    finally { setCreating(false); }
  };

  // ── Limpar todas as conversas ──────────────────────────────────────────────
  const handleClearConversations = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      const convIds = conversations.map((c) => c.id);
      if (convIds.length > 0) {
        await base44.entities.Message.deleteMany({ conversation_id: { $in: convIds } });
        await convDeleteMany.mutateAsync({ id: { $in: convIds } });
      }
      setSelectedId(null);
      setShowClearModal(false);
      toast({ title: `${convIds.length} conversa(s) removida(s)` });
    } catch { toast({ title: "Erro ao limpar conversas", variant: "destructive" }); }
    finally { setClearing(false); }
  };

  // ── Integrações rápidas ────────────────────────────────────────────────────
  const handleQuickIntegration = async (service) => {
    if (!selected) return;
    setActionLoading(service);
    try {
      if (service === "evolution_api") {
        if (selected.channel === "whatsapp" && selected.phone) await syncEvolutionHistory(selected, true);
        else await handleLoadWhatsAppConversations();
      }
      if (service === "ixc_provedor") {
        const resp = await ixcApi({ action: "clientes", search: selected.phone || selected.customer_name, limit: 5 });
        const total = resp?.data?.result?.total || resp?.data?.pagination?.total || 0;
        toast({ title: "Consulta IXC concluída", description: `${total} registro(s) encontrado(s).` });
      }
      if (service === "validacadastro") {
        const cpfCnpj = selected.cpf_cnpj || window.prompt("CPF/CNPJ para consulta Serasa");
        if (!cpfCnpj) return;
        const resp = await serasaApi({ cpfCnpj });
        if (resp?.data?.error) { toast({ title: "Consulta Serasa não concluída", description: resp.data.error, variant: "destructive" }); return; }
        toast({ title: "Consulta Serasa concluída" });
      }
      if (service === "zapsign") {
        const resp = await zapsignApi({ action: "dashboard" });
        const pending = resp?.data?.data?.pending ?? 0;
        toast({ title: "ZapSign consultado", description: `${pending} assinatura(s) pendente(s).` });
      }
    } catch { toast({ title: "Falha na integração", variant: "destructive" }); }
    finally { setActionLoading(null); }
  };

  // ── Dados derivados ────────────────────────────────────────────────────────
  const channelCounts = useMemo(() => {
    const counts = { all: conversations.length };
    for (const c of conversations) counts[c.channel] = (counts[c.channel] || 0) + 1;
    return counts;
  }, [conversations]);

  const metrics = useMemo(() => {
    const active   = conversations.filter((c) => c.status === "em_atendimento").length;
    const waiting  = conversations.filter((c) => ["novo","aguardando_atendimento","aguardando_setor"].includes(c.status)).length;
    const resolved = conversations.filter((c) => ["resolvido","finalizado"].includes(c.status)).length;
    const unread   = conversations.filter((c) => c.unread).length;
    const scores   = conversations.map((c) => Number(c.satisfaction_score)).filter(Boolean);
    const sat      = scores.length ? (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1) : "—";
    return [
      { label: "Total",         value: conversations.length, icon: MessageCircle },
      { label: "Em atendimento",value: active,               icon: Headphones    },
      { label: "Na fila",       value: waiting,              icon: Clock3        },
      { label: "Resolvidas",    value: resolved,             icon: CheckCircle   },
      { label: "Satisfação",    value: sat,                  icon: Star          },
      ...(unread > 0 ? [{ label: "Não lidos", value: unread, icon: AlertCircle }] : []),
    ];
  }, [conversations]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return conversations.filter((conv) => {
      if (channel !== "all" && conv.channel !== channel) return false;
      if (channel === "whatsapp" && selectedInstance && conv.instance && conv.instance !== selectedInstance) return false;
      if (statusFilter !== "all" && conv.status !== statusFilter) return false;
      if (term && ![conv.customer_name, conv.phone, conv.protocol, conv.last_message, conv.city].filter(Boolean).some((v) => String(v).toLowerCase().includes(term))) return false;
      return true;
    });
  }, [channel, conversations, query, statusFilter, selectedInstance]);

  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return templates;
    const t = templateSearch.toLowerCase();
    return templates.filter((tp) => (tp.name || "").toLowerCase().includes(t) || (tp.content || "").toLowerCase().includes(t));
  }, [templates, templateSearch]);

  const availableSectors = useMemo(() => {
    const fromConvs = [...new Set(conversations.map((c) => c.sector).filter(Boolean))];
    const defaults  = ["Atendimento","Suporte Técnico","Financeiro","Comercial","Cobrança","Retenção","NOC"];
    return [...new Set([...fromConvs, ...defaults])];
  }, [conversations]);

  const selectedInstanceState = useMemo(() => {
    const inst = instances.find((i) => i.name === selectedInstance) || instances[0];
    if (!inst) return "disconnected";
    return ["connected","open"].includes(inst.state) ? "connected" : inst.state === "connecting" ? "pending" : instances.length > 0 ? "error" : "disconnected";
  }, [instances, selectedInstance]);

  return (
    <div className="h-full overflow-hidden bg-background flex flex-col">
      <InboxHeader
        instances={instances} selectedInstance={selectedInstance}
        onInstanceChange={handleInstanceChange} onReloadInstances={loadInstances}
        loadingConvsFromWa={loadingConvsFromWa} onLoadWhatsAppConversations={handleLoadWhatsAppConversations}
        onNewConversation={() => setShowNewConversation(true)} onClear={() => setShowClearModal(true)}
        conversationsCount={conversations.length}
        channel={channel} setChannel={setChannel} channelCounts={channelCounts}
        selectedInstanceState={selectedInstanceState}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[360px_minmax(460px,1fr)_340px]">
        <ConversationList
          loading={loading} conversations={conversations} filtered={filtered}
          selectedId={selectedId} onSelect={setSelectedId}
          query={query} setQuery={setQuery}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          channel={channel} channelCounts={channelCounts}
          waResults={waResults} searchingWa={searchingWa}
          startConversationFromWa={startConversationFromWa}
        />

        <ChatArea
          selected={selected} messages={messages} loadingMessages={loadingMessages}
          selectedInstance={selectedInstance}
          syncingHistory={syncingHistory} sending={sending} sendingMedia={sendingMedia}
          messageMode={messageMode} setMessageMode={setMessageMode}
          message={message} setMessage={setMessage}
          onSend={handleSend} onSyncHistory={syncEvolutionHistory}
          onWhatsAppCall={handleWhatsAppCall}
          onAttachClick={handleAttachClick} onAudioClick={handleAudioClick}
          onFileChange={handleFileChange} onAudioChange={handleAudioChange}
          fileInputRef={fileInputRef} audioInputRef={audioInputRef} messagesEndRef={messagesEndRef}
          showShortcuts={showShortcuts} setShowShortcuts={setShowShortcuts}
          templates={templates} filteredTemplates={filteredTemplates}
          templateSearch={templateSearch} setTemplateSearch={setTemplateSearch}
        />

        <RightPanel
          selected={selected} rightTab={rightTab} setRightTab={setRightTab}
          configs={configs} selectedInstanceState={selectedInstanceState}
          actionLoading={actionLoading} handleQuickIntegration={handleQuickIntegration}
          onFinalize={() => setShowFinalizeModal(true)} onTransfer={() => setShowTransferModal(true)}
          onSend={sendMessageContent} sending={sending}
          onSelect={setSelectedId}
        />
      </div>

      <MetricsBar metrics={metrics} />

      <NewConversationModal
        show={showNewConversation} form={form} setForm={setForm}
        onSubmit={createConversation} onClose={() => setShowNewConversation(false)}
        creating={creating} availableSectors={availableSectors} channelTabs={channelTabs}
      />
      <FinalizeModal
        show={showFinalizeModal} selected={selected}
        note={finalizeNote} setNote={setFinalizeNote}
        onConfirm={handleFinalize} onClose={() => setShowFinalizeModal(false)}
        finalizing={finalizing}
      />
      <ClearConversationsModal
        show={showClearModal} count={conversations.length}
        onConfirm={handleClearConversations} onClose={() => setShowClearModal(false)}
        clearing={clearing}
      />
      <TransferModal
        show={showTransferModal} selected={selected}
        sector={transferSector} setSector={setTransferSector}
        attendant={transferAttendant} setAttendant={setTransferAttendant}
        users={users} availableSectors={availableSectors}
        onConfirm={handleTransfer} onClose={() => setShowTransferModal(false)}
        transferring={transferring}
      />
    </div>
  );
}