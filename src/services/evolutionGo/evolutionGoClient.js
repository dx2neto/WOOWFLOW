/**
 * evolutionGoClient.js
 * Cliente centralizado para todas as chamadas à Evolution GO via backend proxy.
 *
 * ✅ SEGURANÇA: Nenhum token é exposto no frontend.
 *    Todas as chamadas passam pelo backend (base44/functions/evolutionApi/entry.ts)
 *    que usa EVOLUTION_GO_ADMIN_TOKEN e EVOLUTION_GO_INSTANCE_TOKEN (env vars do servidor).
 *
 * USO:
 *   import { evo } from "@/services/evolutionGo/evolutionGoClient";
 *   await evo.sendText("5511999999999", "Olá!");
 *   await evo.listInstances();
 *
 * ROTAS COBERTAS (todas do Postman Collection "Evolution GO"):
 *   Instance: create, all, info, logs, delete, connect, status, qr, pair,
 *             disconnect, reconnect, logout, forcereconnect, advanced-settings
 *   Send:     text, link, media, poll, sticker, location, contact, button, list, carousel
 *   User:     info, check, avatar, contacts, privacy, block, unblock, blocklist,
 *             profilePicture, profileName, profileStatus
 *   Message:  react, presence, markread, downloadmedia, status, delete, edit
 *   Chat:     pin, unpin, archive, unarchive, mute, unmute, history-sync
 *   Group:    list, myall, info, invitelink, photo, name, description, create,
 *             participant, join, leave
 *   Call:     reject
 *   Label:    list, chat, unlabel/chat, message, unlabel/message, edit
 *   Community: create, add, remove
 *   Polls:    results
 *   Server:   health
 */

import { evolutionApi } from "@/functions/evolutionApi";

// ─── helper interno ──────────────────────────────────────────────────────────
async function call(payload) {
  const res = await evolutionApi(payload);
  return res?.data ?? res ?? {};
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /instance/all — lista todas as instâncias. Retorna { instances, defaultInstance } */
export async function listInstances() {
  return call({ action: "list_instances" });
}

/** POST /instance/create — cria nova instância. Retorna { success, instance, qrcode } */
export async function createInstance(instanceName, webhookUrl) {
  return call({ action: "create_instance", instanceName, webhookUrl });
}

/** POST /instance/connect — conecta instância e registra webhook. Retorna { success, qrcode, state } */
export async function connectInstance(instanceName, webhookUrl) {
  return call({ action: "connect_instance", instanceName, webhookUrl });
}

/** GET /instance/status — status da instância. Retorna { success, instance } */
export async function getInstanceInfo(instanceName) {
  return call({ action: "get_instance_info", instanceName });
}

/** GET /instance/status — status real da sessão. Retorna { success, state, instance } */
export async function getInstanceStatus(instanceName) {
  return call({ action: "get_status", instanceName });
}

/** GET /instance/qr — QR code para autenticação. Retorna { success, qrcode, state } */
export async function getQrCode(instanceName) {
  return call({ action: "get_qrcode", instanceName });
}

/** POST /instance/pair — código de pareamento alternativo ao QR. Retorna { success, result } */
export async function pairInstance(instanceName, phone) {
  return call({ action: "pair_instance", instanceName, phone });
}

/** POST /instance/reconnect — reconecta sem apagar sessão. Retorna { success, result } */
export async function reconnectInstance(instanceName) {
  return call({ action: "reconnect_instance", instanceName });
}

/** POST /instance/disconnect — desconecta mas mantém sessão/QR. Retorna { success, result } */
export async function disconnectInstance(instanceName) {
  return call({ action: "disconnect_instance", instanceName });
}

/** DELETE /instance/logout — logout completo (apaga sessão). Retorna { success } */
export async function logoutInstance(instanceName) {
  return call({ action: "logout_instance", instanceName });
}

/** DELETE /instance/delete/:id — remove instância permanentemente. Retorna { success } */
export async function deleteInstance(instanceName) {
  return call({ action: "delete_instance", instanceName });
}

/** POST /instance/forcereconnect/:id — força reconexão completa. Retorna { success } */
export async function forceReconnect(instanceName) {
  return call({ action: "force_reconnect", instanceName });
}

/** GET /instance/logs/:id — logs da instância. */
export async function getInstanceLogs(instanceName, { startDate, endDate, level, limit } = {}) {
  return call({ action: "get_instance_logs", instanceName, startDate, endDate, level, limit });
}

/** GET /instance/:id/advanced-settings */
export async function getAdvancedSettings(instanceName) {
  return call({ action: "get_advanced_settings", instanceName });
}

/**
 * PUT /instance/:id/advanced-settings
 * @param {object} settings - { rejectCalls, rejectCallMessage, readMessages, readStatus, alwaysOnline }
 */
export async function updateAdvancedSettings(instanceName, settings) {
  return call({ action: "update_advanced_settings", instanceName, ...settings });
}

/** GET /server/ok — health check do servidor Evolution GO */
export async function serverHealth() {
  return call({ action: "server_health" });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEND MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /send/text */
export async function sendText(phone, message, instance) {
  return call({ action: "send_text", phone, message, instance });
}

/** POST /send/link */
export async function sendLink(phone, text, instance) {
  return call({ action: "send_link", phone, text, instance });
}

/** POST /send/media — type: "image" | "video" | "audio" | "document" */
export async function sendMedia(phone, url, type = "image", opts = {}) {
  return call({ action: "send_media", phone, url, type, ...opts });
}

/** POST /send/poll */
export async function sendPoll(phone, question, options, maxAnswer = 1, instance) {
  return call({ action: "send_poll", phone, question, options, maxAnswer, instance });
}

/** POST /send/sticker */
export async function sendSticker(phone, sticker, instance) {
  return call({ action: "send_sticker", phone, sticker, instance });
}

/** POST /send/location */
export async function sendLocation(phone, latitude, longitude, opts = {}) {
  return call({ action: "send_location", phone, latitude, longitude, ...opts });
}

/** POST /send/contact — vcard: { fullName, organization?, phone } */
export async function sendContact(phone, vcard, instance) {
  return call({ action: "send_contact", phone, vcard, instance });
}

/** POST /send/button */
export async function sendButton(phone, title, description, buttons, opts = {}) {
  return call({ action: "send_button", phone, title, description, buttons, ...opts });
}

/** POST /send/list */
export async function sendList(phone, title, description, buttonText, sections, opts = {}) {
  return call({ action: "send_list", phone, title, description, buttonText, sections, ...opts });
}

/** POST /send/carousel */
export async function sendCarousel(phone, text, cards, instance) {
  return call({ action: "send_carousel", phone, text, cards, instance });
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER
// ═══════════════════════════════════════════════════════════════════════════════

export async function getUserInfo(phones, instance) {
  return call({ action: "get_user_info", phones: Array.isArray(phones) ? phones : [phones], instance });
}

export async function checkUser(phones, instance) {
  return call({ action: "check_user", phones: Array.isArray(phones) ? phones : [phones], instance });
}

export async function getAvatar(phone, preview = false, instance) {
  return call({ action: "get_avatar", phone, preview, instance });
}

export async function getContacts(instance) {
  return call({ action: "get_contacts", instance });
}

export async function getPrivacy(instance) {
  return call({ action: "get_privacy", instance });
}

export async function blockUser(phone, instance) {
  return call({ action: "block_user", phone, instance });
}

export async function unblockUser(phone, instance) {
  return call({ action: "unblock_user", phone, instance });
}

export async function getBlocklist(instance) {
  return call({ action: "get_blocklist", instance });
}

export async function setProfilePicture(image, instance) {
  return call({ action: "set_profile_picture", image, instance });
}

export async function setProfileName(name, instance) {
  return call({ action: "set_profile_name", name, instance });
}

export async function setProfileStatus(status, instance) {
  return call({ action: "set_profile_status", status, instance });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════

export async function markRead(phone, ids = [], conversationId, instance) {
  return call({ action: "mark_read", phone, ids, conversation_id: conversationId, instance });
}

export async function reactMessage(phone, messageId, reaction, instance) {
  return call({ action: "react_message", phone, messageId, reaction, instance });
}

export async function sendPresence(phone, state = "composing", isAudio = false, instance) {
  return call({ action: "presence", phone, state, isAudio, instance });
}

export async function downloadMedia(phone, messageId, instance) {
  return call({ action: "download_media", phone, messageId, instance });
}

export async function getMessageStatus(phone, messageId, instance) {
  return call({ action: "get_message_status", phone, messageId, instance });
}

export async function deleteMessage(chat, messageId, instance) {
  return call({ action: "delete_message", chat, messageId, instance });
}

export async function editMessage(chat, messageId, message, instance) {
  return call({ action: "edit_message", chat, messageId, message, instance });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════════════════════════════════════════

export async function pinChat(phone, instance) { return call({ action: "pin_chat", phone, instance }); }
export async function unpinChat(phone, instance) { return call({ action: "unpin_chat", phone, instance }); }
export async function archiveChat(phone, instance) { return call({ action: "archive_chat", phone, instance }); }
export async function unarchiveChat(phone, instance) { return call({ action: "unarchive_chat", phone, instance }); }
export async function muteChat(phone, instance) { return call({ action: "mute_chat", phone, instance }); }
export async function unmuteChat(phone, instance) { return call({ action: "unmute_chat", phone, instance }); }

export async function syncHistory(phone, conversationId, limit = 50, instance) {
  return call({ action: "sync_history", phone, conversation_id: conversationId, limit, instance });
}

export async function getChats(instance) {
  return call({ action: "get_chats", instance });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP
// ═══════════════════════════════════════════════════════════════════════════════

export async function groupList(instance) { return call({ action: "group_list", instance }); }
export async function groupMyAll(instance) { return call({ action: "group_myall", instance }); }
export async function groupInfo(groupJid, instance) { return call({ action: "group_info", groupJid, instance }); }
export async function groupInviteLink(groupJid, instance) { return call({ action: "group_invite_link", groupJid, instance }); }

export async function groupCreate(groupName, participants, instance) {
  return call({ action: "group_create", groupName, participants, instance });
}

/** participantAction: "add" | "remove" | "promote" | "demote" */
export async function groupParticipant(groupJid, participants, participantAction, instance) {
  return call({ action: "group_participant", groupJid, participants, action: participantAction, instance });
}

export async function groupJoin(code, instance) { return call({ action: "group_join", code, instance }); }
export async function groupLeave(groupJid, instance) { return call({ action: "group_leave", groupJid, instance }); }
export async function groupUpdateName(groupJid, name, instance) { return call({ action: "group_update_name", groupJid, name, instance }); }
export async function groupUpdateDescription(groupJid, description, instance) { return call({ action: "group_update_description", groupJid, description, instance }); }
export async function groupUpdatePhoto(groupJid, image, instance) { return call({ action: "group_update_photo", groupJid, image, instance }); }

// ═══════════════════════════════════════════════════════════════════════════════
// CALL
// ═══════════════════════════════════════════════════════════════════════════════

export async function rejectCall(callCreator, callId, instance) {
  return call({ action: "reject_call", callCreator, callId, instance });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LABEL
// ═══════════════════════════════════════════════════════════════════════════════

export async function labelList(instance) { return call({ action: "label_list", instance }); }
export async function labelChat(jid, labelId, instance) { return call({ action: "label_chat", jid, labelId, instance }); }
export async function unlabelChat(jid, labelId, instance) { return call({ action: "unlabel_chat", jid, labelId, instance }); }
export async function labelMessage(jid, messageId, labelId, instance) { return call({ action: "label_message", jid, messageId, labelId, instance }); }
export async function unlabelMessage(jid, messageId, labelId, instance) { return call({ action: "unlabel_message", jid, messageId, labelId, instance }); }
export async function labelEdit(labelId, name, color, deleted = false, instance) {
  return call({ action: "label_edit", labelId, name, color, deleted, instance });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNITY
// ═══════════════════════════════════════════════════════════════════════════════

export async function communityCreate(communityName, instance) { return call({ action: "community_create", communityName, instance }); }
export async function communityAdd(communityJid, groupJid, instance) { return call({ action: "community_add", communityJid, groupJid, instance }); }
export async function communityRemove(communityJid, groupJid, instance) { return call({ action: "community_remove", communityJid, groupJid, instance }); }

// ═══════════════════════════════════════════════════════════════════════════════
// POLLS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getPollResults(pollMessageId, instance) {
  return call({ action: "get_poll_results", pollMessageId, instance });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Namespace export
// ═══════════════════════════════════════════════════════════════════════════════

export const evo = {
  // Instance
  listInstances, createInstance, connectInstance, getInstanceInfo, getQrCode,
  pairInstance, reconnectInstance, disconnectInstance, logoutInstance, deleteInstance,
  forceReconnect, getInstanceLogs, getAdvancedSettings, updateAdvancedSettings, serverHealth,
  // Send
  sendText, sendLink, sendMedia, sendPoll, sendSticker, sendLocation,
  sendContact, sendButton, sendList, sendCarousel,
  // User
  getUserInfo, checkUser, getAvatar, getContacts, getPrivacy,
  blockUser, unblockUser, getBlocklist,
  setProfilePicture, setProfileName, setProfileStatus,
  // Message
  markRead, reactMessage, sendPresence, downloadMedia, getMessageStatus, deleteMessage, editMessage,
  // Chat
  pinChat, unpinChat, archiveChat, unarchiveChat, muteChat, unmuteChat, syncHistory, getChats,
  // Group
  groupList, groupMyAll, groupInfo, groupInviteLink, groupCreate, groupParticipant,
  groupJoin, groupLeave, groupUpdateName, groupUpdateDescription, groupUpdatePhoto,
  // Call
  rejectCall,
  // Label
  labelList, labelChat, unlabelChat, labelMessage, unlabelMessage, labelEdit,
  // Community
  communityCreate, communityAdd, communityRemove,
  // Polls
  getPollResults,
};

export default evo;
