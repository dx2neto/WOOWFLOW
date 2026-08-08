import { base44Client } from "@/api/base44Client";

export async function sendDailySalesSummary(payload = {}) {
  return base44Client.functions.invoke("sendDailySalesSummary", payload);
}