import { base44 } from "@/api/base44Client";

// Wrapper para a função de backend "ixcApi" (base44/functions/ixcApi).
// Retorna a resposta do axios, mantendo o formato { data } usado nas páginas.
export const ixcApi = (data) => base44.functions.invoke("ixcApi", data);
