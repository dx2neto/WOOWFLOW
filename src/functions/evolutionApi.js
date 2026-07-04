import { base44 } from "@/api/base44Client";

// Wrapper para a função de backend "evolutionApi" (base44/functions/evolutionApi).
export const evolutionApi = (data) => base44.functions.invoke("evolutionApi", data);
