import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Hooks reutilizáveis de React Query para entidades do Base44.
 *
 * PADRÃO DE QUERY KEY: [EntityName, subkey, ...params]
 * Todos os hooks específicos usam o mesmo prefixo (nome da entidade)
 * que os hooks genéricos invalidam, garantindo refresh automático.
 *
 * Uso:
 *   const { data, isLoading } = useConversations();
 *   const { mutateAsync } = useUpdateConversation();
 */

// ─── Conversation ────────────────────────────────────────────────────────────
export function useConversations(limit = 100) {
  return useQuery({
    queryKey: ["Conversation", "list", limit],
    queryFn: () => base44.entities.Conversation.list("-last_message_time", limit),
    staleTime: 10_000,
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => base44.entities.Conversation.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["Conversation"] }),
  });
}

// ─── Lead ─────────────────────────────────────────────────────────────────────
export function useLeads(limit = 200) {
  return useQuery({
    queryKey: ["Lead", "list", limit],
    queryFn: () => base44.entities.Lead.list("-created_date", limit),
    staleTime: 15_000,
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["Lead"] }),
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["Lead"] }),
  });
}

// ─── Customer ────────────────────────────────────────────────────────────────
export function useCustomers(limit = 100) {
  return useQuery({
    queryKey: ["Customer", "list", limit],
    queryFn: () => base44.entities.Customer.list("-created_date", limit),
    staleTime: 30_000,
  });
}

// ─── Charge ──────────────────────────────────────────────────────────────────
export function useCharges(limit = 100) {
  return useQuery({
    queryKey: ["Charge", "list", limit],
    queryFn: () => base44.entities.Charge.list("-created_date", limit),
    staleTime: 30_000,
  });
}

// ─── Message ──────────────────────────────────────────────────────────────────
export function useMessages(conversationId) {
  return useQuery({
    queryKey: ["Message", "filter", conversationId],
    queryFn: () => base44.entities.Message.filter({ conversation_id: conversationId }, "timestamp"),
    enabled: !!conversationId,
    staleTime: 5_000,
  });
}

export function useCreateMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.entities.Message.create(data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["Message", "filter", data.conversation_id] });
      qc.invalidateQueries({ queryKey: ["Conversation"] });
    },
  });
}

// ─── SignatureRequest ────────────────────────────────────────────────────────
export function useSignatureRequests(limit = 100) {
  return useQuery({
    queryKey: ["SignatureRequest", "list", limit],
    queryFn: () => base44.entities.SignatureRequest.list("-created_date", limit),
    staleTime: 15_000,
  });
}

// ─── ContractTemplate ────────────────────────────────────────────────────────
export function useContractTemplates() {
  return useQuery({
    queryKey: ["ContractTemplate", "list"],
    queryFn: () => base44.entities.ContractTemplate.list("-created_date", 200),
    staleTime: 60_000,
  });
}

// ─── MessageTemplate ─────────────────────────────────────────────────────────
export function useMessageTemplates() {
  return useQuery({
    queryKey: ["MessageTemplate", "list"],
    queryFn: () => base44.entities.MessageTemplate.list("name", 100),
    staleTime: 60_000,
  });
}

// ─── IntegrationConfig ───────────────────────────────────────────────────────
export function useIntegrationConfigs() {
  return useQuery({
    queryKey: ["IntegrationConfig", "list"],
    queryFn: () => base44.entities.IntegrationConfig.list(),
    staleTime: 30_000,
  });
}

// ─── Agreement ────────────────────────────────────────────────────────────────
export function useAgreements(limit = 100) {
  return useQuery({
    queryKey: ["Agreement", "list", limit],
    queryFn: () => base44.entities.Agreement.list("-created_date", limit),
    staleTime: 30_000,
  });
}

// ─── Generic ──────────────────────────────────────────────────────────────────
export function useEntityList(entityName, sort = "-created_date", limit = 100, options = {}) {
  return useQuery({
    queryKey: [entityName, "list", sort, limit],
    queryFn: () => base44.entities[entityName].list(sort, limit),
    staleTime: 15_000,
    ...options,
  });
}

export function useEntityFilter(entityName, filter, sort = "-created_date", limit = 100, options = {}) {
  return useQuery({
    queryKey: [entityName, "filter", filter, sort, limit],
    queryFn: () => base44.entities[entityName].filter(filter, sort, limit),
    staleTime: 15_000,
    ...options,
  });
}

export function useEntityCreate(entityName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.entities[entityName].create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [entityName] }),
  });
}

export function useEntityUpdate(entityName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => base44.entities[entityName].update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [entityName] }),
  });
}

export function useEntityDelete(entityName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => base44.entities[entityName].delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [entityName] }),
  });
}

export function useEntityBulkCreate(entityName) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.entities[entityName].bulkCreate(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [entityName] }),
  });
}