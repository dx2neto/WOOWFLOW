import { base44 } from "@/api/base44Client";

// Wrapper para a função de backend "serasaApi" (base44/functions/serasaApi).
export const serasaApi = (data) => base44.functions.invoke("serasaApi", data);
