import { base44 } from "@/api/base44Client";

// Wrapper para a função de backend "agreementApi" (base44/functions/agreementApi).
export const agreementApi = (data) => base44.functions.invoke("agreementApi", data);
