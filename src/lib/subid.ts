/**
 * Módulo de Criptografia Stateless de Sub-IDs para Arbitragem de Mídia
 * Utiliza exclusivamente a Web Crypto API (padrão Web Standard do Cloudflare Edge).
 * Custo de Banco de Dados: ZERO.
 */

export interface ClickPayload {
  clickId: string;    // fbclid ou gclid
  source: 'meta' | 'google' | 'unknown';
  timestamp: number;  // Date.now()
}

/**
 * Deriva uma CryptoKey a partir de uma secret string usando SHA-256
 */
async function getCryptoKey(secretKey: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  
  // Gera um digest SHA-256 da secret para garantir exatos 256 bits (32 bytes)
  const hash = await crypto.subtle.digest('SHA-256', keyData);

  return crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Converte ArrayBuffer para string Base64URL (segura para usar em URLs e cookies)
 */
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Converte string Base64URL de volta para Uint8Array
 */
function base64UrlToBuffer(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Criptografa o Click ID do anúncio e gera um Sub-ID Stateless em Base64URL
 */
export async function generateStatelessSubId(
  clickId: string,
  source: 'meta' | 'google' | 'unknown',
  secretKey: string
): Promise<string> {
  const key = await getCryptoKey(secretKey);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // IV recomendado de 12 bytes para AES-GCM

  const payload: ClickPayload = {
    clickId,
    source,
    timestamp: Date.now()
  };

  const encoder = new TextEncoder();
  const encodedPayload = encoder.encode(JSON.stringify(payload));

  const encryptedContent = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedPayload
  );

  // Concatena IV (12 bytes) + Ciphertext para ser totalmente autocontido
  const combined = new Uint8Array(iv.length + encryptedContent.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedContent), iv.length);

  return bufferToBase64Url(combined.buffer);
}

/**
 * Descriptografa um Sub-ID Stateless para recuperar o Click ID e a fonte original
 */
export async function decryptStatelessSubId(
  subId: string,
  secretKey: string
): Promise<ClickPayload | null> {
  try {
    const key = await getCryptoKey(secretKey);
    const combined = base64UrlToBuffer(subId);

    if (combined.length < 13) {
      return null; // Tamanho inválido (mínimo: 12 bytes IV + pelo menos 1 byte ciphertext)
    }

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decryptedContent = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedContent);
    
    return JSON.parse(jsonString) as ClickPayload;
  } catch (err) {
    console.error('Falha ao descriptografar Sub-ID:', err);
    return null;
  }
}