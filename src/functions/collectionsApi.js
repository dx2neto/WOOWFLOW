import { base44 } from "@/api/base44Client";

// Wrapper para a função de backend "collectionsApi" (base44/functions/collectionsApi).
export const collectionsApi = (data) => base44.functions.invoke("collectionsApi", data);
