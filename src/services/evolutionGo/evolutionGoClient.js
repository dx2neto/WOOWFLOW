/**
 * evolutionGoClient.js
 * Serviço centralizado para todas as chamadas à Evolution GO via backend proxy.
 *
 * ✅ SEGURANÇA: Nenhum token é exposto no frontend.
 *    Todas as chamadas passam pelo backend (base44/functions/evolutionApi/entry.ts)
 *    que autentica com EVOLUTION_API_KEY (env var do servidor).
 *
 * USO:
 *   import { evo } from "@/services/evolutionGo/evolutionGoClient";
 *   const { instances } = await evo.listInstances();
 *   await evo.sendMessage({ phone: "5511999999999", message: "Olá!" });
 */

import { evolutionApi } from "@/functions/evolutionApi";

// ─── helper interno ──────────────────────────────────────────────────────────
async function call(payload) {
  const res = await evolutionApi(payload);
  return res?.data ?? res ?? {};
}

// ─── Instance ────────────────────────────────────────────────────────────────

/** Lista todas as instâncias. Retorna { instances, defaultInstance } */
export async function listInstances() {
  return call({ action: "list_instances" });
}

/** Cria uma nova instância. Retorna { success, instance, qrcode, qrCode } */
export async function createInstance(instanceName, webhookUrl) {
  return call({ action: "create_instance", instanceName, webhookUrl });
}

/** Conecta instância e registra webhook. Retorna { success, qrcode, qrCode, state } */
export async function connectInstance(instanceName, webhookUrl) {
  return call({ action: "connect_instance", instanceName, webhookUrl });
}

/** Reconecta instância sem apagar sessão. Retorna { success, result } */
export async function reconnectInstance(instanceName) {
  return call({ action: "reconnect_instance", instanceName });
}

/** Gera QR code para autenticação. Retorna { success, qrcode, state } */
export async function getQrCode(instanceName) {
  return call({ action: "get_qrcode", instanceName });
}

/** Gera código de pareamento (alternativa ao QR). Retorna { success, result } */
export async function pairInstance(instanceName, phone) {
  return call({ action: "pair_instance", instanceName, phone });
}

/** Retorna detalhes de uma instância. Retorna { success, instance } */
export async function getInstanceInfo(instanceName) {
  return call({ action: "get_instance_info", instanceName });
}

/** Desconecta o WhatsApp (mantém instância). Retorna { success } */
export async function logoutInstance(instanceName) {
  return call({ action: "logout_instance", instanceName });
}

/** Remove instância permanentemente. Retorna { success } */
export async function deleteInstance(instanceName) {
  return call({ action: "delete_instance", instanceName });
}

/** Busca logs da instância. Retorna { success, logs } */
export async function getInstanceLogs(instanceName, { startDate, endDate, level, limit } = {}) {
  return call({ action: "get_instance_logs", instanceName, startDate, endDate, level, limit });
}

// ─── Send ────────────────────────────────────────────────────────────────────

/**
 * Envia mensagem de texto.
 * @param {string} phone - Número sem formatação (apenas dígitos)
 * @param {string} message - Texto a enviar
 * @param {string} [instance] - Nome da instância (usa padrão se omitido)
 */
export async function sendMessage(phone, message, instance) {
  return call({ action: "send_message", phone, message, instance });
}

/**
 * Envia mídia (imagem, vídeo, áudio, documento).
 * @param {string} phone
 * @param {string} url - URL HTTP(S) ou base64 sem prefixo "data:"
 * @param {"image"|"video"|"audio"|"document"} type
 * @param {object} [opts] - { caption, filename, instance, delay }
 */
export async function sendMedia(phone, url, type = "image", opts = {}) {
  return call({ action: "send_media", phone, url, type, ...opts });
}

/**
 * Envia link com preview.
 * @param {string} phone
 * @param {string} text - Texto incluindo o link
 * @param {string} [instance]
 */
export async function sendLink(phone, text, instance) {
  return call({ action: "send_link", phone, text, instance });
}

/**
 * Envia localização.
 * @param {string} phone
 * @param {number} latitude
 * @param {number} longitude
 * @param {object} [opts] - { name, address, instance, delay }
 */
export async function sendLocation(phone, latitude, longitude, opts = {}) {
  return call({ action: "send_location", phone, latitude, longitude, ...opts });
}

// ─── User ────────────────────────────────────────────────────────────────────

/**
 * Verifica se número(s) estão registrados no WhatsApp.
 * @param {string|string[]} phones
 * @returns {{ success, result }} result é array com { number, exists }
 */
export async function checkUser(phones, instance) {
  const arr = Array.isArray(phones) ? phones : [phones];
  return call({ action: "check_user", phones: arr, instance });
}

/**
 * Retorna informações de perfil de um ou mais números.
 * @param {string|string[]} phones
 */
export async function getUserInfo(phones, instance) {
  const arr = Array.isArray(phones) ? phones : [phones];
  return call({ action: "get_user_info", phones: arr, instance });
}

/**
 * Retorna URL do avatar do contato.
 * @param {string} phone
 * @param {boolean} [preview] - true = foto baixa resolução
 */
export async function getAvatar(phone, preview = false, instance) {
  return call({ action: "get_avatar", phone, preview, instance });
}

/** Lista todos os contatos da instância. */
export async function getContacts(instance) {
  return call({ action: "get_contacts", instance });
}

// ─── Message ─────────────────────────────────────────────────────────────────

/**
 * Marca mensagens como lidas no WhatsApp.
 * @param {string} phone
 * @param {string[]} ids - IDs das mensagens
 * @param {string} [conversationId] - ID local Base44 (para atualizar flag unread)
 */
export async function markRead(phone, ids = [], conversationId, instance) {
  return call({ action: "mark_read", phone, ids, conversation_id: conversationId, instance });
}

/**
 * Envia reação (emoji) a uma mensagem.
 * @param {string} phone
 * @param {string} messageId
 * @param {string} reaction - Emoji, ex: "🔥"
 */
export async function reactMessage(phone, messageId, reaction, instance) {
  return call({ action: "react_message", phone, messageId, reaction, instance });
}

/**
 * Apaga uma mensagem.
 * @param {string} chat - Número ou JID completo
 * @param {string} messageId
 */
export async function deleteMessage(chat, messageId, instance) {
  return call({ action: "delete_message", chat, messageId, instance });
}

/**
 * Edita uma mensagem de texto.
 * @param {string} chat - Número ou JID completo
 * @param {string} messageId
 * @param {string} message - Novo texto
 */
export async function editMessage(chat, messageId, message, instance) {
  return call({ action: "edit_message", chat, messageId, message, instance });
}

/**
 * Envia estado de digitação/gravação.
 * @param {string} phone
 * @param {"composing"|"paused"} state
 * @param {boolean} [isAudio]
 */
export async function sendPresence(phone, state = "composing", isAudio = false, instance) {
  return call({ action: "presence", phone, state, isAudio, instance });
}

// ─── Chat ────────────────────────────────────────────────────────────────────

/** Fixa chat. */
export async function pinChat(phone, instance) {
  return call({ action: "pin_chat", phone, instance });
}

/** Desfixa chat. */
export async function unpinChat(phone, instance) {
  return call({ action: "unpin_chat", phone, instance });
}

/** Arquiva conversa. */
export async function archiveChat(phone, instance) {
  return call({ action: "archive_chat", phone, instance });
}

/** Desarquiva conversa. */
export async function unarchiveChat(phone, instance) {
  return call({ action: "unarchive_chat", phone, instance });
}

/** Silencia conversa. */
export async function muteChat(phone, instance) {
  return call({ action: "mute_chat", phone, instance });
}

/** Remove silêncio da conversa. */
export async function unmuteChat(phone, instance) {
  return call({ action: "unmute_chat", phone, instance });
}

/**
 * Solicita sincronização do histórico de mensagens.
 * As mensagens chegam assincronamente via webhook evento HistorySync.
 * @param {string} phone
 * @param {string} [conversationId] - ID local Base44
 * @param {number} [limit] - Quantidade de mensagens a solicitar (padrão 50)
 */
export async function syncHistory(phone, conversationId, limit = 50, instance) {
  return call({ action: "sync_history", phone, conversation_id: conversationId, limit, instance });
}

// ─── Chats / Contatos ─────────────────────────────────────────────────────────

/** Lista contatos como "chats" (retorna { success, chats }). */
export async function getChats(instance) {
  return call({ action: "get_chats", instance });
}

// ─── Namespace export (uso: evo.sendMessage / evo.listInstances etc.) ─────────

export const evo = {
  // Instance
  listInstances,
  createInstance,
  connectInstance,
  reconnectInstance,
  getQrCode,
  pairInstance,
  getInstanceInfo,
  logoutInstance,
  deleteInstance,
  getInstanceLogs,
  // Send
  sendMessage,
  sendMedia,
  sendLink,
  sendLocation,
  // User
  checkUser,
  getUserInfo,
  getAvatar,
  getContacts,
  // Message
  markRead,
  reactMessage,
  deleteMessage,
  editMessage,
  sendPresence,
  // Chat
  pinChat,
  unpinChat,
  archiveChat,
  unarchiveChat,
  muteChat,
  unmuteChat,
  syncHistory,
  getChats,
};

export default evo;
