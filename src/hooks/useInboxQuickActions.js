import { useState } from "react";
import { ixcApi } from "@/functions/ixcApi";
import { serasaApi } from "@/functions/serasaApi";
import { zapsignApi } from "@/functions/zapsignApi";
import { useToast } from "@/components/ui/use-toast";

/**
 * Hook que encapsula as integrações rápidas do painel lateral do Inbox:
 * - Evolution API (sincronizar histórico / carregar conversas)
 * - IXC Provedor (consulta de clientes)
 * - Serasa (validação de cadastro)
 * - ZapSign (dashboard de assinaturas)
 *
 * @param {object} params
 * @param {object} params.selected - Conversa selecionada
 * @param {function} params.syncEvolutionHistory
 * @param {function} params.handleLoadWhatsAppConversations
 */
export function useInboxQuickActions({ selected, syncEvolutionHistory, handleLoadWhatsAppConversations }) {
  const { toast } = useToast();
  const [actionLoading, setActionLoading] = useState(null);

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

  return { actionLoading, handleQuickIntegration };
}