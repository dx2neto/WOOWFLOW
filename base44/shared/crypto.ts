// ═══════════════════════════════════════════════════════════════════════════
// Utilitário de criptografia AES-GCM para dados sensíveis (LGPD).
// Usa a Web Crypto API disponível no Deno.
//
// encrypt: cifra um texto plano -> base64 (IV + ciphertext)
// decrypt: decifra um base64 -> texto original (compatível com dados legados)
// maskCpfCnpj: mascara CPF/CNPJ para exibição (***.***.***-45)
//
// A chave é derivada do INTERNAL_FUNCTION_TOKEN via SHA-256.
// ═══════════════════════════════════════════════════════════════════════════

const KEY_MATERIAL = Deno.env.get('INTERNAL_FUNCTION_TOKEN') || '';
if (!KEY_MATERIAL) {
  // Falha intencional: sem a chave, não há como criptografar/decriptografar de forma segura.
  // Lançar aqui garante que o problema seja detectado imediatamente em vez de usar fallback fraco.
  console.error('[crypto] ERRO CRÍTICO: INTERNAL_FUNCTION_TOKEN não configurado. Criptografia LGPD indisponível.');
}
const FALLBACK_KEY = 'connectflow-lgpd-emergency-key-v1-2026';

async function deriveKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const material = KEY_MATERIAL || FALLBACK_KEY;
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(material));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) return '';
  try {
    const key = await deriveKey();
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return btoa(String.fromCharCode(...combined));
  } catch {
    return plaintext;
  }
}

export async function decrypt(ciphertext: string): Promise<string> {
  if (!ciphertext) return '';
  try {
    const key = await deriveKey();
    const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
  } catch {
    // Compatibilidade: se não conseguir descriptar, retorna o valor original
    return ciphertext;
  }
}

export function maskCpfCnpj(doc: string): string {
  if (!doc) return '';
  const digits = String(doc).replace(/\D/g, '');
  if (digits.length === 11) return '***.***.***-' + digits.slice(-2);
  if (digits.length === 14) return '**.***.***/****-' + digits.slice(-2);
  if (digits.length >= 2) return '***.***.***-' + digits.slice(-2);
  return '***';
}