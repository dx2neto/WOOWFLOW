import React, { useState, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useConversations, useMessages, useEntityList, useEntityCreate, useEntityUpdate, useEntityBulkCreate, useEntityDelete } from "@/hooks/useEntityQueries";
import { useEvolutionInbox } from "@/hooks/useEvolutionInbox";
import { useUnifiedChannels } from "@/hooks/useUnifiedChannels";
import { useInboxDerived } from "@/hooks/useInboxDerived";
import { useInboxActions } from "@/hooks/useInboxActions";
import { useInboxMessaging } from "@/hooks/useInboxMessaging";
import { useInboxRealtime } from "@/hooks/useInboxRealtime";
import { useInboxQuickActions } from "@/hooks/useInboxQuickActions";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useIxcPreAnalysis } from "@/hooks/useIxcPreAnalysis";
import { channelTabs, defaultForm } from "@/components/inbox/inboxConstants";
import InboxHeader from "@/components/inbox/InboxHeader";
import UnifiedChannelOverview from "@/components/inbox/UnifiedChannelOverview";
import ConversationList from "@/components/inbox/ConversationList";
import ChatArea from "@/components/inbox/ChatArea";
import RightPanel from "@/components/inbox/RightPanel";
import MetricsBar from "@/components/inbox/MetricsBar";
import NewConversationModal from "@/components/inbox/modals/NewConversationModal";
import FinalizeModal from "@/components/inbox/modals/FinalizeModal";
import TransferModal from "@/components/inbox/modals/TransferModal";
import ClearConversationsModal from "@/components/inbox/modals/ClearConversationsModal";
import { useToast } from "@/components/ui/use-toast";

export default function Inbox() {
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { toast } = useToast();

  // ── React Query: conversas, mensagens, configs, templates, users ──────────
  const [selectedId, setSelectedId] = useState(null);
  const { data: conversations = [], isLoading: loading } = useConversations(100);
  const { data: messages = [], isLoading: loadingMessages } = useMessages(selectedId);
  const { data: configList = [] } = useEntityList("IntegrationConfig", "-updated_at", 200);
  const { data: templates = [] } = useEntityList("MessageTemplate", "name", 100);
  const { data: users = [] } = useEntityList("User", "full_name", 100);

  const convCreate = useEntityCreate("Conversation");
  const convUpdate = useEntityUpdate("Conversation");
  const convBulkCreate = useEntityBulkCreate("Conversation");
  const msgCreate = useEntityCreate("Message");
  const convDeleteMany = useEntityDelete("Conversation");

  // ── Estado local de UI ────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState("all");
  const [rightTab, setRightTab] = useState("dados");

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

  // ── Ações de conversa (finalizar, transferir, limpar) ───────────────────────
  const {
    showFinalizeModal, setShowFinalizeModal, finalizeNote, setFinalizeNote, finalizing, handleFinalize,
    showTransferModal, setShowTransferModal, transferSector, setTransferSector, transferAttendant, setTransferAttendant, transferring, handleTransfer,
    showClearModal, setShowClearModal, clearing, handleClearConversations, handleClearAllConversations,
  } = useInboxActions({ selected, conversations, setSelectedId, convUpdate, msgCreate, convCreate, convDeleteMany, users });

  const configs = useMemo(() => {
    const map = {};
    configList.forEach((item) => { map[item.service] = item; });
    return map;
  }, [configList]);

  // ── Hook: toda a lógica de Evolution API encapsulada ──────────────────────
  const {
    instances, loadingInstances, instancesError, selectedInstance, syncingHistory, sendingMedia,
    waResults, searchingWa, loadingConvsFromWa, selectedInstanceState,
    query, channel, setQuery, setChannel,
    setSelectedInstance: handleInstanceChange,
    loadInstances, syncEvolutionHistory, handleLoadWhatsAppConversations,
    startConversationFromWa, handleSendFile,
  } = useEvolutionInbox({
    conversations, selected, selectedId, setSelectedId,
    convCreate, convUpdate, convBulkCreate, msgCreate,
  });

  // ── Hook: status unificado de todos os canais (WhatsApp, PABX, Instagram, etc.) ──
  const {
    channelStats, totalActive, totalChannels,
  } = useUnifiedChannels({ conversations, selectedInstanceState, instances });

  // ── Limpar tudo e importar conversas do WhatsApp (Evolution API) ─────────
  const handleClearAndImportEvolution = () => handleClearAllConversations(async () => {
    qc.invalidateQueries({ queryKey: ["conversations"] });
    qc.invalidateQueries({ queryKey: ["Conversation"] });
    await handleLoadWhatsAppConversations({ forceImport: true });
  });

  // ── Hook: envio de mensagens e chamada WhatsApp ───────────────────────────
  const {
    message, setMessage, sending, messageMode, setMessageMode,
    sendMessageContent, handleSend, handleWhatsAppCall,
  } = useInboxMessaging({ selected, selectedInstance, msgCreate, convUpdate });

  // ── Hook: integrações rápidas (IXC, Serasa, ZapSign) ───────────────────────
  const { actionLoading, handleQuickIntegration } = useInboxQuickActions({
    selected, syncEvolutionHistory, handleLoadWhatsAppConversations,
  });

  // ── Hook: gravação de áudio no navegador ───────────────────────────────────
  const audioRecorder = useAudioRecorder();

  // ── Hook: pré-análise automática do cliente no IXCSoft ─────────────────────
  const { data: ixcAnalysis, loading: ixcLoading, refetch: refetchIxc } = useIxcPreAnalysis(selected);

  // ── Hook: efeitos de realtime e sincronização ─────────────────────────────
  useInboxRealtime({
    qc, conversations, selectedId, selected, selectedInstance,
    messages, loadingMessages, convUpdate, syncEvolutionHistory,
    messagesEndRef, showShortcuts, setShowShortcuts, setSelectedId,
    searchParams,
  });

  // ── Handlers de mídia (file input) ─────────────────────────────────────────
  const handleAttachClick = () => fileInputRef.current?.click();
  const handleAudioClick  = () => audioInputRef.current?.click();
  const handleFileChange  = (e) => { const f = e.target.files?.[0]; if (f) handleSendFile(f); e.target.value = ""; };
  const handleAudioChange = (e) => { const f = e.target.files?.[0]; if (f) handleSendFile(f, "audio"); e.target.value = ""; };

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

  // ── Dados derivados ────────────────────────────────────────────────────────
  const { channelCounts, metrics, filtered, filteredTemplates, availableSectors } = useInboxDerived({
    conversations, templates, query, channel, statusFilter, selectedInstance, templateSearch,
  });

  return (
    <div className="h-full overflow-hidden bg-background flex flex-col">
      <InboxHeader
        instances={instances} selectedInstance={selectedInstance}
        loadingInstances={loadingInstances} instancesError={instancesError}
        onInstanceChange={handleInstanceChange} onReloadInstances={loadInstances}
        loadingConvsFromWa={loadingConvsFromWa} onLoadWhatsAppConversations={handleLoadWhatsAppConversations}
        onNewConversation={() => setShowNewConversation(true)} onClear={() => setShowClearModal(true)}
        conversationsCount={conversations.length}
        channel={channel} setChannel={setChannel} channelCounts={channelCounts}
        selectedInstanceState={selectedInstanceState}
      />

      <UnifiedChannelOverview
        channelStats={channelStats}
        totalActive={totalActive}
        totalChannels={totalChannels}
        onChannelSelect={setChannel}
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
          audioRecorder={audioRecorder}
        />

        <RightPanel
          selected={selected} rightTab={rightTab} setRightTab={setRightTab}
          configs={configs} selectedInstanceState={selectedInstanceState}
          actionLoading={actionLoading} handleQuickIntegration={handleQuickIntegration}
          onFinalize={() => setShowFinalizeModal(true)} onTransfer={() => setShowTransferModal(true)}
          onSend={sendMessageContent} sending={sending}
          onSelect={setSelectedId}
          ixcAnalysis={ixcAnalysis} ixcLoading={ixcLoading} onRefetchIxc={refetchIxc}
          convUpdate={convUpdate}
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
        onConfirm={handleClearConversations} onConfirmAll={handleClearAllConversations}
        onClearAndImport={handleClearAndImportEvolution}
        onClose={() => setShowClearModal(false)} clearing={clearing}
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