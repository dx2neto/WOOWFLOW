import { useState } from "react";
import { base44 } from "@/api/base44Client";
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

  // ── Limpar conversas ──────────────────────────────────────────────────────
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
    clearing, handleClearConversations,
  };
}