import { base44 } from "@/api/base44Client";

export const salesPipelineApi = async (data) => {
  try {
    const result = await base44.functions.invoke("salesPipelineApi", data);
    if (result && typeof result === "object" && "data" in result) return result;
    return { data: result };
  } catch (error) {
    if (error?.response) return error.response;
    if (error?.name === "Base44Error") {
      return {
        status: error.status,
        data: error.data || {
          success: false,
          error: error.message || "Falha ao chamar esteira de vendas",
        },
      };
    }
    throw error;
  }
};