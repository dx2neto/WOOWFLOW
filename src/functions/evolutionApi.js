import { base44 } from "@/api/base44Client";

// Wrapper para a função de backend "evolutionApi" (base44/functions/evolutionApi).
export const evolutionApi = async (data) => {
  try {
    return await base44.functions.invoke("evolutionApi", data);
  } catch (error) {
    if (error?.response) return error.response;
    throw error;
  }
};
