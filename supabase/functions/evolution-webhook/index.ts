// ==========================================================================
// WOOWFLOW • Webhook da Evolution Go
// Recebe eventos (messages.upsert, connection.update) e grava no Supabase.
// URL: {SUPABASE_URL}/functions/v1/evolution-webhook?token=...&org=...
// ==========================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function onlyDigits(s: string) {
  return String(s || "").replace(/\D/g, "");
}

// Extrai o numero de telefone do remoteJid ("5511999999999@s.whatsapp.net")
function phoneFromJid(jid: string) {
  return onlyDigits(String(jid || "").split("@")[0]);
}

function extractText(msg: Record<string, unknown>): string {
  const m = (msg?.message ?? {}) as Record<string, unknown>;
  return String(
    m?.conversation ??
      (m?.extendedTextMessage as Record<string, unknown>)?.text ??
      (m?.imageMessage as Record<string, unknown>)?.caption ??
      (m?.videoMessage as Record<string, unknown>)?.caption ??
      "",
  );
}

function messageType(msg: Record<string, unknown>): string {
  const m = (msg?.message ?? {}) as Record<string, unknown>;
  if (m?.imageMessage) return "image";
  if (m?.audioMessage) return "audio";
  if (m?.videoMessage) return "video";
  if (m?.documentMessage) return "document";
  if (m?.stickerMessage) return "sticker";
  return "text";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Valida token do webhook
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const orgId = url.searchParams.get("org");

  const { data: secret } = await supabase
    .from("app_secrets")
    .select("value")
    .eq("key", "WEBHOOK_TOKEN")
    .single();

  if (!token || !secret || token !== secret.value) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!orgId) return json({ error: "missing org" }, 400);

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const event = String(payload?.event ?? payload?.type ?? "");
  const data = (payload?.data ?? payload) as Record<string, unknown>;

  try {
    // -------- Atualizacao de conexao da instancia --------
    if (event.includes("connection") || payload?.state || data?.state) {
      const state = String(data?.state ?? payload?.state ?? "");
      const connected = state === "open" || state === "connected";
      const instanceName = String(payload?.instance ?? data?.instance ?? "");
      if (instanceName) {
        await supabase
          .from("evolution_instances")
          .update({ connected, status: state, last_sync_at: new Date().toISOString() })
          .eq("organization_id", orgId)
          .eq("name", instanceName);
      }
      return json({ ok: true, handled: "connection" });
    }

    // -------- Mensagens recebidas/enviadas --------
    const messages = Array.isArray(data?.messages)
      ? (data.messages as Record<string, unknown>[])
      : [data];

    for (const msg of messages) {
      const key = (msg?.key ?? {}) as Record<string, unknown>;
      const remoteJid = String(key?.remoteJid ?? "");
      // Ignora grupos e status
      if (remoteJid.includes("@g.us") || remoteJid.includes("status@")) continue;

      const phone = phoneFromJid(remoteJid);
      if (!phone) continue;

      const fromMe = Boolean(key?.fromMe);
      const direction = fromMe ? "out" : "in";
      const content = extractText(msg);
      const type = messageType(msg);
      const pushName = String(msg?.pushName ?? "");
      const externalId = String(key?.id ?? "");
      const instanceName = String(payload?.instance ?? data?.instance ?? "");
      const ts = msg?.messageTimestamp
        ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString();

      // Busca ou cria a conversa (por org + telefone)
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("organization_id", orgId)
        .eq("phone", phone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let conversationId = existing?.id as string | undefined;

      if (!conversationId) {
        const { data: created, error: convErr } = await supabase
          .from("conversations")
          .insert({
            organization_id: orgId,
            customer_name: pushName || phone,
            phone,
            channel: "whatsapp",
            instance: instanceName,
            status: fromMe ? "em_atendimento" : "aguardando_atendimento",
            last_message: content,
            last_message_time: ts,
            unread: !fromMe,
          })
          .select("id")
          .single();
        if (convErr) throw convErr;
        conversationId = created.id;
      } else {
        await supabase
          .from("conversations")
          .update({
            last_message: content,
            last_message_time: ts,
            unread: !fromMe,
            updated_at: new Date().toISOString(),
            ...(fromMe ? {} : { status: "aguardando_atendimento" }),
          })
          .eq("id", conversationId);
      }

      // Evita duplicar mensagem (idempotencia pelo external_id)
      if (externalId) {
        const { data: dup } = await supabase
          .from("messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("external_id", externalId)
          .maybeSingle();
        if (dup) continue;
      }

      await supabase.from("messages").insert({
        organization_id: orgId,
        conversation_id: conversationId,
        content,
        direction,
        type,
        sender_name: pushName || (fromMe ? "Você" : phone),
        external_id: externalId,
        status: "delivered",
        timestamp: ts,
      });
    }

    return json({ ok: true, handled: "messages" });
  } catch (err) {
    console.log("[v0] webhook error:", (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
