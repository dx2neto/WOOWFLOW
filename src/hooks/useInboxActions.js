import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { sendClosingSummaryToCrm } from "@/functions/sendClosingSummaryToCrm";
import { useToast } from "@/components/ui/use-toast";

/**
 * Hook que encapsula as ações de conversa do Inbox:
 * - Finalizar atendimento
 * - Transferir conversa
 * - Criar nova conversa manual
 * - Limpar todas as conversas
 *
 * @param {object} params
 * @param {object} params.selected - Conversa selecionada atualmente
 * @param {array}  params.conversations - Lista de conversas
 * @param {function} params.setSelectedId - Setter do ID selecionado
 * @param {function} params.convUpdate - Mutation de update de Conversation
 * @param {function} params.msgCreate - Mutation de create de Message
 * @param {function} params.convCreate - Mutation de create de Conversation
 * @param {function} params.convDeleteMany - Mutation de deleteMany de Conversation
 * @param {array}  params.users - Lista de usuários (para nome do atendente na transferência)
 */
export function useInboxActions({
  selected,
  conversations = [],
  setSelectedId,
  convUpdate,
  msgCreate,
  convCreate,
  convDeleteMany,
  users = [],
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Estados de modal ──────────────────────────────────────────────────────
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizeNote, setFinalizeNote] = useState("");
  const [finalizing, setFinalizing] = useState(false);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSector, setTransferSector] = useState("");
  const [transferAttendant, setTransferAttendant] = useState("");
  const [transferring, setTransferring] = useState(false);

  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);

  // ── Finalizar ──────────────────────────────────────────────────────────────
  const handleFinalize = async () => {
    if (!selected || finalizing) return;
    setFinalizing(true);
    try {
      const now = new Date().toISOString();
      await convUpdate.mutateAsync({ id: selected.id, data: { status: "finalizado", resolved_at: now, ai_enabled: true, is_ai: true } });
      if (finalizeNote.trim()) {
        await msgCreate.mutateAsync({
          conversation_id: selected.id, content: `[Encerrado] ${finalizeNote.trim()}`,
          direction: "internal", type: "system", timestamp: now, sender_name: "Sistema",
        });
      }

      // ── Lara envia resumo de encerramento com dados 360 para o CRM ──────────
      try {
        const crmResp = await sendClosingSummaryToCrm({
          conversation_id: selected.id,
          phone: selected.phone,
          customer_name: selected.customer_name,
          attendant_note: finalizeNote.trim(),
        });
        const crmData = crmResp?.data || crmResp;
        if (crmData?.needs_followup) {
          toast({ title: "CRM atualizado — follow-up necessário", description: crmData.followup_reason || "" });
        }
        qc.invalidateQueries({ queryKey: ["Lead"] });
      } catch { /* não bloqueia o fluxo de finalização */ }

      setShowFinalizeModal(false);
      setFinalizeNote("");
      toast({ title: "Atendimento finalizado com sucesso!" });
    } catch { toast({ title: "Erro ao finalizar", variant: "destructive" }); }
    finally { setFinalizing(false); }
  };

  // ── Transferir ─────────────────────────────────────────────────────────────
  const handleTransfer = async (availableSectors) => {
    if (!selected || !transferSector || transferring) return;
    setTransferring(true);
    try {
      const now = new Date().toISOString();
      const attendantName = users.find((u) => u.id === transferAttendant)?.full_name || "";
      await convUpdate.mutateAsync({
        id: selected.id,
        data: {
          sector: transferSector, status: "aguardando_atendimento", ai_enabled: false, is_ai: false,
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

  // ── Limpar conversas (apenas as filtradas/visíveis) ───────────────────────
  const handleClearConversations = async (visibleConversations) => {
    if (clearing) return;
    const list = Array.isArray(visibleConversations) ? visibleConversations : conversations;
    setClearing(true);
    try {
      const convIds = list.map((c) => c.id);
      if (convIds.length > 0) {
        await base44.entities.Message.deleteMany({ conversation_id: { $in: convIds } });
        await convDeleteMany.mutateAsync({ id: { $in: convIds } });
      }
      setSelectedId(null);
      setShowClearModal(false);
      qc.invalidateQueries({ queryKey: ["Conversation"] });
      qc.invalidateQueries({ queryKey: ["Message"] });
      toast({ title: `${convIds.length} conversa(s) removida(s)` });
    } catch { toast({ title: "Erro ao limpar conversas", variant: "destructive" }); }
    finally { setClearing(false); }
  };

  // ── Limpar TODAS as conversas e contatos ──────────────────────────────────
  // Se onAfterClear for passado, executa o callback em vez de mostrar o toast.
  const handleClearAllConversations = async (onAfterClear) => {
    if (clearing) return;
    setClearing(true);
    try {
      await base44.entities.Message.deleteMany({});
      await base44.entities.Conversation.deleteMany({});
      setSelectedId(null);
      setShowClearModal(false);
      qc.invalidateQueries({ queryKey: ["Conversation"] });
      qc.invalidateQueries({ queryKey: ["Message"] });
      if (onAfterClear) {
        await onAfterClear();
      } else {
        toast({ title: "Todas as conversas e contatos foram removidos" });
      }
    } catch { toast({ title: "Erro ao limpar conversas", variant: "destructive" }); }
    finally { setClearing(false); }
  };

  return {
    // Finalize
    showFinalizeModal, setShowFinalizeModal,
    finalizeNote, setFinalizeNote,
    finalizing, handleFinalize,
    // Transfer
    showTransferModal, setShowTransferModal,
    transferSector, setTransferSector,
    transferAttendant, setTransferAttendant,
    transferring, handleTransfer,
    // Clear
    showClearModal, setShowClearModal,
    clearing, handleClearConversations, handleClearAllConversations,
  };
}