import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { ixcApi } from "@/functions/ixcApi";
import { serasaApi } from "@/functions/serasaApi";
import { zapsignApi } from "@/functions/zapsignApi";
import { useToast } from "@/components/ui/use-toast";
import { defaultForm } from "@/components/inbox/inboxConstants";

/**
 * Hook que encapsula as ações operacionais do Inbox:
 * - Finalizar conversa
 * - Transferir conversa (setor/atendente)
 * - Criar nova conversa manual
 * - Limpar todas as conversas
 * - Integrações rápidas (IXC, Serasa, ZapSign)
 *
 * @param {object} params
 * @param {array}  params.conversations           - Lista de conversas
 * @param {object} params.selected                - Conversa selecionada
 * @param {string} params.selectedInstance         - Instância WhatsApp ativa
 * @param {function} params.setSelectedId          - Setter de conversa selecionada
 * @param {function} params.convCreate             - Mutation de criação
 * @param {function} params.convUpdate             - Mutation de atualização
 * @param {function} params.convDeleteMany         - Mutation de deleção em massa
 * @param {function} params.msgCreate              - Mutation de mensagem
 * @param {array}  params.users                    - Lista de usuários (para transferência)
 * @param {function} params.syncEvolutionHistory   - Sincronizar histórico Evolution
 * @param {function} params.handleLoadWhatsAppConversations - Importar conversas WA
 */
export function useInboxActions({
  conversations = [],
  selected,
  selectedInstance,
  setSelectedId,
  convCreate,
  convUpdate,
  convDeleteMany,
  msgCreate,
  users = [],
  syncEvolutionHistory,
  handleLoadWhatsAppConversations,
}) {
  const { toast } = useToast();

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

  const [actionLoading, setActionLoading] = useState(null);

  const availableSectors = useMemo(() => {
    const fromConvs = [...new Set(conversations.map((c) => c.sector).filter(Boolean))];
    const defaults = ["Atendimento", "Suporte Técnico", "Financeiro", "Comercial", "Cobrança", "Retenção", "NOC"];
    return [...new Set([...fromConvs, ...defaults])];
  }, [conversations]);

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
    } catch {
      toast({ title: "Erro ao finalizar", variant: "destructive" });
    } finally {
      setFinalizing(false);
    }
  };

  // ── Transferir ─────────────────────────────────────────────────────────────
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
    } catch {
      toast({ title: "Erro ao transferir", variant: "destructive" });
    } finally {
      setTransferring(false);
    }
  };

  // ── Nova conversa manual ────────────────────────────────────────────────────
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
    } catch {
      toast({ title: "Erro ao criar conversa", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  // ── Limpar todas as conversas ───────────────────────────────────────────────
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
    } catch {
      toast({ title: "Erro ao limpar conversas", variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  // ── Integrações rápidas ──────────────────────────────────────────────────────
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
        if (resp?.data?.error) {
          toast({ title: "Consulta Serasa não concluída", description: resp.data.error, variant: "destructive" });
          return;
        }
        toast({ title: "Consulta Serasa concluída" });
      }
      if (service === "zapsign") {
        const resp = await zapsignApi({ action: "dashboard" });
        const pending = resp?.data?.data?.pending ?? 0;
        toast({ title: "ZapSign consultado", description: `${pending} assinatura(s) pendente(s).` });
      }
    } catch {
      toast({ title: "Falha na integração", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  return {
    // Modais e estados
    showNewConversation, setShowNewConversation,
    form, setForm, creating,
    showFinalizeModal, setShowFinalizeModal,
    finalizing, finalizeNote, setFinalizeNote,
    showTransferModal, setShowTransferModal,
    transferring, transferSector, setTransferSector,
    transferAttendant, setTransferAttendant,
    showClearModal, setShowClearModal,
    clearing, actionLoading,
    availableSectors,
    // Handlers
    handleFinalize, handleTransfer, createConversation,
    handleClearConversations, handleQuickIntegration,
  };
}