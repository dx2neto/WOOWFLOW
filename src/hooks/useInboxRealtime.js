import { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { evolutionApi } from "@/functions/evolutionApi";

/**
 * Hook que encapsula todos os efeitos colaterais de tempo real do Inbox:
 * - Inscrição em alterações de Conversation (invalida cache)
 * - Inscrição em alterações de Message da conversa ativa
 * - Abertura de conversa via ?conversation=ID
 * - Auto-seleção da primeira conversa
 * - Marcação como lida ao selecionar
 * - Solicitação de histórico Evolution quando vazio
 * - Scroll automático para a última mensagem
 * - Fechamento do painel de atalhos ao clicar fora
 *
 * @param {object} params
 * @param {object} params.qc - Instância do QueryClient
 * @param {array}  params.conversations
 * @param {string} params.selectedId
 * @param {object} params.selected
 * @param {string} params.selectedInstance
 * @param {array}  params.messages
 * @param {boolean} params.loadingMessages
 * @param {function} params.convUpdate - Mutation de update de Conversation
 * @param {function} params.syncEvolutionHistory
 * @param {object} params.messagesEndRef - Ref do scroll
 * @param {boolean} params.showShortcuts
 * @param {function} params.setShowShortcuts
 * @param {function} params.setSelectedId
 * @param {object} params.searchParams - useSearchParams result
 */
export function useInboxRealtime({
  qc,
  conversations,
  selectedId,
  selected,
  selectedInstance,
  messages,
  loadingMessages,
  convUpdate,
  syncEvolutionHistory,
  messagesEndRef,
  showShortcuts,
  setShowShortcuts,
  setSelectedId,
  searchParams,
}) {
  // ── Realtime: invalida cache de conversas ─────────────────────────────────
  useEffect(() => {
    const unsub = base44.entities.Conversation.subscribe(() => {
      qc.invalidateQueries({ queryKey: ["Conversation"] });
    });
    return unsub;
  }, [qc]);

  // ── Realtime: invalida cache de mensagens da conversa selecionada ──────────
  useEffect(() => {
    if (!selectedId) return;
    const unsub = base44.entities.Message.subscribe((event) => {
      // event.data pode ser o registro direto ou estar aninhado conforme o tipo de evento
      const rec = event.data?.data || event.data || {};
      if (rec.conversation_id && rec.conversation_id !== selectedId) return;
      qc.invalidateQueries({ queryKey: ["Message"] });
    });
    return unsub;
  }, [selectedId, qc]);

  // ── Abre conversa via ?conversation=ID ────────────────────────────────────
  useEffect(() => {
    const cid = searchParams.get("conversation");
    if (cid && conversations.some((c) => c.id === cid)) setSelectedId(cid);
  }, [conversations, searchParams, setSelectedId]);

  // ── Auto-seleciona primeira conversa ──────────────────────────────────────
  useEffect(() => {
    if (!selectedId && conversations.length > 0) setSelectedId(conversations[0].id);
  }, [conversations, selectedId, setSelectedId]);

  // ── Marca como lida ao selecionar conversa ─────────────────────────────────
  useEffect(() => {
    if (!selected || !selected.unread) return;
    convUpdate.mutateAsync({ id: selected.id, data: { unread: false } }).catch(() => {});
    if (selected.channel === "whatsapp" && selectedInstance) {
      evolutionApi({ action: "mark_read", phone: selected.phone, instance: selectedInstance, conversation_id: selected.id }).catch(() => {});
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Solicita histórico Evolution se não houver mensagens ───────────────────
  useEffect(() => {
    if (!selectedId || loadingMessages || messages.length > 0) return;
    const conv = conversations.find((c) => c.id === selectedId);
    if (conv?.channel === "whatsapp" && conv?.phone) {
      syncEvolutionHistory(conv, false).catch(() => {});
    }
  }, [selectedId, messages, loadingMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll automático ─────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, messagesEndRef]);

  // ── Fecha atalhos ao clicar fora ──────────────────────────────────────────
  useEffect(() => {
    if (!showShortcuts) return;
    const handler = (e) => {
      if (!e.target.closest("[data-shortcuts-panel]")) setShowShortcuts(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showShortcuts, setShowShortcuts]);
}