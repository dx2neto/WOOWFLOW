import { base44 } from "@/api/base44Client";

// Wrapper para a função de backend "sendBillingRuleReminders" (base44/functions/sendBillingRuleReminders).
export const sendBillingRuleReminders = async (data) => {
  try {
    return await base44.functions.invoke("sendBillingRuleReminders", data);
  } catch (error) {
    if (error?.response) return error.response;
    if (error?.name === "Base44Error") {
      return {
        status: error.status,
        data: error.data || {
          success: false,
          error: error.message || "Falha ao executar régua de cobrança",
        },
      };
    }
    throw error;
  }
};