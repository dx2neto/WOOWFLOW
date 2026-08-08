import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useConversations, useMessages, useEntityList, useEntityCreate, useEntityUpdate, useEntityBulkCreate, useEntityDelete } from "@/hooks/useEntityQueries";
import { useEvolutionInbox } from "@/hooks/useEvolutionInbox";
import { useInboxDerived } from "@/hooks/useInboxDerived";
import { useInboxActions } from "@/hooks/useInboxActions";
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [rightTab, setRightTab] = useState("dados");
  const [actionLoading, setActionLoading] = useState(null);

  // Modais
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [creating, setCreating] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  const fileInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const selected = conversations.find((c) => c.id === selectedId);

  // ── Ações de conversa (finalizar, transferir, limpar) extraídas para hook ───
  const {
    showFinalizeModal, setShowFinalizeModal, finalizeNote, setFinalizeNote, finalizing, handleFinalize,
    showTransferModal, setShowTransferModal, transferSector, setTransferSector, transferAttendant, setTransferAttendant, transferring, handleTransfer,
    showClearModal, setShowClearModal, clearing, handleClearConversations,
  } = useInboxActions({ selected, conversations, setSelectedId, convUpdate, msgCreate, convCreate, convDeleteMany, users });

  const configs = useMemo(() => {
    const map = {};
    configList.forEach((item) => { map[item.service] = item; });
    return map;
  }, [configList]);

  // ── Hook: toda a lógica de Evolution API encapsulada ──────────────────────
  const {
    instances, selectedInstance, syncingHistory, sendingMedia,
    waResults, searchingWa, loadingConvsFromWa, selectedInstanceState,
    query, channel, setQuery, setChannel,
    setSelectedInstance: handleInstanceChange,
    loadInstances, syncEvolutionHistory, handleLoadWhatsAppConversations,
    startConversationFromWa, handleSendFile,
  } = useEvolutionInbox({
    conversations, selected, selectedId, setSelectedId,
    convCreate, convUpdate, convBulkCreate, msgCreate,
  });

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

  const handleAttachClick = () => fileInputRef.current?.click();
  const handleAudioClick  = () => audioInputRef.current?.click();
  const handleFileChange  = (e) => { const f = e.target.files?.[0]; if (f) handleSendFile(f); e.target.value = ""; };
  const handleAudioChange = (e) => { const f = e.target.files?.[0]; if (f) handleSendFile(f, "audio"); e.target.value = ""; };

  const handleWhatsAppCall = useCallback(() => {
    if (!selected?.phone) return;
    window.open(`https://wa.me/${selected.phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer");
  }, [selected]);

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

  // ── Dados derivados (extraídos para hook) ───────────────────────────────────
  const { channelCounts, metrics, filtered, filteredTemplates, availableSectors } = useInboxDerived({
    conversations, templates, query, channel, statusFilter, selectedInstance, templateSearch,
  });

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
        onConfirm={() => handleTransfer(availableSectors)} onClose={() => setShowTransferModal(false)}
        transferring={transferring}
      />
    </div>
  );
}