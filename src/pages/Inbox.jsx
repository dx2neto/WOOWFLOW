import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChannelBadge, StatusBadge, PriorityBadge } from "@/components/Badges";
import { evolutionApi } from "@/functions/evolutionApi";
import { ixcApi } from "@/functions/ixcApi";
import { useToast } from "@/components/ui/use-toast";
import {
  Send, Paperclip, Mic, Search, MoreVertical, Phone, Video,
  Bot, User, FileText, Zap, FileSignature,
  ArrowRightCircle, CheckCircle, Star, Users as UsersIcon, RefreshCw
} from "lucide-react";

const quickActions = [
  { label: "Consultar ERP", icon: User, color: "text-blue-600 bg-blue-50" },
  { label: "Enviar Boleto", icon: FileText, color: "text-orange-600 bg-orange-50", action: "sendBoleto" },
  { label: "Enviar PIX", icon: Zap, color: "text-green-600 bg-green-50" },
  { label: "Enviar Contrato", icon: FileSignature, color: "text-purple-600 bg-purple-50" },
  { label: "Criar Oportunidade", icon: UsersIcon, color: "text-indigo-600 bg-indigo-50" },
  { label: "Transferir", icon: ArrowRightCircle, color: "text-amber-600 bg-amber-50" },
];

export default function Inbox() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState("all");
  const [sendingBoleto, setSendingBoleto] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [instances, setInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState(() => localStorage.getItem("evolution_instance") || "");
  const { toast } = useToast();

  useEffect(() => {
    loadConversations();
    loadInstances();
  }, []);

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

  const handleInstanceChange = (name) => {
    setSelectedInstance(name);
    localStorage.setItem("evolution_instance", name);
  };

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
    if (conversationId && conversations.some((c) => c.id === conversationId)) {
      setSelectedId(conversationId);
    }
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
      const data = await base44.entities.Conversation.list("-last_message_time", 50);
      setConversations(data);
      if (data.length > 0) setSelectedId(data[0].id);
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

  const handleLoadConversations = async () => {
    if (!selectedInstance || loadingConversations) return;
    setLoadingConversations(true);
    try {
      const response = await evolutionApi({ action: "get_contacts", instance: selectedInstance });
      if (response?.data?.error) {
        toast({ title: "Falha ao carregar conversas", variant: "destructive" });
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
        const name = entry.FullName || entry.PushName || entry.BusinessName || entry.name || phone;
        existingPhones.add(phone);
        toCreate.push({
          customer_name: name,
          phone,
          channel: "whatsapp",
          instance: selectedInstance,
          status: "novo",
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

  const selected = conversations.find((c) => c.id === selectedId);
  const filtered = filter === "all" ? conversations : conversations.filter((c) => c.status === filter);

  const handleSend = async () => {
    if (!message.trim() || !selected || sending) return;
    const content = message.trim();
    setMessage("");
    setSending(true);
    try {
      const response = await evolutionApi({ action: "send_message", phone: selected.phone, message: content, instance: selectedInstance });
      if (response?.data?.error) {
        toast({ title: "Falha ao enviar mensagem", variant: "destructive" });
        return;
      }
      const newMessage = await base44.entities.Message.create({
        conversation_id: selected.id,
        content,
        direction: "out",
        type: "text",
        status: "sent",
        timestamp: new Date().toISOString(),
      });
      setMessages((prev) => [...prev, newMessage]);
      await base44.entities.Conversation.update(selected.id, { last_message: content, last_message_time: new Date().toISOString() });
      setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, last_message: content, last_message_time: new Date().toISOString() } : c));
    } catch {
      toast({ title: "Erro ao enviar mensagem", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSendBoleto = async () => {
    if (!selected || sendingBoleto) return;
    setSendingBoleto(true);
    try {
      const digits = (selected.phone || "").replace(/\D/g, "");
      const response = await ixcApi({ action: "faturas" });
      const registros = response?.data?.result?.registros || [];
      const fatura = registros.find((f) => f.phone && f.phone.replace(/\D/g, "").slice(-8) === digits.slice(-8));

      if (!fatura || (!fatura.boleto && !fatura.linha_digitavel)) {
        toast({ title: "Nenhuma fatura em aberto encontrada para este cliente", variant: "destructive" });
        return;
      }

      const linhas = [
        `Segue a 2ª via do seu boleto, vencimento em ${fatura.due_date ? new Date(fatura.due_date).toLocaleDateString("pt-BR") : "—"}, no valor de R$ ${fatura.value?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
      ];
      if (fatura.boleto) linhas.push(fatura.boleto);
      if (fatura.linha_digitavel) linhas.push(`Linha digitável: ${fatura.linha_digitavel}`);
      const content = linhas.join("\n");

      const evoResponse = await evolutionApi({ action: "send_message", phone: selected.phone, message: content, instance: selectedInstance });
      if (evoResponse?.data?.error) {
        toast({ title: "Falha ao enviar a 2ª via", variant: "destructive" });
        return;
      }

      const newMessage = await base44.entities.Message.create({
        conversation_id: selected.id,
        content,
        direction: "out",
        type: "text",
        status: "sent",
        timestamp: new Date().toISOString(),
      });
      setMessages((prev) => [...prev, newMessage]);
      await base44.entities.Conversation.update(selected.id, { last_message: content, last_message_time: new Date().toISOString() });
      setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, last_message: content, last_message_time: new Date().toISOString() } : c));
      toast({ title: "2ª via enviada com sucesso" });
    } catch {
      toast({ title: "Erro ao enviar a 2ª via", variant: "destructive" });
    } finally {
      setSendingBoleto(false);
    }
  };

  const filters = [
    { key: "all", label: "Todas" },
    { key: "novo", label: "Novas" },
    { key: "em_atendimento", label: "Em Atendimento" },
    { key: "aguardando_cliente", label: "Aguardando Cliente" },
  ];

  return (
    <div className="flex h-full">
      {/* Conversation List */}
      <div className="w-80 border-r border-border bg-card flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-border">
          {instances.length > 0 && (
            <div className="flex gap-2 mb-3">
              <select
                title="Instância usada para responder"
                value={selectedInstance}
                onChange={(e) => handleInstanceChange(e.target.value)}
                className="flex-1 h-9 px-2 bg-muted/60 rounded-lg text-sm focus:outline-none focus:bg-card focus:ring-1 focus:ring-primary"
              >
                {instances.map((inst) => {
                  const name = inst.name || inst.instance?.instanceName || "";
                  return <option key={name} value={name}>{name}</option>;
                })}
              </select>
              <button
                onClick={handleLoadConversations}
                disabled={loadingConversations}
                title="Carregar conversas"
                className="h-9 w-9 flex items-center justify-center bg-muted/60 rounded-lg hover:bg-muted disabled:opacity-50 flex-shrink-0"
              >
                <RefreshCw className={`w-4 h-4 text-muted-foreground ${loadingConversations ? "animate-spin" : ""}`} />
              </button>
            </div>
          )}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar conversa..."
              className="w-full h-9 pl-9 pr-3 bg-muted/60 rounded-lg text-sm focus:outline-none focus:bg-card focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-thin">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  filter === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada</div>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`w-full flex gap-3 p-4 border-b border-border text-left hover:bg-muted/40 transition-colors ${
                  selectedId === conv.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold text-sm">
                    {conv.customer_name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  {conv.is_ai && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center border-2 border-card">
                      <Bot className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{conv.customer_name}</p>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {conv.last_message_time ? new Date(conv.last_message_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.last_message || "Sem mensagens"}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <ChannelBadge channel={conv.channel} />
                    {conv.instance && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">{conv.instance}</span>
                    )}
                    {conv.unread && <span className="w-2 h-2 rounded-full bg-primary" />}
                    {conv.priority === "urgente" && <span className="text-xs text-red-600 font-medium">Urgente</span>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <div className="h-16 border-b border-border bg-card flex items-center gap-3 px-5 flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold">
                {selected.customer_name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{selected.customer_name}</p>
                <div className="flex items-center gap-2">
                  <ChannelBadge channel={selected.channel} />
                  {selected.instance && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">{selected.instance}</span>
                  )}
                  <span className="text-xs text-muted-foreground">Protocolo: {selected.protocol || "N/A"}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-2 hover:bg-muted rounded-lg"><Phone className="w-5 h-5 text-muted-foreground" /></button>
                <button className="p-2 hover:bg-muted rounded-lg"><Video className="w-5 h-5 text-muted-foreground" /></button>
                <button className="p-2 hover:bg-muted rounded-lg"><MoreVertical className="w-5 h-5 text-muted-foreground" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-5 bg-muted/20">
              <div className="max-w-2xl mx-auto space-y-3">
                {loadingMessages ? (
                  <p className="text-center text-sm text-muted-foreground">Carregando mensagens...</p>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">Nenhuma mensagem nesta conversa</p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.direction === "out" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] ${msg.direction === "out" ? "bg-primary text-primary-foreground" : "bg-card border border-border"} rounded-2xl px-4 py-2.5`}>
                        {msg.type === "audio" ? (
                          <div className="flex items-center gap-2">
                            <button className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                              <Mic className="w-4 h-4" />
                            </button>
                            <div className="flex items-center gap-0.5">
                              {[3,5,8,6,10,7,4,9,5,3,6,8,4,7,5].map((h, i) => (
                                <div key={i} className={`w-0.5 rounded-full ${msg.direction === "out" ? "bg-primary-foreground/60" : "bg-muted-foreground/40"}`} style={{ height: `${h*2}px` }} />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm">{msg.content}</p>
                        )}
                        <div className="flex items-center gap-1 mt-1 justify-end">
                          {msg.sender_name && <span className={`text-xs ${msg.direction === "out" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{msg.sender_name}</span>}
                          <span className={`text-xs ${msg.direction === "out" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                          {msg.direction === "out" && <CheckCircle className="w-3.5 h-3.5 text-primary-foreground/70" />}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-3 border-t border-border bg-card flex-shrink-0">
              <div className="flex items-center gap-2">
                <button className="p-2.5 hover:bg-muted rounded-lg"><Paperclip className="w-5 h-5 text-muted-foreground" /></button>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 h-10 px-4 bg-muted/60 rounded-lg text-sm focus:outline-none focus:bg-card focus:ring-1 focus:ring-primary"
                />
                <button onClick={handleSend} disabled={sending} className="p-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Send className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Selecione uma conversa para começar</p>
            </div>
          </div>
        )}
      </div>

      {/* Customer Panel */}
      <div className="w-72 border-l border-border bg-card flex-shrink-0 hidden xl:flex flex-col overflow-y-auto scrollbar-thin">
        {selected && (
          <>
            <div className="p-5 text-center border-b border-border">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-xl mx-auto mb-2">
                {selected.customer_name?.charAt(0)?.toUpperCase()}
              </div>
              <p className="font-semibold">{selected.customer_name}</p>
              <p className="text-sm text-muted-foreground">{selected.phone}</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <StatusBadge status={selected.status} />
                <PriorityBadge priority={selected.priority} />
              </div>
            </div>

            <div className="p-4 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Setor</p>
              <p className="text-sm">{selected.sector || "Não atribuído"}</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 mt-3">Atendente</p>
              <p className="text-sm">{selected.attendant_name || "Não atribuído"}</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 mt-3">Cidade</p>
              <p className="text-sm">{selected.city || "—"}</p>
            </div>

            <div className="p-4 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Ações Rápidas</p>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  const isBoleto = action.action === "sendBoleto";
                  return (
                    <button
                      key={action.label}
                      onClick={isBoleto ? handleSendBoleto : undefined}
                      disabled={isBoleto && sendingBoleto}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50 ${action.color}`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium text-center">{isBoleto && sendingBoleto ? "Enviando..." : action.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4">
              <button className="w-full py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 mb-2 flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" /> Finalizar Atendimento
              </button>
              <button className="w-full py-2.5 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/70 flex items-center justify-center gap-2">
                <Star className="w-4 h-4" /> Enviar Pesquisa
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}