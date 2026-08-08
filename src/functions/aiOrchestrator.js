import { base44 } from "@/api/base44Client";

export const aiOrchestrator = (data) => base44.functions.invoke("aiOrchestrator", data);