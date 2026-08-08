import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Hooks reutilizáveis de React Query para entidades do Base44.
 * Substituem chamadas diretas (base44.entities.X.list()) por versões
 * cacheadas, com refetch automático e invalidação cruzada.
 *
 * Uso:
 *   const { data, isLoading } = useConversations();
 *   const { mutateAsync } = useUpdateConversation();
 */

// ─── Conversation ────────────────────────────────────────────────────────────
export function useConversations(limit = 100) {
  return useQuery({
    queryKey: ["conversations", limit],
    queryFn: () => base44.entities.Conversation.list("-last_message_time", limit),
    staleTime: 10_000,
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => base44.entities.Conversation.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

// ─── Lead ─────────────────────────────────────────────────────────────────────
export function useLeads(limit = 200) {
  return useQuery({
    queryKey: ["leads", limit],
    queryFn: () => base44.entities.Lead.list("-created_date", limit),
    staleTime: 15_000,
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

// ─── Customer ────────────────────────────────────────────────────────────────
export function useCustomers(limit = 100) {
  return useQuery({
    queryKey: ["customers", limit],
    queryFn: () => base44.entities.Customer.list("-created_date", limit),
    staleTime: 30_000,
  });
}

// ─── Charge ──────────────────────────────────────────────────────────────────
export function useCharges(limit = 100) {
  return useQuery({
    queryKey: ["charges", limit],
    queryFn: () => base44.entities.Charge.list("-created_date", limit),
    staleTime: 30_000,
  });
}

// ─── Message ──────────────────────────────────────────────────────────────────
export function useMessages(conversationId) {
  return useQuery({
    queryKey: ["messages", conversationId],
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
      qc.invalidateQueries({ queryKey: ["messages", data.conversation_id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// ─── SignatureRequest ────────────────────────────────────────────────────────
export function useSignatureRequests(limit = 100) {
  return useQuery({
    queryKey: ["signatureRequests", limit],
    queryFn: () => base44.entities.SignatureRequest.list("-created_date", limit),
    staleTime: 15_000,
  });
}

// ─── ContractTemplate ────────────────────────────────────────────────────────
export function useContractTemplates() {
  return useQuery({
    queryKey: ["contractTemplates"],
    queryFn: () => base44.entities.ContractTemplate.list("-created_date", 200),
    staleTime: 60_000,
  });
}

// ─── MessageTemplate ─────────────────────────────────────────────────────────
export function useMessageTemplates() {
  return useQuery({
    queryKey: ["messageTemplates"],
    queryFn: () => base44.entities.MessageTemplate.list("name", 100),
    staleTime: 60_000,
  });
}

// ─── IntegrationConfig ───────────────────────────────────────────────────────
export function useIntegrationConfigs() {
  return useQuery({
    queryKey: ["integrationConfigs"],
    queryFn: () => base44.entities.IntegrationConfig.list(),
    staleTime: 30_000,
  });
}

// ─── Agreement ────────────────────────────────────────────────────────────────
export function useAgreements(limit = 100) {
  return useQuery({
    queryKey: ["agreements", limit],
    queryFn: () => base44.entities.Agreement.list("-created_date", limit),
    staleTime: 30_000,
  });
}

// ─── Generic ──────────────────────────────────────────────────────────────────
export function useEntityList(entityName, sort = "-created_date", limit = 100, options = {}) {
  return useQuery({
    queryKey: [entityName, sort, limit],
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