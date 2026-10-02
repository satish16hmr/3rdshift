/**
 * AES-GCM encryption for sensitive data at rest (OAuth tokens, API keys, etc.)
 *
 * Key resolution order:
 *   1. TOKEN_ENCRYPTION_KEY  (canonical name going forward)
 *   2. GOOGLE_TOKEN_ENCRYPTION_KEY  (legacy fallback — remove after cutover)
 *
 * Fail-closed: if neither key is set, encryptToken() and decryptToken() throw.
 * There is no silent plaintext fallback.
 *
 * Lazy migration: decryptToken() passes through values that don't start with
 * 'enc:' so existing plaintext rows continue to work until they are re-written.
 */

import { createHash } from 'crypto';

const ALGO = 'AES-GCM';
const IV_LENGTH = 12; // bytes

function getKey(): string {
  const key =
    process.env.TOKEN_ENCRYPTION_KEY ??
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ??  // legacy fallback — remove after cutover
    null;
  if (!key) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY is required but not set. ' +
      'Set this environment variable to enable token encryption at rest.'
    );
  }
  return key;
}

async function importKey(hex: string): Promise<CryptoKey> {
  const raw = Buffer.from(hex, 'hex');
  return crypto.subtle.importKey('raw', raw, { name: ALGO }, false, ['encrypt', 'decrypt']);
}

export async function encryptToken(plaintext: string): Promise<string> {
  const keyHex = getKey(); // throws if missing — fail-closed
  const key = await importKey(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded);

  // Format: enc:<iv_base64>:<ciphertext_base64>
  const ivB64 = Buffer.from(iv).toString('base64');
  const ctB64 = Buffer.from(ciphertext).toString('base64');
  return `enc:${ivB64}:${ctB64}`;
}

export async function decryptToken(stored: string): Promise<string> {
  if (!stored.startsWith('enc:')) {
    // NI-M01 / F12 fix: plaintext fallback removed after backfill confirmed zero plaintext rows.
    // If a non-enc: value reaches here it means the backfill was incomplete or
    // a new plaintext value was written without encryption.
    // Throw to surface the problem rather than silently returning plaintext.
    throw new Error(
      `decryptToken: received unencrypted value. Ensure all tokens are encrypted ` +
      `and that encryptToken() is called on all write paths.`
    );
  }
  const keyHex = getKey(); // throws if missing — fail-closed
  const parts = stored.split(':');
  // Format: enc:<iv_b64>:<ct_b64>  — ct_b64 may contain '=' padding but not ':'
  const ivB64 = parts[1];
  const ctB64 = parts.slice(2).join(':'); // rejoin in case of padding edge case
  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');
  const key = await importKey(keyHex);
  const decrypted = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

/**
 * Deterministic SHA-256 hash of a plaintext API key.
 * Used for lookup-by-value without storing the plaintext (Zapier keys).
 * Not a secret — hash is stored in DB alongside the encrypted key.
 */
export function hashApiKey(plainKey: string): string {
  return createHash('sha256').update(plainKey).digest('hex');
}

/**
 * Mask a key for display: show prefix + dots + last 4 chars.
 * e.g. "3rdshift_abc123...xyz" → "3rdshift_••••••••••••xyz"
 * Minimum 4 chars tail; if key is shorter than 8 chars total, returns all dots.
 */
export function maskApiKey(plainKey: string): string {
  if (plainKey.length <= 8) return '••••••••';
  const tail = plainKey.slice(-4);
  // Preserve a recognizable prefix if present (e.g. "3rdshift_")
  const prefixMatch = plainKey.match(/^[a-z0-9]+_/i);
  const prefix = prefixMatch ? prefixMatch[0] : '';
  const dots = '••••••••••••••••'.slice(0, Math.max(8, plainKey.length - prefix.length - 4));
  return `${prefix}${dots}${tail}`;
}
