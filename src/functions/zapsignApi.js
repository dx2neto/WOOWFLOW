import { base44 } from "@/api/base44Client";

// Wrapper para a função de backend "zapsignApi" (base44/functions/zapsignApi).
export const zapsignApi = (data) => base44.functions.invoke("zapsignApi", data);
