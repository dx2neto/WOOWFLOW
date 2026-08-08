import { useMemo } from "react";
import { MessageCircle, Headphones, Clock3, CheckCircle, Star, AlertCircle } from "lucide-react";

/**
 * Hook que encapsula todos os dados derivados do Inbox:
 * - channelCounts: contagem por canal
 * - metrics: estatísticas para a barra de métricas
 * - filtered: conversas filtradas por canal, status, instância e busca
 * - filteredTemplates: templates filtrados por busca
 * - availableSectors: lista de setores disponíveis
 *
 * @param {object} params
 * @param {array}  params.conversations
 * @param {array}  params.templates
 * @param {string} params.query
 * @param {string} params.channel
 * @param {string} params.statusFilter
 * @param {string} params.selectedInstance
 * @param {string} params.templateSearch
 */
export function useInboxDerived({
  conversations = [],
  templates = [],
  query = "",
  channel = "all",
  statusFilter = "all",
  selectedInstance = "",
  templateSearch = "",
}) {
  const channelCounts = useMemo(() => {
    const counts = { all: conversations.length };
    for (const c of conversations) counts[c.channel] = (counts[c.channel] || 0) + 1;
    return counts;
  }, [conversations]);

  const metrics = useMemo(() => {
    const active   = conversations.filter((c) => c.status === "em_atendimento").length;
    const waiting  = conversations.filter((c) => ["novo", "aguardando_atendimento", "aguardando_setor"].includes(c.status)).length;
    const resolved = conversations.filter((c) => ["resolvido", "finalizado"].includes(c.status)).length;
    const unread   = conversations.filter((c) => c.unread).length;
    const scores   = conversations.map((c) => Number(c.satisfaction_score)).filter(Boolean);
    const sat      = scores.length ? (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1) : "—";
    return [
      { label: "Total",          value: conversations.length, icon: MessageCircle },
      { label: "Em atendimento", value: active,              icon: Headphones    },
      { label: "Na fila",        value: waiting,             icon: Clock3        },
      { label: "Resolvidas",     value: resolved,            icon: CheckCircle   },
      { label: "Satisfação",     value: sat,                 icon: Star          },
      ...(unread > 0 ? [{ label: "Não lidos", value: unread, icon: AlertCircle }] : []),
    ];
  }, [conversations]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return conversations.filter((conv) => {
      if (channel !== "all" && conv.channel !== channel) return false;
      if (channel === "whatsapp" && selectedInstance && conv.instance && conv.instance !== selectedInstance) return false;
      if (statusFilter !== "all" && conv.status !== statusFilter) return false;
      if (term && ![conv.customer_name, conv.phone, conv.protocol, conv.last_message, conv.city].filter(Boolean).some((v) => String(v).toLowerCase().includes(term))) return false;
      return true;
    });
  }, [channel, conversations, query, statusFilter, selectedInstance]);

  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return templates;
    const t = templateSearch.toLowerCase();
    return templates.filter((tp) => (tp.title || "").toLowerCase().includes(t) || (tp.content || "").toLowerCase().includes(t));
  }, [templates, templateSearch]);

  const availableSectors = useMemo(() => {
    const fromConvs = [...new Set(conversations.map((c) => c.sector).filter(Boolean))];
    const defaults  = ["Atendimento", "Suporte Técnico", "Financeiro", "Comercial", "Cobrança", "Retenção", "NOC"];
    return [...new Set([...fromConvs, ...defaults])];
  }, [conversations]);

  return { channelCounts, metrics, filtered, filteredTemplates, availableSectors };
}