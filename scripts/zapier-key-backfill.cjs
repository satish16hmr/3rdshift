/**
 * Phase 5 — Zapier API key backfill
 *
 * For each row in zapier_api_keys where api_key_hash IS NULL:
 *   1. Read the raw api_key (currently plaintext)
 *   2. Compute SHA-256 hash  (hashApiKey)
 *   3. Encrypt the key       (encryptToken — AES-GCM)
 *   4. Compute masked display (maskApiKey)
 *   5. Update: api_key = encrypted, api_key_hash = hash, masked_key = masked
 *
 * Idempotent: skips rows where api_key already starts with 'enc:'
 * Safe to re-run.
 *
 * Usage:
 *   node scripts/zapier-key-backfill.cjs
 *
 * Requires: .env.local with TOKEN_ENCRYPTION_KEY (or GOOGLE_TOKEN_ENCRYPTION_KEY)
 *           and SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const { createHash } = require('crypto');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENC_KEY      = process.env.TOKEN_ENCRYPTION_KEY ?? process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!ENC_KEY) {
  console.error('Missing TOKEN_ENCRYPTION_KEY (or GOOGLE_TOKEN_ENCRYPTION_KEY)');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Crypto helpers (Node.js Web Crypto — same as lib/crypto.ts) ──────────────

function hashApiKey(plainKey) {
  return createHash('sha256').update(plainKey).digest('hex');
}

function maskApiKey(plainKey) {
  if (plainKey.length <= 8) return '••••••••';
  const tail = plainKey.slice(-4);
  const prefixMatch = plainKey.match(/^[a-z0-9]+_/i);
  const prefix = prefixMatch ? prefixMatch[0] : '';
  const dots = '••••••••••••••••'.slice(0, Math.max(8, plainKey.length - prefix.length - 4));
  return `${prefix}${dots}${tail}`;
}

async function importKey(hex) {
  const raw = Buffer.from(hex, 'hex');
  return globalThis.crypto.subtle.importKey(
    'raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
  );
}

async function encryptToken(plaintext) {
  const key = await importKey(ENC_KEY);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const ivB64 = Buffer.from(iv).toString('base64');
  const ctB64 = Buffer.from(ciphertext).toString('base64');
  return `enc:${ivB64}:${ctB64}`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('Fetching zapier_api_keys rows...');

  const { data: rows, error } = await admin
    .from('zapier_api_keys')
    .select('id, api_key, api_key_hash')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch rows:', error.message);
    process.exit(1);
  }

  console.log(`Found ${rows.length} total rows`);

  const toProcess = rows.filter(r => !r.api_key?.startsWith('enc:'));
  console.log(`${toProcess.length} rows need backfill (${rows.length - toProcess.length} already encrypted)`);

  if (toProcess.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let ok = 0, fail = 0;

  for (const row of toProcess) {
    try {
      const plainKey   = row.api_key;
      const encrypted  = await encryptToken(plainKey);
      const hash       = hashApiKey(plainKey);
      const masked     = maskApiKey(plainKey);

      const { error: updateErr } = await admin
        .from('zapier_api_keys')
        .update({ api_key: encrypted, api_key_hash: hash, masked_key: masked })
        .eq('id', row.id);

      if (updateErr) throw updateErr;

      console.log(`  ✅ Row ${row.id.slice(0, 8)}... → hash=${hash.slice(0, 12)}... masked=${masked}`);
      ok++;
    } catch (err) {
      console.error(`  ❌ Row ${row.id.slice(0, 8)}... FAILED:`, err.message);
      fail++;
    }
  }

  console.log(`\nDone: ${ok} encrypted, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
