import { useMemo } from "react";
import { useEntityList } from "@/hooks/useEntityQueries";

/**
 * Hook que agrega o status de todos os canais do Inbox Omnichannel:
 * - WhatsApp (Evolution API): status da instância selecionada
 * - PABX/Telefonia: chamadas recentes da entidade Call
 * - Instagram, Facebook, Chat interno, E-mail: contagem de conversas
 *
 * Retorna estatísticas por canal e a lista de chamadas PABX recentes.
 */
export function useUnifiedChannels({ conversations = [], selectedInstanceState = "disconnected", instances = [] }) {
  const { data: calls = [], isLoading: loadingCalls } = useEntityList(
    "Call", "-created_date", 50
  );

  const channelStats = useMemo(() => {
    const countBy = (ch) => conversations.filter((c) => c.channel === ch).length;

    const whatsappConnected = selectedInstanceState === "connected";
    const pabxActive = calls.length > 0;
    const missedCalls = calls.filter((c) => c.status === "perdida" || c.status === "abandonada").length;

    return {
      whatsapp: {
        count: countBy("whatsapp"),
        status: whatsappConnected ? "connected" : "disconnected",
        detail: whatsappConnected ? `${instances.length} instância(s)` : "Verificar conexão",
      },
      telefone: {
        count: calls.length,
        status: pabxActive ? "connected" : "pending",
        detail: missedCalls > 0 ? `${missedCalls} chamada(s) perdida(s)` : "PABX ativo",
      },
      instagram: {
        count: countBy("instagram"),
        status: "pending",
        detail: "Conectar OAuth",
      },
      facebook: {
        count: countBy("facebook"),
        status: "pending",
        detail: "Não configurado",
      },
      chat_interno: {
        count: countBy("chat_interno"),
        status: "connected",
        detail: "Interno ativo",
      },
      chat_externo: {
        count: countBy("chat_externo"),
        status: "connected",
        detail: "Externo ativo",
      },
      telegram: {
        count: countBy("telegram"),
        status: "pending",
        detail: "Não configurado",
      },
      email: {
        count: countBy("email"),
        status: "pending",
        detail: "Não configurado",
      },
    };
  }, [conversations, calls, selectedInstanceState, instances]);

  const totalActive = useMemo(() => {
    return Object.values(channelStats).filter((s) => s.status === "connected").length;
  }, [channelStats]);

  const totalChannels = Object.keys(channelStats).length;

  return { channelStats, calls, loadingCalls, totalActive, totalChannels };
}