// ═══════════════════════════════════════════════════════════════════════════
// Shared Evolution API (Baileys) WhatsApp message sender.
// Used by zapsignApi and other backend functions that need to send WhatsApp
// messages via the Evolution API v2 endpoint structure.
//
// Correct endpoint: POST /message/sendText/{instanceName}
// Auth: global apikey header (NOT per-instance token)
// Body: { number, text, textMessage: { text }, delay }
// ═══════════════════════════════════════════════════════════════════════════

interface SendWhatsAppParams {
  base: string;           // EVOLUTION_API_URL (without trailing slash)
  apiKey: string;         // EVOLUTION_API_KEY (global)
  instanceName: string;   // Instance name (e.g. "CONNECT")
  number: string;         // Phone number, digits only (e.g. "5511999999999")
  text: string;           // Message text
  delay?: number;         // Delay in ms (default 500)
}

interface SendWhatsAppResult {
  success: boolean;
  wa_message_id?: string;
  error?: string;
}

export async function sendWhatsAppMessage(params: SendWhatsAppParams): Promise<SendWhatsAppResult> {
  const { base, apiKey, instanceName, number, text, delay = 500 } = params;

  if (!base) return { success: false, error: 'EVOLUTION_API_URL não configurada.' };
  if (!apiKey) return { success: false, error: 'EVOLUTION_API_KEY não configurada.' };
  if (!instanceName) return { success: false, error: 'Nome da instância não informado.' };
  if (!number) return { success: false, error: 'Número de telefone não informado.' };
  if (!text) return { success: false, error: 'Texto da mensagem não informado.' };

  const url = `${base.replace(/\/+$/, '')}/message/sendText/${encodeURIComponent(instanceName)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { apikey: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number, text, textMessage: { text }, delay }),
    });

    const responseText = await res.text();
    let data: unknown;
    try { data = JSON.parse(responseText); } catch { data = { raw: responseText }; }

    if (!res.ok) {
      return { success: false, error: `Evolution API retornou ${res.status}` };
    }

    // Extract WhatsApp message ID from response
    const root = (data && typeof data === 'object' && !Array.isArray(data)) ? data as Record<string, unknown> : {};
    const key = (root.key && typeof root.key === 'object') ? root.key as Record<string, unknown> : {};
    const waId = String(key.id || key.ID || root.id || root.messageId || '');

    return {
      success: true,
      wa_message_id: waId && waId !== 'null' ? waId : undefined,
    };
  } catch (error) {
    return { success: false, error: `Erro ao enviar mensagem: ${(error as Error).message}` };
  }
}