import { base44 } from "@/api/base44Client";

export async function notifyContractSigned(payload) {
  try {
    const response = await base44.functions.invoke("notifyContractSigned", payload);
    return response;
  } catch (error) {
    return {
      data: {
        success: false,
        error: { message: error?.message || "Erro ao enviar aviso de contrato assinado" },
      },
    };
  }
}