import { base44 } from "@/api/base44Client";

// Wrapper para a função de backend "evolutionApi" (base44/functions/evolutionApi).
export const evolutionApi = async (data) => {
  try {
    const result = await base44.functions.invoke("evolutionApi", data);
    // Wrapper normaliza para { data: ... } — todos os callers usam resp.data
    if (result && typeof result === "object" && "data" in result) return result;
    return { data: result };
  } catch (error) {
    if (error?.response) return error.response;
    if (error?.name === "Base44Error") {
      return {
        status: error.status,
        data: error.data || {
          success: false,
          error: error.message || "Falha ao chamar Evolution Go",
        },
      };
    }
    throw error;
  }
};