import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useConversations, useMessages, useEntityList, useEntityCreate, useEntityUpdate, useEntityBulkCreate, useEntityDelete } from "@/hooks/useEntityQueries";
import { useEvolutionInbox } from "@/hooks/useEvolutionInbox";
import { useInboxMessaging } from "@/hooks/useInboxMessaging";
import { useInboxActions } from "@/hooks/useInboxActions";
import { useInboxDerived } from "@/hooks/useInboxDerived";
import { channelTabs } from "@/components/inbox/inboxConstants";
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

export default function Inbox() {
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [rightTab, setRightTab] = useState("dados");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  const selected = conversations.find((c) => c.id === selectedId);

  const configs = useMemo(() => {
    const map = {};
    configList.forEach((item) => { map[item.service] = item; });
    return map;
  }, [configList]);

  // ── Hook: toda a lógica de Evolution API encapsulada ──────────────────────
  const evolution = useEvolutionInbox({
    conversations, selected, selectedId, setSelectedId,
    convCreate, convUpdate, convBulkCreate, msgCreate,
  });

  // ── Hook: envio de mensagens ──────────────────────────────────────────────
  const messaging = useInboxMessaging({
    selected, selectedInstance: evolution.selectedInstance,
    msgCreate, convUpdate, handleSendFile: evolution.handleSendFile,
  });

  // ── Hook: ações operacionais (finalizar, transferir, criar, limpar) ────────
  const actions = useInboxActions({
    conversations, selected, selectedInstance: evolution.selectedInstance,
    setSelectedId, convCreate, convUpdate, convDeleteMany, msgCreate, users,
    syncEvolutionHistory: evolution.syncEvolutionHistory,
    handleLoadWhatsAppConversations: evolution.handleLoadWhatsAppConversations,
  });

  // ── Hook: dados derivados (métricas, filtros, contagens) ──────────────────
  const derived = useInboxDerived({
    conversations, templates,
    query: evolution.query, channel: evolution.channel,
    selectedInstance: evolution.selectedInstance, statusFilter, templateSearch,
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
    if (selected.channel === "whatsapp" && evolution.selectedInstance) {
      evolutionApi({ action: "mark_read", phone: selected.phone, instance: evolution.selectedInstance, conversation_id: selected.id }).catch(() => {});
    }
  }, [selectedId]);

  // ── Solicita histórico Evolution se não houver mensagens ───────────────────
  useEffect(() => {
    if (!selectedId || loadingMessages || messages.length > 0) return;
    const conv = conversations.find((c) => c.id === selectedId);
    if (conv?.channel === "whatsapp" && conv?.phone) {
      evolution.syncEvolutionHistory(conv, false).catch(() => {});
    }
  }, [selectedId, messages, loadingMessages]);

  // ── Scroll automático ─────────────────────────────────────────────────────
  useEffect(() => {
    messaging.messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  const handleWhatsAppCall = useCallback(() => {
    if (!selected?.phone) return;
    window.open(`https://wa.me/${selected.phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer");
  }, [selected]);

  return (
    <div className="h-full overflow-hidden bg-background flex flex-col">
      <InboxHeader
        instances={evolution.instances} selectedInstance={evolution.selectedInstance}
        onInstanceChange={evolution.setSelectedInstance} onReloadInstances={evolution.loadInstances}
        loadingConvsFromWa={evolution.loadingConvsFromWa} onLoadWhatsAppConversations={evolution.handleLoadWhatsAppConversations}
        onNewConversation={() => actions.setShowNewConversation(true)} onClear={() => actions.setShowClearModal(true)}
        conversationsCount={conversations.length}
        channel={evolution.channel} setChannel={evolution.setChannel} channelCounts={derived.channelCounts}
        selectedInstanceState={evolution.selectedInstanceState}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[360px_minmax(460px,1fr)_340px]">
        <ConversationList
          loading={loading} conversations={conversations} filtered={derived.filtered}
          selectedId={selectedId} onSelect={setSelectedId}
          query={evolution.query} setQuery={evolution.setQuery}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          channel={evolution.channel} channelCounts={derived.channelCounts}
          waResults={evolution.waResults} searchingWa={evolution.searchingWa}
          startConversationFromWa={evolution.startConversationFromWa}
        />

        <ChatArea
          selected={selected} messages={messages} loadingMessages={loadingMessages}
          selectedInstance={evolution.selectedInstance}
          syncingHistory={evolution.syncingHistory} sending={messaging.sending} sendingMedia={evolution.sendingMedia}
          messageMode={messaging.messageMode} setMessageMode={messaging.setMessageMode}
          message={messaging.message} setMessage={messaging.setMessage}
          onSend={messaging.handleSend} onSyncHistory={evolution.syncEvolutionHistory}
          onWhatsAppCall={handleWhatsAppCall}
          onAttachClick={messaging.handleAttachClick} onAudioClick={messaging.handleAudioClick}
          onFileChange={messaging.handleFileChange} onAudioChange={messaging.handleAudioChange}
          fileInputRef={messaging.fileInputRef} audioInputRef={messaging.audioInputRef} messagesEndRef={messaging.messagesEndRef}
          showShortcuts={showShortcuts} setShowShortcuts={setShowShortcuts}
          templates={templates} filteredTemplates={derived.filteredTemplates}
          templateSearch={templateSearch} setTemplateSearch={setTemplateSearch}
        />

        <RightPanel
          selected={selected} rightTab={rightTab} setRightTab={setRightTab}
          configs={configs} selectedInstanceState={evolution.selectedInstanceState}
          actionLoading={actions.actionLoading} handleQuickIntegration={actions.handleQuickIntegration}
          onFinalize={() => actions.setShowFinalizeModal(true)} onTransfer={() => actions.setShowTransferModal(true)}
          onSend={messaging.sendMessageContent} sending={messaging.sending}
          onSelect={setSelectedId}
        />
      </div>

      <MetricsBar metrics={derived.metrics} />

      <NewConversationModal
        show={actions.showNewConversation} form={actions.form} setForm={actions.setForm}
        onSubmit={actions.createConversation} onClose={() => actions.setShowNewConversation(false)}
        creating={actions.creating} availableSectors={actions.availableSectors} channelTabs={channelTabs}
      />
      <FinalizeModal
        show={actions.showFinalizeModal} selected={selected}
        note={actions.finalizeNote} setNote={actions.setFinalizeNote}
        onConfirm={actions.handleFinalize} onClose={() => actions.setShowFinalizeModal(false)}
        finalizing={actions.finalizing}
      />
      <ClearConversationsModal
        show={actions.showClearModal} count={conversations.length}
        onConfirm={actions.handleClearConversations} onClose={() => actions.setShowClearModal(false)}
        clearing={actions.clearing}
      />
      <TransferModal
        show={actions.showTransferModal} selected={selected}
        sector={actions.transferSector} setSector={actions.setTransferSector}
        attendant={actions.transferAttendant} setAttendant={actions.setTransferAttendant}
        users={users} availableSectors={actions.availableSectors}
        onConfirm={actions.handleTransfer} onClose={() => actions.setShowTransferModal(false)}
        transferring={actions.transferring}
      />
    </div>
  );
}