import { base44 } from "@/api/base44Client";

export const omnichannelApi = async (data) => {
  try {
    return await base44.functions.invoke("omnichannelApi", data);
  } catch (error) {
    if (error?.response) return error.response;
    if (error?.name === "Base44Error") {
      return {
        status: error.status,
        data: error.data || {
          success: false,
          error: error.message || "Falha ao chamar Omnichannel",
        },
      };
    }
    throw error;
  }
};
