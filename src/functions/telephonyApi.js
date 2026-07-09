import { base44 } from "@/api/base44Client";

export const telephonyApi = async (data) => {
  try {
    return await base44.functions.invoke("telephonyApi", data);
  } catch (error) {
    if (error?.response) return error.response;
    return {
      status: error.status || 500,
      data: {
        success: false,
        error: error.message || "Falha ao chamar integração de telefonia",
      },
    };
  }
};
