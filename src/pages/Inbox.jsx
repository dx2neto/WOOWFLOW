import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ChannelBadge, PriorityBadge, StatusBadge } from "@/components/Badges";
import AgreementCheckPanel from "@/components/agreements/AgreementCheckPanel";
import QuickReplyPanel from "@/components/inbox/QuickReplyPanel";
import WhatsAppSearchResults from "@/components/inbox/WhatsAppSearchResults";
import { evolutionApi } from "@/functions/evolutionApi";
import { ixcApi } from "@/functions/ixcApi";
import { serasaApi } from "@/functions/serasaApi";
import { zapsignApi } from "@/functions/zapsignApi";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertCircle,
  AtSign,
  Bot,
  CheckCircle,
  ChevronDown,
  CirclePlus,
  Clock3,
  Database,
  FileSignature,
  Filter,
  Headphones,
  Instagram,
  Mail,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Zap,
} from "lucide-react";

const channelTabs = [
  { key: "all", label: "Todos", icon: Headphones, className: "text-violet-600" },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, className: "text-green-600" },
  { key: "telefone", label: "PABX / URA", icon: Phone, className: "text-indigo-600" },
  { key: "instagram", label: "Instagram", icon: Instagram, className: "text-pink-600" },
  { key: "facebook", label: "Facebook", icon: AtSign, className: "text-blue-600" },
  { key: "chat_interno", label: "Chat interno", icon: MessageSquare, className: "text-amber-600" },
  { key: "chat_externo", label: "Chat externo", icon: MessageSquare, className: "text-purple-600" },
  { key: "telegram", label: "Telegram", icon: Send, className: "text-sky-600" },
  { key: "email", label: "E-mail", icon: Mail, className: "text-orange-600" },
];

const statusFilters = [
  { key: "all", label: "Todos" },
  { key: "novo", label: "Novos" },
  { key: "aguardando_atendimento", label: "Fila" },
  { key: "em_atendimento", label: "Atendimento" },
  { key: "aguardando_cliente", label: "Cliente" },
  { key: "resolvido", label: "Resolvidos" },
];

const integrations = [
  { service: "evolution_api", label: "Evolution Go", icon: MessageCircle, actionLabel: "Sincronizar WhatsApp" },
  { service: "ixc_provedor", label: "IXC", icon: Database, actionLabel: "Consultar cliente" },
  { service: "validacadastro", label: "Serasa", icon: ShieldCheck, actionLabel: "Validar CPF/CNPJ" },
  { service: "zapsign", label: "ZapSign", icon: FileSignature, actionLabel: "Checar assinatura" },
];

const defaultForm = {
  customer_name: "",
  phone: "",
  channel: "whatsapp",
  status: "novo",
  priority: "media",
  sector: "Atendimento",
};

const statusTone = {
  connected: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
  disconnected: "bg-muted text-muted-foreground",
};

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(status) {
  return {
    connected: "Conectado",
    pending: "Pendente",
    error: "Erro",
    disconnected: "Pendente",
  }[status] || "Pendente";
}

export default function Inbox() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [instances, setInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState(() => localStorage.getItem("evolution_instance") || "");
  const [rightTab, setRightTab] = useState("dados");
  const [configs, setConfigs] = useState({});
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [waResults, setWaResults] = useState([]);
  const [searchingWa, setSearchingWa] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConversations();
    loadInstances();
    loadIntegrationConfigs();
  }, []);

  useEffect(() => {
    const unsubscribe = base44.entities.Conversation.subscribe((event) => {
      setConversations((prev) => {
        if (event.type === "create") return [event.data, ...prev.filter((c) => c.id !== event.data.id)];
        if (event.type === "update") return prev.map((c) => (c.id === event.data.id ? event.data : c));
        if (event.type === "delete") return prev.filter((c) => c.id !== event.data.id);
        return prev;
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const conversationId = new URLSearchParams(window.location.search).get("conversation");
    if (conversationId && conversations.some((c) => c.id === conversationId)) setSelectedId(conversationId);
  }, [conversations]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const unsubscribe = base44.entities.Message.subscribe((event) => {
      if (event.data.conversation_id !== selectedId) return;
      setMessages((prev) => {
        if (event.type === "create") return prev.some((m) => m.id === event.data.id) ? prev : [...prev, event.data];
        if (event.type === "update") return prev.map((m) => (m.id === event.data.id ? event.data : m));
        if (event.type === "delete") return prev.filter((m) => m.id !== event.data.id);
        return prev;
      });
    });
    return unsubscribe;
  }, [selectedId]);

  const loadConversations = async () => {
    try {
      const data = await base44.entities.Conversation.list("-last_message_time", 100);
      setConversations(data);
      if (data.length > 0) setSelectedId((current) => current || data[0].id);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    setLoadingMessages(true);
    try {
      const data = await base44.entities.Message.filter({ conversation_id: conversationId }, "timestamp");
      setMessages(data);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadInstances = async () => {
    try {
      const response = await evolutionApi({ action: "get_instances" });
      const list = response?.data?.instances || [];
      setInstances(list);
      if (!selectedInstance && list.length > 0) {
        const first = list[0].name || list[0].instance?.instanceName || "";
        setSelectedInstance(first);
        localStorage.setItem("evolution_instance", first);
      }
    } catch {
      setInstances([]);
    }
  };

  const loadIntegrationConfigs = async () => {
    try {
      const data = await base44.entities.IntegrationConfig.list();
      setConfigs(Object.fromEntries(data.map((item) => [item.service, item])));
    } catch {
      setConfigs({});
    }
  };

  const selected = conversations.find((c) => c.id === selectedId);

  const channelCounts = useMemo(() => {
    const counts = { all: conversations.length };
    for (const conv of conversations) counts[conv.channel] = (counts[conv.channel] || 0) + 1;
    return counts;
  }, [conversations]);

  const metrics = useMemo(() => {
    const active = conversations.filter((c) => c.status === "em_atendimento").length;
    const waiting = conversations.filter((c) => ["novo", "aguardando_atendimento", "aguardando_setor"].includes(c.status)).length;
    const resolved = conversations.filter((c) => ["resolvido", "finalizado"].includes(c.status)).length;
    const satisfactionValues = conversations.map((c) => Number(c.satisfaction_score)).filter(Boolean);
    const satisfaction = satisfactionValues.length
      ? (satisfactionValues.reduce((sum, value) => sum + value, 0) / satisfactionValues.length).toFixed(1)
      : "—";
    return [
      { label: "Total conversas", value: conversations.length, detail: "", icon: MessageCircle },
      { label: "Em atendimento", value: active, detail: "", icon: Headphones },
      { label: "Aguardando fila", value: waiting, detail: "", icon: Clock3 },
      { label: "Resolvidas", value: resolved, detail: "", icon: CheckCircle },
      { label: "Satisfação", value: satisfaction, detail: "", icon: Star },
    ];
  }, [conversations]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return conversations.filter((conv) => {
      const matchesChannel = channel === "all" || conv.channel === channel;
      const matchesStatus = status === "all" || conv.status === status;
      const matchesQuery = !term || [conv.customer_name, conv.phone, conv.protocol, conv.last_message, conv.city]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
      return matchesChannel && matchesStatus && matchesQuery;
    });
  }, [channel, conversations, query, status]);

  useEffect(() => {
    const term = query.trim().toLowerCase();
    if (!term || channel === "instagram" || channel === "facebook" || channel === "telefone" || channel === "email" || !selectedInstance) {
      setWaResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchingWa(true);
      try {
        const response = await evolutionApi({ action: "get_contacts", instance: selectedInstance });
        const rawContacts = response?.data?.contacts || {};
        const entries = Array.isArray(rawContacts) ? rawContacts : Object.entries(rawContacts).map(([jid, info]) => ({ jid, ...info }));
        const existingPhones = new Set(conversations.map((c) => c.phone));
        const matches = [];
        for (const entry of entries) {
          const jid = entry.jid || entry.JID || entry.id || "";
          if (!jid || jid.includes("@g.us")) continue;
          const phone = jid.split("@")[0];
          if (!phone || existingPhones.has(phone)) continue;
          const name = entry.FullName || entry.PushName || entry.BusinessName || entry.name || phone;
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

  const startConversationFromWa = async (contact) => {
    try {
      const now = new Date().toISOString();
      const created = await base44.entities.Conversation.create({
        customer_name: contact.name,
        phone: contact.phone,
        channel: "whatsapp",
        instance: selectedInstance,
        status: "novo",
        sector: "Atendimento",
        last_message: "Conversa iniciada a partir da busca no Evolution Go",
        last_message_time: now,
      });
      setConversations((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setQuery("");
      setWaResults([]);
    } catch {
      toast({ title: "Erro ao iniciar conversa", variant: "destructive" });
    }
  };

  const handleInstanceChange = (name) => {
    setSelectedInstance(name);
    localStorage.setItem("evolution_instance", name);
  };

  const handleLoadWhatsAppConversations = async () => {
    if (!selectedInstance || loadingConversations) return;
    setLoadingConversations(true);
    try {
      const response = await evolutionApi({ action: "get_contacts", instance: selectedInstance });
      if (response?.data?.error) {
        toast({ title: "Falha ao carregar conversas", description: response.data.error, variant: "destructive" });
        return;
      }

      const rawContacts = response?.data?.contacts || {};
      const entries = Array.isArray(rawContacts) ? rawContacts : Object.entries(rawContacts).map(([jid, info]) => ({ jid, ...info }));
      const existingPhones = new Set(conversations.map((c) => c.phone));
      const toCreate = [];

      for (const entry of entries) {
        const jid = entry.jid || entry.JID || entry.id || "";
        if (!jid || jid.includes("@g.us")) continue;
        const phone = jid.split("@")[0];
        if (!phone || existingPhones.has(phone)) continue;
        existingPhones.add(phone);
        toCreate.push({
          customer_name: entry.FullName || entry.PushName || entry.BusinessName || entry.name || phone,
          phone,
          channel: "whatsapp",
          instance: selectedInstance,
          status: "novo",
          sector: "Atendimento",
          last_message_time: new Date().toISOString(),
        });
      }

      if (toCreate.length === 0) {
        toast({ title: "Nenhuma conversa nova encontrada" });
        return;
      }

      const created = await base44.entities.Conversation.bulkCreate(toCreate);
      setConversations((prev) => [...created, ...prev]);
      toast({ title: `${created.length} conversa(s) carregada(s)` });
    } catch {
      toast({ title: "Erro ao carregar conversas", variant: "destructive" });
    } finally {
      setLoadingConversations(false);
    }
  };

  const sendMessageContent = async (content) => {
    if (!content.trim() || !selected || sending) return;
    setSending(true);
    try {
      if (selected.channel === "whatsapp") {
        const response = await evolutionApi({ action: "send_message", phone: selected.phone, message: content, instance: selectedInstance || selected.instance });
        if (response?.data?.error) {
          toast({ title: "Falha ao enviar mensagem", description: response.data.error, variant: "destructive" });
          return;
        }
      }

      const now = new Date().toISOString();
      const newMessage = await base44.entities.Message.create({
        conversation_id: selected.id,
        content,
        direction: "out",
        type: "text",
        status: selected.channel === "whatsapp" ? "sent" : "delivered",
        timestamp: now,
        sender_name: "Atendente",
      });
      setMessages((prev) => [...prev, newMessage]);
      await base44.entities.Conversation.update(selected.id, { last_message: content, last_message_time: now, status: "em_atendimento", unread: false });
      setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, last_message: content, last_message_time: now, status: "em_atendimento", unread: false } : c));
    } catch {
      toast({ title: "Erro ao enviar mensagem", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    const content = message.trim();
    if (!content) return;
    setMessage("");
    await sendMessageContent(content);
  };

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
    } catch {
      toast({ title: "Erro ao criar conversa", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleQuickIntegration = async (service) => {
    if (!selected) return;
    setActionLoading(service);
    try {
      if (service === "evolution_api") {
        await handleLoadWhatsAppConversations();
      }
      if (service === "ixc_provedor") {
        const response = await ixcApi({ action: "clientes", search: selected.phone || selected.customer_name, limit: 5 });
        const total = response?.data?.result?.total || response?.data?.pagination?.total || 0;
        toast({ title: "Consulta IXC concluída", description: `${total} registro(s) encontrado(s).` });
      }
      if (service === "validacadastro") {
        const cpfCnpj = selected.cpf_cnpj || window.prompt("CPF/CNPJ para consulta Serasa");
        if (!cpfCnpj) return;
        const response = await serasaApi({ cpfCnpj });
        if (response?.data?.error) {
          toast({ title: "Consulta Serasa não concluída", description: response.data.error, variant: "destructive" });
          return;
        }
        toast({ title: "Consulta Serasa concluída" });
      }
      if (service === "zapsign") {
        const response = await zapsignApi({ action: "dashboard" });
        const pending = response?.data?.data?.pending ?? 0;
        toast({ title: "ZapSign consultado", description: `${pending} assinatura(s) pendente(s).` });
      }
    } catch {
      toast({ title: "Falha na integração", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="h-full overflow-hidden bg-background flex flex-col">
      <div className="border-b border-border bg-card px-4 py-3 flex-shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-heading">Inbox Omnichannel</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Online
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Atendimento, WhatsApp, PABX com URA, redes sociais, chats e integrações em um único lugar.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            {instances.length > 0 && (
              <select
                title="Instância usada para responder no WhatsApp"
                value={selectedInstance}
                onChange={(e) => handleInstanceChange(e.target.value)}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              >
                {instances.map((inst) => {
                  const name = inst.name || inst.instance?.instanceName || "";
                  return <option key={name} value={name}>{name}</option>;
                })}
              </select>
            )}
            <button
              onClick={handleLoadWhatsAppConversations}
              disabled={!selectedInstance || loadingConversations}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loadingConversations ? "animate-spin" : ""}`} />
              Sincronizar
            </button>
            <button
              onClick={() => setShowNewConversation(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <CirclePlus className="h-4 w-4" />
              Nova conversa
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {channelTabs.map((tab) => {
            const Icon = tab.icon;
            const active = channel === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setChannel(tab.key)}
                className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm font-semibold transition-colors ${
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
                }`}
              >
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

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[360px_minmax(460px,1fr)_340px]">
        <aside className="min-h-0 border-r border-border bg-card flex flex-col">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Busca avançada: nome ou telefone (inclui WhatsApp)..."
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-thin">
              <Filter className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              {statusFilters.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setStatus(item.key)}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                    status === item.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <WhatsAppSearchResults results={waResults} loading={searchingWa} onSelect={startConversationFromWa} />

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada</div>
            ) : (
              filtered.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`flex w-full gap-3 border-b border-border p-3 text-left transition-colors hover:bg-muted/40 ${
                    selectedId === conv.id ? "border-l-2 border-l-primary bg-primary/5" : ""
                  }`}
                >
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
                      <p className="truncate text-sm font-bold">{conv.customer_name}</p>
                      <span className="flex-shrink-0 text-xs text-muted-foreground">{formatTime(conv.last_message_time)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{conv.last_message || "Sem mensagens"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <ChannelBadge channel={conv.channel} />
                      <StatusBadge status={conv.status} />
                      {conv.unread && <span className="h-2 w-2 rounded-full bg-accent" />}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="min-h-0 flex flex-col bg-muted/20">
          {selected ? (
            <>
              <div className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-border bg-card px-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent font-bold text-white">
                  {initials(selected.customer_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold">{selected.customer_name}</p>
                    <ChannelBadge channel={selected.channel} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {selected.phone || "Sem telefone"} · Protocolo {selected.protocol || "sem protocolo"}
                  </p>
                </div>
                <button className="rounded-lg p-2 hover:bg-muted" title="Ligar"><Phone className="h-5 w-5 text-muted-foreground" /></button>
                <button className="rounded-lg p-2 hover:bg-muted" title="Mais ações"><MoreHorizontal className="h-5 w-5 text-muted-foreground" /></button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5 scrollbar-thin">
                <div className="mx-auto max-w-3xl space-y-3">
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Conversa iniciada via {channelTabs.find((tab) => tab.key === selected.channel)?.label || "canal omnichannel"}
                  </div>

                  {loadingMessages ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Carregando mensagens...</p>
                  ) : messages.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                      Nenhuma mensagem nesta conversa
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.direction === "out" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm ${
                          msg.direction === "out" ? "bg-primary text-primary-foreground" : "border border-border bg-card"
                        }`}>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                          <div className="mt-1 flex items-center justify-end gap-1">
                            {msg.sender_name && (
                              <span className={`text-xs ${msg.direction === "out" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                {msg.sender_name}
                              </span>
                            )}
                            <span className={`text-xs ${msg.direction === "out" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                              {formatTime(msg.timestamp)}
                            </span>
                            {msg.direction === "out" && <CheckCircle className="h-3.5 w-3.5 text-primary-foreground/70" />}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 border-t border-border bg-card p-3">
                <div className="rounded-xl border border-border bg-background p-2">
                  <div className="mb-2 flex border-b border-border">
                    <button className="border-b-2 border-primary px-3 pb-2 text-sm font-semibold text-primary">Responder</button>
                    <button className="px-3 pb-2 text-sm font-semibold text-muted-foreground">Nota interna</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="rounded-lg p-2 hover:bg-muted" title="Anexar"><Paperclip className="h-5 w-5 text-muted-foreground" /></button>
                    <input
                      type="text"
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && handleSend()}
                      placeholder="Digite sua mensagem..."
                      className="h-10 flex-1 bg-transparent px-2 text-sm outline-none"
                    />
                    <button className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-muted px-3 text-sm font-semibold text-muted-foreground">
                      <Zap className="h-4 w-4" /> Atalhos <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={sending || !message.trim()}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" /> Enviar
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="mx-auto mb-3 h-12 w-12 opacity-30" />
                <p>Selecione uma conversa para começar</p>
              </div>
            </div>
          )}
        </section>

        <aside className="hidden min-h-0 border-l border-border bg-card xl:flex xl:flex-col">
          {selected && (
            <>
              <div className="flex border-b border-border">
                {[
                  ["dados", "Dados"],
                  ["acordo", "Acordo"],
                  ["modelos", "Modelos"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setRightTab(key)}
                    className={`flex-1 py-3 text-xs font-bold ${rightTab === key ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {rightTab === "modelos" ? (
                <QuickReplyPanel onSend={sendMessageContent} sending={sending} />
              ) : rightTab === "acordo" ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-thin">
                  <AgreementCheckPanel conversation={selected} instance={selectedInstance} />
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
                  <div className="rounded-lg border border-border bg-background p-4 text-center">
                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xl font-bold text-white">
                      {initials(selected.customer_name)}
                    </div>
                    <p className="font-bold">{selected.customer_name}</p>
                    <p className="text-sm text-muted-foreground">{selected.phone || "Sem telefone"}</p>
                    <div className="mt-3 flex justify-center gap-2">
                      <StatusBadge status={selected.status} />
                      <PriorityBadge priority={selected.priority} />
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-border bg-background p-4">
                    <p className="mb-3 text-xs font-bold uppercase text-muted-foreground">Informações do atendimento</p>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Setor</span><span className="font-semibold">{selected.sector || "Atendimento"}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Atendente</span><span className="font-semibold">{selected.attendant_name || "Não atribuído"}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Cidade</span><span className="font-semibold">{selected.city || "—"}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Instância</span><span className="font-semibold">{selected.instance || selectedInstance || "—"}</span></div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-border bg-background p-4">
                    <p className="mb-3 text-xs font-bold uppercase text-muted-foreground">Integrações API</p>
                    <div className="space-y-2">
                      {integrations.map((item) => {
                        const Icon = item.icon;
                        const configStatus = configs[item.service]?.status || (item.service === "evolution_api" ? "connected" : "disconnected");
                        return (
                          <button
                            key={item.service}
                            onClick={() => handleQuickIntegration(item.service)}
                            disabled={Boolean(actionLoading)}
                            className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-muted/50 disabled:opacity-50"
                          >
                            <Icon className="h-5 w-5 text-primary" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-bold">{item.label}</span>
                              <span className="block truncate text-xs text-muted-foreground">{item.actionLabel}</span>
                            </span>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusTone[configStatus] || statusTone.disconnected}`}>
                              {actionLoading === item.service ? "..." : statusLabel(configStatus)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-border bg-background p-4">
                    <p className="mb-3 text-xs font-bold uppercase text-muted-foreground">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {selected.tags?.length ? (
                        selected.tags.map((tag) => (
                          <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-semibold">
                            <Tag className="h-3 w-3" /> {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">Nenhuma tag</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-accent-foreground hover:bg-accent/90">
                      Finalizar
                    </button>
                    <button className="rounded-lg bg-muted px-3 py-2 text-sm font-bold hover:bg-muted/70">
                      Transferir
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      <div className="grid flex-shrink-0 grid-cols-2 border-t border-border bg-card md:grid-cols-5">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="border-r border-border px-4 py-3 last:border-r-0">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-semibold text-muted-foreground">{metric.label}</p>
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-1 text-2xl font-black">{metric.value}</p>
              {metric.detail && <p className="text-xs text-emerald-600">{metric.detail}</p>}
            </div>
          );
        })}
      </div>

      {showNewConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={createConversation} className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Nova conversa</h3>
                <p className="text-sm text-muted-foreground">Crie um atendimento em qualquer canal omnichannel.</p>
              </div>
              <button type="button" onClick={() => setShowNewConversation(false)} className="rounded-lg p-2 hover:bg-muted">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2 text-sm font-semibold">
                Nome do contato
                <input
                  value={form.customer_name}
                  onChange={(event) => setForm((current) => ({ ...current, customer_name: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </label>
              <label className="text-sm font-semibold">
                Telefone ou ID
                <input
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
              <label className="text-sm font-semibold">
                Canal
                <select
                  value={form.channel}
                  onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                >
                  {channelTabs.filter((item) => item.key !== "all").map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Setor
                <input
                  value={form.sector}
                  onChange={(event) => setForm((current) => ({ ...current, sector: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
              <label className="text-sm font-semibold">
                Prioridade
                <select
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowNewConversation(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
                Cancelar
              </button>
              <button type="submit" disabled={creating} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {creating ? "Criando..." : "Criar conversa"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}