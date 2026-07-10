import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ChannelBadge, PriorityBadge, StatusBadge } from "@/components/Badges";
import AgreementCheckPanel from "@/components/agreements/AgreementCheckPanel";
import QuickReplyPanel from "@/components/inbox/QuickReplyPanel";
import ContractTemplatePicker from "@/components/inbox/ContractTemplatePicker";
import CustomerHistoryPanel from "@/components/inbox/CustomerHistoryPanel";
import WhatsAppSearchResults from "@/components/inbox/WhatsAppSearchResults";
import { evolutionApi } from "@/functions/evolutionApi";
import { ixcApi } from "@/functions/ixcApi";
import { serasaApi } from "@/functions/serasaApi";
import { zapsignApi } from "@/functions/zapsignApi";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertCircle, AtSign, Bot, CheckCircle, ChevronDown, CirclePlus, Clock3,
  Database, FileSignature, Filter, Camera, Headphones, Image as ImageIcon,
  Mail, Mic, Video, MessageCircle, MessageSquare, MoreHorizontal, Paperclip,
  Phone, RefreshCw, Search, Send, ShieldCheck, Sparkles, Star, Tag, Zap,
  X, UserCheck, ArrowRightLeft, StickyNote, CheckCheck,
} from "lucide-react";

// ─── Constantes ────────────────────────────────────────────────────────────────
const channelTabs = [
  { key: "all",          label: "Todos",        icon: Headphones,     className: "text-violet-600" },
  { key: "whatsapp",     label: "WhatsApp",      icon: MessageCircle,  className: "text-green-600"  },
  { key: "telefone",     label: "PABX / URA",    icon: Phone,          className: "text-indigo-600" },
  { key: "instagram",    label: "Instagram",     icon: Camera,         className: "text-pink-600"   },
  { key: "facebook",     label: "Facebook",      icon: AtSign,         className: "text-blue-600"   },
  { key: "chat_interno", label: "Chat interno",  icon: MessageSquare,  className: "text-amber-600"  },
  { key: "chat_externo", label: "Chat externo",  icon: MessageSquare,  className: "text-purple-600" },
  { key: "telegram",     label: "Telegram",      icon: Send,           className: "text-sky-600"    },
  { key: "email",        label: "E-mail",        icon: Mail,           className: "text-orange-600" },
];

const statusFilters = [
  { key: "all",                   label: "Todos"       },
  { key: "novo",                  label: "Novos"       },
  { key: "aguardando_atendimento",label: "Fila"        },
  { key: "em_atendimento",        label: "Atendimento" },
  { key: "aguardando_cliente",    label: "Cliente"     },
  { key: "resolvido",             label: "Resolvidos"  },
];

const integrations = [
  { service: "evolution_api",  label: "Evolution Go", icon: MessageCircle, actionLabel: "Sincronizar WhatsApp" },
  { service: "ixc_provedor",   label: "IXC",          icon: Database,      actionLabel: "Consultar cliente"    },
  { service: "validacadastro", label: "Serasa",        icon: ShieldCheck,   actionLabel: "Validar CPF/CNPJ"    },
  { service: "zapsign",        label: "ZapSign",       icon: FileSignature, actionLabel: "Checar assinatura"   },
];

const defaultForm = {
  customer_name: "", phone: "", channel: "whatsapp",
  status: "novo", priority: "media", sector: "Atendimento",
};

const statusTone = {
  connected:    "bg-emerald-100 text-emerald-700",
  pending:      "bg-amber-100  text-amber-700",
  error:        "bg-red-100    text-red-700",
  disconnected: "bg-muted      text-muted-foreground",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(0, 2)
    .map((p) => p[0]).join("").toUpperCase() || "?";
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function statusLabel(s) {
  return { connected: "Conectado", pending: "Pendente", error: "Erro", disconnected: "Pendente" }[s] || "Pendente";
}

function sameMsg(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;
  if (a.wa_message_id && b.wa_message_id && a.wa_message_id === b.wa_message_id) return true;
  if (a.provider_message_id && b.provider_message_id && a.provider_message_id === b.provider_message_id) return true;
  return false;
}

// ─── Componente MessageBubble ──────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isOut      = msg.direction === "out";
  const isInternal = msg.direction === "internal";
  const msgType    = msg.type || "text";
  const isImage    = msgType === "image" || (msg.media_base64 && !["audio","video","document"].includes(msgType));
  const isAudio    = msgType === "audio";
  const isVideo    = msgType === "video";
  const isDocument = msgType === "document";
  const hasMedia   = isImage || isAudio || isVideo || isDocument;
  const imageSrc   = msg.media_url || (msg.media_base64 ? `data:${msg.mime_type || "image/jpeg"};base64,${msg.media_base64}` : "");

  if (isInternal) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[85%] rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <StickyNote className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">Nota interna</span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-amber-900 leading-relaxed">{msg.content}</p>
          <p className="mt-1 text-right text-[11px] text-amber-600">{msg.sender_name} · {formatTime(msg.timestamp)}</p>
        </div>
      </div>
    );
  }

  const bubbleClass = `max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm ${
    isOut ? "bg-primary text-primary-foreground" : "border border-border bg-card"
  }`;
  const metaClass = `text-[11px] ${isOut ? "text-primary-foreground/70" : "text-muted-foreground"}`;

  // Indica status de entrega da mensagem
  const DeliveryIcon = () => {
    if (!isOut) return null;
    if (msg.status === "read")       return <CheckCheck className="h-3.5 w-3.5 text-blue-400" />;
    if (msg.status === "delivered")  return <CheckCheck className="h-3.5 w-3.5 text-primary-foreground/70" />;
    return <CheckCircle className="h-3.5 w-3.5 text-primary-foreground/50" />;
  };

  return (
    <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
      <div className={bubbleClass}>
        {isImage && imageSrc ? (
          <img src={imageSrc} alt="imagem" className="mb-1 max-h-64 max-w-full rounded-xl object-cover cursor-pointer" />
        ) : isImage ? (
          <div className="mb-1 flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2">
            <ImageIcon className="h-5 w-5 shrink-0" /><span className="text-sm">Imagem</span>
          </div>
        ) : null}

        {isAudio && (msg.media_url ? (
          <audio controls src={msg.media_url} className="mb-1 max-w-full" />
        ) : (
          <div className="mb-1 flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2">
            <Mic className="h-5 w-5 shrink-0" /><span className="text-sm">{msg.file_name || "Áudio"}</span>
          </div>
        ))}

        {isVideo && (msg.media_url ? (
          <video controls src={msg.media_url} className="mb-1 max-h-60 max-w-full rounded-xl" />
        ) : (
          <div className="mb-1 flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2">
            <Video className="h-5 w-5 shrink-0" /><span className="text-sm">{msg.file_name || "Vídeo"}</span>
          </div>
        ))}

        {isDocument && (
          <a href={msg.media_url || undefined} target={msg.media_url ? "_blank" : undefined} rel="noreferrer"
            className="mb-1 flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2 hover:bg-black/20">
            <Paperclip className="h-5 w-5 shrink-0" /><span className="text-sm">{msg.file_name || "Documento"}</span>
          </a>
        )}

        {msg.content && !["[image]","[video]","[audio]","[document]","[mídia]","[mensagem]"].includes(msg.content) && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
        )}
        {!hasMedia && !msg.content && (
          <p className="italic text-sm opacity-60">[mensagem sem conteúdo]</p>
        )}

        <div className="mt-1 flex items-center justify-end gap-1">
          {msg.sender_name && !isOut && <span className={metaClass}>{msg.sender_name} ·</span>}
          <span className={metaClass}>{formatTime(msg.timestamp)}</span>
          <DeliveryIcon />
        </div>
      </div>
    </div>
  );
}


// ─── Componente principal ──────────────────────────────────────────────────────
export default function Inbox() {
  const [searchParams] = useSearchParams();

  // Conversas e mensagens
  const [conversations, setConversations]           = useState([]);
  const [loading, setLoading]                       = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [selectedId, setSelectedId]                 = useState(null);
  const [messages, setMessages]                     = useState([]);
  const [loadingMessages, setLoadingMessages]       = useState(false);

  // Input de mensagem
  const [message, setMessage]       = useState("");
  const [sending, setSending]       = useState(false);
  const [messageMode, setMessageMode] = useState("reply"); // "reply" | "internal"

  // Filtros de lista
  const [channel, setChannel]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery]       = useState("");

  // Evolution GO
  const [instances, setInstances]           = useState([]);
  const [selectedInstance, setSelectedInstance] = useState(() => localStorage.getItem("evolution_instance") || "");
  const [syncingHistory, setSyncingHistory] = useState(false);
  const [sendingMedia, setSendingMedia]     = useState(false);
  const [waResults, setWaResults]           = useState([]);
  const [searchingWa, setSearchingWa]       = useState(false);
  const [loadingConvsFromWa, setLoadingConvsFromWa] = useState(false);

  // Painel direito
  const [rightTab, setRightTab] = useState("dados");
  const [configs, setConfigs]   = useState({});
  const [actionLoading, setActionLoading] = useState(null);

  // Modal nova conversa
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [form, setForm]     = useState(defaultForm);
  const [creating, setCreating] = useState(false);

  // ── NOVOS: Finalizar ─────────────────────────────────────────────────────────
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizing, setFinalizing]               = useState(false);
  const [finalizeNote, setFinalizeNote]           = useState("");

  // ── NOVOS: Transferir ────────────────────────────────────────────────────────
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferring, setTransferring]           = useState(false);
  const [transferSector, setTransferSector]       = useState("");
  const [transferAttendant, setTransferAttendant] = useState("");
  const [users, setUsers]                         = useState([]);

  // ── NOVOS: Atalhos (templates) ───────────────────────────────────────────────
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [templates, setTemplates]         = useState([]);
  const [templateSearch, setTemplateSearch] = useState("");

  const fileInputRef  = useRef(null);
  const audioInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const { toast }     = useToast();


  // ── Efeitos de inicialização ──────────────────────────────────────────────
  useEffect(() => {
    loadConversations();
    loadInstances();
    loadIntegrationConfigs();
    base44.entities.MessageTemplate.list("name", 100).then(setTemplates).catch(() => {});
    base44.entities.User.list("full_name", 100).then(setUsers).catch(() => {});
  }, []);

  // Realtime: subscribe a novas conversas
  useEffect(() => {
    const unsub = base44.entities.Conversation.subscribe((event) => {
      setConversations((prev) => {
        if (event.type === "create") return [event.data, ...prev.filter((c) => c.id !== event.data.id)];
        if (event.type === "update") return prev.map((c) => c.id === event.data.id ? event.data : c);
        if (event.type === "delete") return prev.filter((c) => c.id !== event.data.id);
        return prev;
      });
    });
    return unsub;
  }, []);

  // Abre conversa via ?conversation=ID
  useEffect(() => {
    const cid = searchParams.get("conversation");
    if (cid && conversations.some((c) => c.id === cid)) setSelectedId(cid);
  }, [conversations, searchParams]);

  // Carrega mensagens ao trocar de conversa
  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId]);

  // Realtime: subscribe a novas mensagens da conversa selecionada
  useEffect(() => {
    if (!selectedId) return;
    const unsub = base44.entities.Message.subscribe((event) => {
      if (event.data.conversation_id !== selectedId) return;
      setMessages((prev) => {
        if (event.type === "create") return prev.some((m) => sameMsg(m, event.data)) ? prev : [...prev, event.data];
        if (event.type === "update") return prev.map((m) => m.id === event.data.id ? event.data : m);
        if (event.type === "delete") return prev.filter((m) => m.id !== event.data.id);
        return prev;
      });
    });
    return unsub;
  }, [selectedId]);

  // Scroll automático para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fecha atalhos ao clicar fora
  useEffect(() => {
    if (!showShortcuts) return;
    const handler = (e) => {
      if (!e.target.closest("[data-shortcuts-panel]")) setShowShortcuts(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showShortcuts]);


  // ── Carregar conversas ────────────────────────────────────────────────────
  const loadConversations = async () => {
    try {
      const data = await base44.entities.Conversation.list("-last_message_time", 100);
      setConversations(data);
      if (data.length > 0) setSelectedId((cur) => cur || data[0].id);
    } catch { setConversations([]); }
    finally   { setLoading(false); }
  };

  // ── Carregar mensagens ────────────────────────────────────────────────────
  const loadMessages = async (conversationId) => {
    setLoadingMessages(true);
    try {
      const data = await base44.entities.Message.filter({ conversation_id: conversationId }, "timestamp");
      setMessages(data);
      // Sem mensagens locais → pede histórico via Evolution Go
      if (data.length === 0) {
        const conv = conversations.find((c) => c.id === conversationId);
        if (conv?.channel === "whatsapp" && conv?.phone) {
          syncEvolutionHistory(conv, false).catch(() => {});
        }
      }
      // Marca como lida
      const conv = conversations.find((c) => c.id === conversationId);
      if (conv?.unread) {
        base44.entities.Conversation.update(conversationId, { unread: false }).catch(() => {});
        setConversations((prev) => prev.map((c) => c.id === conversationId ? { ...c, unread: false } : c));
        // Também marca como lida no WhatsApp
        if (conv.channel === "whatsapp" && selectedInstance) {
          evolutionApi({ action: "mark_read", phone: conv.phone, instance: selectedInstance, conversation_id: conversationId }).catch(() => {});
        }
      }
    } catch { setMessages([]); }
    finally   { setLoadingMessages(false); }
  };

  // ── Sincronizar histórico Evolution Go ───────────────────────────────────
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
        if (!data.success) {
          toast({ title: "Erro ao solicitar histórico", description: data.error, variant: "destructive" });
        } else if (data.requested) {
          toast({ title: "Histórico solicitado", description: "Mensagens chegarão via webhook em instantes." });
        } else {
          toast({ title: data.note || "Histórico já disponível localmente" });
        }
      }
    } catch {
      if (showToast) toast({ title: "Erro ao sincronizar histórico", variant: "destructive" });
    }
  }, [selectedInstance, toast]);

  // ── Carregar instâncias Evolution Go ─────────────────────────────────────
  const loadInstances = async () => {
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
  };

  const loadIntegrationConfigs = async () => {
    try {
      const data = await base44.entities.IntegrationConfig.list();
      setConfigs(Object.fromEntries(data.map((item) => [item.service, item])));
    } catch { setConfigs({}); }
  };

  const handleInstanceChange = (name) => {
    setSelectedInstance(name);
    localStorage.setItem("evolution_instance", name);
  };


  // ── Importar conversas do WhatsApp ────────────────────────────────────────
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
      const created = await base44.entities.Conversation.bulkCreate(toCreate);
      setConversations((prev) => [...created, ...prev]);
      toast({ title: `${created.length} conversa(s) importada(s) do WhatsApp` });
    } catch {
      toast({ title: "Erro ao carregar conversas", variant: "destructive" });
    } finally { setLoadingConvsFromWa(false); }
  };

  // ── Busca de contatos no WhatsApp (search) ────────────────────────────────
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
      const created = await base44.entities.Conversation.create({
        customer_name: contact.name, phone: contact.phone,
        channel: "whatsapp", instance: selectedInstance, status: "novo", sector: "Atendimento",
        last_message: "Conversa iniciada via busca Evolution Go", last_message_time: now,
      });
      setConversations((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setQuery(""); setWaResults([]);
    } catch { toast({ title: "Erro ao iniciar conversa", variant: "destructive" }); }
  };


  // ── Enviar mensagem ───────────────────────────────────────────────────────
  const sendMessageContent = async (content) => {
    if (!content?.trim() || !selected || sending) return;
    setSending(true);
    try {
      let waMessageId = null;

      if (messageMode === "reply" && selected.channel === "whatsapp") {
        if (!selectedInstance) {
          toast({ title: "Nenhuma instância WhatsApp selecionada", variant: "destructive" }); return;
        }
        const resp = await evolutionApi({ action: "send_message", phone: selected.phone, message: content, instance: selectedInstance });
        const d = resp?.data || {};
        if (d.error || !d.success) {
          toast({ title: "Falha ao enviar", description: d.error || "Verifique se a instância está conectada.", variant: "destructive" }); return;
        }
        waMessageId = d.wa_message_id || d.provider_message_id || null;
      }

      const now = new Date().toISOString();
      const direction = messageMode === "internal" ? "internal" : "out";
      const newMsg = await base44.entities.Message.create({
        conversation_id: selected.id,
        content,
        direction,
        type: "text",
        status: direction === "out" && selected.channel === "whatsapp" ? "sent" : "delivered",
        timestamp: now,
        sender_name: "Atendente",
        provider: selected.channel === "whatsapp" ? "evolution_go" : selected.channel,
        phone: selected.phone,
        chat_jid: selected.channel === "whatsapp" ? `${String(selected.phone || "").replace(/\D/g, "")}@s.whatsapp.net` : undefined,
        instance_id: selectedInstance || selected.instance || undefined,
        ...(waMessageId ? { wa_message_id: waMessageId, provider_message_id: waMessageId } : {}),
      });

      setMessages((prev) => [...prev, newMsg]);

      if (direction !== "internal") {
        await base44.entities.Conversation.update(selected.id, { last_message: content, last_message_time: now, status: "em_atendimento", unread: false });
        setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, last_message: content, last_message_time: now, status: "em_atendimento", unread: false } : c));
      }
    } catch { toast({ title: "Erro ao enviar mensagem", variant: "destructive" }); }
    finally   { setSending(false); }
  };

  const handleSend = async () => {
    const content = message.trim();
    if (!content) return;
    setMessage("");
    await sendMessageContent(content);
  };

  // ── Enviar mídia ──────────────────────────────────────────────────────────
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
      if (resp?.data?.error || !resp?.data?.success) {
        toast({ title: "Falha ao enviar arquivo", description: resp?.data?.error, variant: "destructive" }); return;
      }
      const now = new Date().toISOString();
      const pid = resp?.data?.wa_message_id || resp?.data?.provider_message_id || null;
      const newMsg = await base44.entities.Message.create({
        conversation_id: selected.id, content: `[${type}] ${file.name}`, direction: "out", type,
        status: "sent", timestamp: now, sender_name: "Atendente", provider: "evolution_go",
        phone: selected.phone, chat_jid: `${String(selected.phone || "").replace(/\D/g, "")}@s.whatsapp.net`,
        instance_id: selectedInstance || selected.instance || undefined,
        file_name: file.name, mime_type: file.type, caption: file.name,
        ...(type === "image" && base64 ? { media_base64: base64 } : {}),
        ...(pid ? { wa_message_id: pid, provider_message_id: pid } : {}),
      });
      setMessages((prev) => [...prev, newMsg]);
      await base44.entities.Conversation.update(selected.id, { last_message: `[${type}] ${file.name}`, last_message_time: now, status: "em_atendimento", unread: false });
      setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, last_message: `[${type}] ${file.name}`, last_message_time: now } : c));
      toast({ title: "Arquivo enviado!" });
    } catch { toast({ title: "Erro ao enviar arquivo", variant: "destructive" }); }
    finally   { setSendingMedia(false); }
  }, [selected, selectedInstance, toast]);

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


  // ── FINALIZAR conversa ────────────────────────────────────────────────────
  const handleFinalize = async () => {
    if (!selected || finalizing) return;
    setFinalizing(true);
    try {
      const now = new Date().toISOString();
      await base44.entities.Conversation.update(selected.id, {
        status: "finalizado",
        resolved_at: now,
      });
      // Salva nota de encerramento se preenchida
      if (finalizeNote.trim()) {
        await base44.entities.Message.create({
          conversation_id: selected.id, content: `[Encerrado] ${finalizeNote.trim()}`,
          direction: "internal", type: "system", timestamp: now, sender_name: "Sistema",
        });
      }
      setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, status: "finalizado" } : c));
      setShowFinalizeModal(false);
      setFinalizeNote("");
      toast({ title: "Atendimento finalizado com sucesso!" });
    } catch { toast({ title: "Erro ao finalizar", variant: "destructive" }); }
    finally { setFinalizing(false); }
  };

  // ── TRANSFERIR conversa ───────────────────────────────────────────────────
  const handleTransfer = async () => {
    if (!selected || !transferSector || transferring) return;
    setTransferring(true);
    try {
      const now = new Date().toISOString();
      const attendantName = users.find((u) => u.id === transferAttendant)?.full_name || "";
      await base44.entities.Conversation.update(selected.id, {
        sector: transferSector,
        status: "aguardando_atendimento",
        ...(attendantName ? { attendant_name: attendantName, assigned_user_id: transferAttendant } : { attendant_name: null, assigned_user_id: null }),
      });
      await base44.entities.Message.create({
        conversation_id: selected.id,
        content: `[Transferido para setor: ${transferSector}${attendantName ? ` · Atendente: ${attendantName}` : ""}]`,
        direction: "internal", type: "system", timestamp: now, sender_name: "Sistema",
      });
      setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, sector: transferSector, status: "aguardando_atendimento", attendant_name: attendantName || null } : c));
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
      const created = await base44.entities.Conversation.create({
        ...form,
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        protocol: `OMNI-${Date.now().toString().slice(-6)}`,
        last_message: "Conversa criada manualmente",
        last_message_time: now,
        instance: form.channel === "whatsapp" ? selectedInstance : undefined,
      });
      setConversations((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setShowNewConversation(false);
      setForm(defaultForm);
      toast({ title: "Conversa criada" });
    } catch { toast({ title: "Erro ao criar conversa", variant: "destructive" }); }
    finally { setCreating(false); }
  };

  // ── Integrações rápidas (painel direito) ──────────────────────────────────
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


  // ── Dados derivados ───────────────────────────────────────────────────────
  const selected = conversations.find((c) => c.id === selectedId);

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

  // Setores disponíveis para transferência (de templates ou lista padrão)
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


  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-hidden bg-background flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-card px-4 py-3 flex-shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-heading">Inbox Omnichannel</h2>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${selectedInstanceState === "connected" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${selectedInstanceState === "connected" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                {selectedInstanceState === "connected" ? "WhatsApp Conectado" : "Verificar WhatsApp"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Atendimento centralizado — WhatsApp, PABX, redes sociais, chats e integrações.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            {instances.length > 0 ? (
              <div className="flex items-center gap-2">
                <select value={selectedInstance} onChange={(e) => handleInstanceChange(e.target.value)}
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary">
                  {instances.map((inst) => (
                    <option key={inst.name} value={inst.name}>
                      {["connected","open"].includes(inst.state) ? "🟢" : "🔴"} {inst.name}
                    </option>
                  ))}
                </select>
                <button onClick={loadInstances} className="rounded-lg border border-border p-2 hover:bg-muted" title="Recarregar instâncias">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <button onClick={loadInstances} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-muted">
                <RefreshCw className="h-4 w-4" /> Carregar instâncias
              </button>
            )}
            <button onClick={handleLoadWhatsAppConversations} disabled={!selectedInstance || loadingConvsFromWa}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loadingConvsFromWa ? "animate-spin" : ""}`} /> Sincronizar
            </button>
            <button onClick={() => setShowNewConversation(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              <CirclePlus className="h-4 w-4" /> Nova conversa
            </button>
          </div>
        </div>

        {/* Abas de canal */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {channelTabs.map((tab) => {
            const Icon = tab.icon;
            const active = channel === tab.key;
            return (
              <button key={tab.key} onClick={() => setChannel(tab.key)}
                className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm font-semibold transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}>
                <Icon className={`h-4 w-4 ${active ? "" : tab.className}`} />
                {tab.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${active ? "bg-white/20" : "bg-muted text-muted-foreground"}`}>
                  {channelCounts[tab.key] || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Grade de 3 colunas ──────────────────────────────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[360px_minmax(460px,1fr)_340px]">

        {/* ── Coluna esquerda: lista de conversas ──────────────────────────── */}
        <aside className="min-h-0 border-r border-border bg-card flex flex-col">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, telefone, protocolo..."
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-thin">
              <Filter className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              {statusFilters.map((item) => (
                <button key={item.key} onClick={() => setStatusFilter(item.key)}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold ${statusFilter === item.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <WhatsAppSearchResults results={waResults} loading={searchingWa} onSelect={startConversationFromWa} />

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Carregando conversas...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada</div>
            ) : (
              filtered.map((conv) => (
                <button key={conv.id} onClick={() => setSelectedId(conv.id)}
                  className={`flex w-full gap-3 border-b border-border p-3 text-left transition-colors hover:bg-muted/40 ${selectedId === conv.id ? "border-l-4 border-l-primary bg-primary/5" : ""}`}>
                  <div className="relative flex-shrink-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-bold text-white">
                      {initials(conv.customer_name)}
                    </div>
                    {conv.is_ai && (
                      <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-violet-500">
                        <Bot className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-sm ${conv.unread ? "font-bold" : "font-medium"}`}>{conv.customer_name}</p>
                      <span className="flex-shrink-0 text-xs text-muted-foreground">{formatTime(conv.last_message_time)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{conv.last_message || "Sem mensagens"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <ChannelBadge channel={conv.channel} />
                      <StatusBadge status={conv.status} />
                      {conv.unread && <span className="h-2.5 w-2.5 rounded-full bg-accent flex-shrink-0" />}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>


        {/* ── Coluna central: chat ─────────────────────────────────────────── */}
        <section className="min-h-0 flex flex-col bg-muted/20">
          {selected ? (
            <>
              {/* Header da conversa */}
              <div className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-border bg-card px-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent font-bold text-white text-sm">
                  {initials(selected.customer_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="truncate text-sm font-bold">{selected.customer_name}</p>
                    <ChannelBadge channel={selected.channel} />
                    <StatusBadge status={selected.status} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {selected.phone || "Sem telefone"}
                    {selected.protocol && ` · ${selected.protocol}`}
                    {selected.sector && ` · ${selected.sector}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {selected.channel === "whatsapp" && (
                    <button onClick={() => syncEvolutionHistory(selected, true)} disabled={syncingHistory}
                      className="rounded-lg p-2 hover:bg-muted" title="Sincronizar histórico WhatsApp">
                      <RefreshCw className={`h-4 w-4 text-muted-foreground ${syncingHistory ? "animate-spin" : ""}`} />
                    </button>
                  )}
                  <button onClick={handleWhatsAppCall} className="rounded-lg p-2 hover:bg-muted" title="Ligar via WhatsApp">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => setShowTransferModal(true)} className="rounded-lg p-2 hover:bg-muted" title="Transferir conversa">
                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => setShowFinalizeModal(true)} className="rounded-lg p-2 hover:bg-green-50 hover:text-green-700" title="Finalizar atendimento">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button className="rounded-lg p-2 hover:bg-muted" title="Mais ações">
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Área de mensagens */}
              <div className="min-h-0 flex-1 overflow-y-auto p-5 scrollbar-thin">
                <div className="mx-auto max-w-3xl space-y-3">
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Conversa via {channelTabs.find((t) => t.key === selected.channel)?.label || "canal"}
                    {selected.created_date && <span>· {formatDate(selected.created_date)}</span>}
                  </div>

                  {loadingMessages ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" /> Carregando mensagens...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
                      <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm font-medium text-muted-foreground">Nenhuma mensagem ainda</p>
                      {selected.channel === "whatsapp" && (
                        <button onClick={() => syncEvolutionHistory(selected, true)}
                          className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline">
                          <RefreshCw className="h-3.5 w-3.5" /> Buscar histórico do WhatsApp
                        </button>
                      )}
                    </div>
                  ) : (
                    messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* ── Área de envio ──────────────────────────────────────────── */}
              <div className="flex-shrink-0 border-t border-border bg-card p-3">
                <input ref={fileInputRef} type="file" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip,.rar" className="hidden" onChange={handleFileChange} />
                <input ref={audioInputRef} type="file" accept="audio/*,.ogg,.mp3,.m4a,.aac,.wav,.opus" className="hidden" onChange={handleAudioChange} />

                <div className="rounded-xl border border-border bg-background p-2">
                  {/* Tabs modo */}
                  <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
                    <div className="flex gap-1">
                      <button onClick={() => setMessageMode("reply")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${messageMode === "reply" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                        Responder
                      </button>
                      <button onClick={() => setMessageMode("internal")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${messageMode === "internal" ? "bg-amber-100 text-amber-800" : "text-muted-foreground hover:bg-muted"}`}>
                        <StickyNote className="h-3 w-3" /> Nota interna
                      </button>
                    </div>

                    {selected?.channel === "whatsapp" && (
                      <div className="flex items-center gap-1">
                        <button onClick={handleSyncHistoryOnly} disabled={syncingHistory}
                          title="Sincronizar histórico" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50">
                          <RefreshCw className={`h-3.5 w-3.5 ${syncingHistory ? "animate-spin" : ""}`} />
                          <span className="hidden sm:inline">Histórico</span>
                        </button>
                        <button onClick={handleWhatsAppCall} title="Ligar"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-green-50 hover:text-green-700">
                          <Phone className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Ligar</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Input + botões */}
                  <div className="flex items-center gap-1.5">
                    <button onClick={handleAttachClick} disabled={sendingMedia || selected?.channel !== "whatsapp"}
                      title="Anexar arquivo" className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-40">
                      {sendingMedia ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                    </button>
                    <button onClick={handleAudioClick} disabled={sendingMedia || selected?.channel !== "whatsapp"}
                      title="Enviar áudio" className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-40">
                      <Mic className="h-5 w-5" />
                    </button>

                    <input type="text" value={message} onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                      placeholder={messageMode === "internal" ? "Nota interna (não enviada ao cliente)..." : "Digite sua mensagem..."}
                      className={`h-10 flex-1 bg-transparent px-2 text-sm outline-none ${messageMode === "internal" ? "placeholder:text-amber-400" : ""}`} />

                    {/* Atalhos (templates) */}
                    <div className="relative" data-shortcuts-panel>
                      <button onClick={() => setShowShortcuts((s) => !s)}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors ${showShortcuts ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                        <Zap className="h-3.5 w-3.5" />
                        <span className="hidden lg:inline">Atalhos</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showShortcuts ? "rotate-180" : ""}`} />
                      </button>

                      {showShortcuts && (
                        <div className="absolute bottom-12 right-0 z-50 w-80 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                          <div className="p-3 border-b border-border">
                            <p className="text-sm font-semibold mb-2">Templates de mensagem</p>
                            <input value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)}
                              placeholder="Buscar template..." className="w-full h-8 px-3 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                          </div>
                          <div className="max-h-64 overflow-y-auto scrollbar-thin">
                            {filteredTemplates.length === 0 ? (
                              <p className="p-4 text-xs text-muted-foreground text-center">
                                {templates.length === 0 ? "Nenhum template cadastrado" : "Nenhum template encontrado"}
                              </p>
                            ) : (
                              filteredTemplates.map((tp) => (
                                <button key={tp.id} onClick={() => { setMessage(tp.content || tp.body || ""); setShowShortcuts(false); setTemplateSearch(""); }}
                                  className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b border-border/50 last:border-0">
                                  <p className="text-xs font-semibold text-foreground">{tp.name}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tp.content || tp.body}</p>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <button onClick={handleSend} disabled={sending || !message.trim()}
                      className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50 ${messageMode === "internal" ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-600 hover:bg-emerald-700"}`}>
                      {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      <span>{messageMode === "internal" ? "Salvar nota" : "Enviar"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="mx-auto mb-3 h-12 w-12 opacity-30" />
                <p className="font-medium">Selecione uma conversa</p>
                <p className="text-sm mt-1">ou sincronize o WhatsApp para importar conversas</p>
              </div>
            </div>
          )}
        </section>


        {/* ── Coluna direita: painel de dados/contexto ─────────────────────── */}
        <aside className="hidden min-h-0 border-l border-border bg-card xl:flex xl:flex-col">
          {selected ? (
            <>
              {/* Abas do painel direito */}
              <div className="flex border-b border-border overflow-x-auto scrollbar-thin flex-shrink-0">
                {[
                  { key: "dados",     label: "Dados"     },
                  { key: "historico", label: "Histórico" },
                  { key: "acordo",    label: "Acordo"    },
                  { key: "modelos",   label: "Modelos"   },
                  { key: "contratos", label: "Contratos" },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setRightTab(key)}
                    className={`flex-1 py-3 text-xs font-bold whitespace-nowrap px-2 transition-colors ${rightTab === key ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Conteúdo das abas */}
              {rightTab === "modelos" ? (
                <QuickReplyPanel onSend={sendMessageContent} sending={sending} />
              ) : rightTab === "historico" ? (
                <CustomerHistoryPanel conversation={selected} onSelect={setSelectedId} />
              ) : rightTab === "contratos" ? (
                <ContractTemplatePicker conversation={selected} />
              ) : rightTab === "acordo" ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-thin">
                  <AgreementCheckPanel conversation={selected} instance={selectedInstance} />
                </div>
              ) : (
                /* ABA: DADOS */
                <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin space-y-4">
                  {/* Card de perfil */}
                  <div className="rounded-xl border border-border bg-background p-4 text-center">
                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xl font-bold text-white">
                      {initials(selected.customer_name)}
                    </div>
                    <p className="font-bold text-sm">{selected.customer_name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{selected.phone || "Sem telefone"}</p>
                    {selected.email && <p className="text-xs text-muted-foreground mt-0.5">{selected.email}</p>}
                    <div className="mt-3 flex justify-center gap-2 flex-wrap">
                      <StatusBadge status={selected.status} />
                      <PriorityBadge priority={selected.priority} />
                    </div>
                  </div>

                  {/* Informações do atendimento */}
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="mb-3 text-xs font-bold uppercase text-muted-foreground tracking-wide">Atendimento</p>
                    <div className="space-y-2.5 text-sm">
                      {[
                        ["Setor",       selected.sector         || "Atendimento"    ],
                        ["Atendente",   selected.attendant_name || "Não atribuído"  ],
                        ["Protocolo",   selected.protocol       || "—"              ],
                        ["Cidade",      selected.city           || "—"              ],
                        ["Instância",   selected.instance || selectedInstance || "—"],
                        ["Canal",       channelTabs.find((t) => t.key === selected.channel)?.label || selected.channel],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-start justify-between gap-2">
                          <span className="text-muted-foreground flex-shrink-0">{label}</span>
                          <span className="font-medium text-right text-xs">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="mb-3 text-xs font-bold uppercase text-muted-foreground tracking-wide">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.tags?.length ? (
                        selected.tags.map((tag) => (
                          <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-semibold">
                            <Tag className="h-3 w-3" /> {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Nenhuma tag</span>
                      )}
                    </div>
                  </div>

                  {/* Integrações rápidas */}
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="mb-3 text-xs font-bold uppercase text-muted-foreground tracking-wide">Integrações API</p>
                    <div className="space-y-2">
                      {integrations.map((item) => {
                        const Icon = item.icon;
                        let configStatus = configs[item.service]?.status || "disconnected";
                        if (item.service === "evolution_api") configStatus = selectedInstanceState;
                        return (
                          <button key={item.service} onClick={() => handleQuickIntegration(item.service)}
                            disabled={Boolean(actionLoading)}
                            className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-muted/50 disabled:opacity-50 transition-colors">
                            <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-bold">{item.label}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {item.service === "evolution_api" && selected?.channel === "whatsapp" ? "Buscar histórico desta conversa" : item.actionLabel}
                              </span>
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold flex-shrink-0 ${statusTone[configStatus] || statusTone.disconnected}`}>
                              {actionLoading === item.service ? "…" : statusLabel(configStatus)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="grid grid-cols-2 gap-2 pb-2">
                    <button onClick={() => setShowFinalizeModal(true)}
                      disabled={["finalizado","resolvido"].includes(selected.status)}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors">
                      <CheckCircle className="h-4 w-4" /> Finalizar
                    </button>
                    <button onClick={() => setShowTransferModal(true)}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-muted px-3 py-2.5 text-sm font-bold hover:bg-muted/70 transition-colors">
                      <ArrowRightLeft className="h-4 w-4" /> Transferir
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center">
              <div>
                <UserCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Selecione uma conversa para ver os detalhes</p>
              </div>
            </div>
          )}
        </aside>
      </div>{/* fim da grid de 3 colunas */}

      {/* ── Rodapé: métricas ────────────────────────────────────────────────── */}
      <div className="grid flex-shrink-0 border-t border-border bg-card" style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0,1fr))` }}>
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="border-r border-border px-4 py-3 last:border-r-0">
              <div className="flex items-center justify-between gap-1">
                <p className="truncate text-[11px] font-semibold text-muted-foreground">{metric.label}</p>
                <Icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              </div>
              <p className="mt-0.5 text-xl font-black">{metric.value}</p>
            </div>
          );
        })}
      </div>

      {/* ── Modal: Nova conversa ─────────────────────────────────────────────── */}
      {showNewConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowNewConversation(false)}>
          <form onSubmit={createConversation} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Nova conversa</h3>
                <p className="text-sm text-muted-foreground">Crie um atendimento em qualquer canal.</p>
              </div>
              <button type="button" onClick={() => setShowNewConversation(false)} className="rounded-lg p-2 hover:bg-muted">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 text-sm font-semibold">
                Nome do contato *
                <input value={form.customer_name} onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary" required />
              </label>
              <label className="text-sm font-semibold">
                Telefone ou ID
                <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary" />
              </label>
              <label className="text-sm font-semibold">
                Canal
                <select value={form.channel} onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary">
                  {channelTabs.filter((t) => t.key !== "all").map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Setor
                <select value={form.sector} onChange={(e) => setForm((p) => ({ ...p, sector: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary">
                  {availableSectors.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Prioridade
                <select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary">
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowNewConversation(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={creating}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {creating ? "Criando..." : "Criar conversa"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal: Finalizar atendimento ─────────────────────────────────────── */}
      {showFinalizeModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowFinalizeModal(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-600" /> Finalizar Atendimento
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Conversa com <strong>{selected.customer_name}</strong> será marcada como finalizada.
                </p>
              </div>
              <button onClick={() => setShowFinalizeModal(false)} className="rounded-lg p-2 hover:bg-muted">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <label className="block text-sm font-semibold mb-1.5">
              Nota de encerramento <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <textarea value={finalizeNote} onChange={(e) => setFinalizeNote(e.target.value)}
              placeholder="Descreva a resolução, próximos passos ou informações relevantes..."
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary resize-none" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowFinalizeModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancelar</button>
              <button onClick={handleFinalize} disabled={finalizing}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                {finalizing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {finalizing ? "Finalizando..." : "Finalizar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Transferir atendimento ────────────────────────────────────── */}
      {showTransferModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowTransferModal(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-primary" /> Transferir Atendimento
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Transferir conversa de <strong>{selected.sector || "Atendimento"}</strong> para outro setor.
                </p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="rounded-lg p-2 hover:bg-muted">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold block mb-1.5">Setor de destino *</label>
                <select value={transferSector} onChange={(e) => setTransferSector(e.target.value)}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Selecione um setor...</option>
                  {availableSectors.filter((s) => s !== selected.sector).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold block mb-1.5">
                  Atendente <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <select value={transferAttendant} onChange={(e) => setTransferAttendant(e.target.value)}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Sem atendente específico</option>
                  {users.filter((u) => (u.status || "ativo") === "ativo").map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowTransferModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Cancelar</button>
              <button onClick={handleTransfer} disabled={transferring || !transferSector}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {transferring ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                {transferring ? "Transferindo..." : "Transferir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
