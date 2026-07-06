import { base44 } from "@/api/base44Client";

// Wrapper para a função de backend "syncGoogleSheets" (base44/functions/syncGoogleSheets).
export const syncGoogleSheets = (data) => base44.functions.invoke("syncGoogleSheets", data);