/**
 * Phase 5 / F12 — OAuth token backfill for Mailchimp and Notion
 * Encrypts any plaintext access_token rows (lazy migration completion).
 * Safe to re-run — skips rows already starting with 'enc:' or 'pending:'.
 *
 * Usage: node scripts/oauth-token-backfill.cjs
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');

const ENC_KEY = process.env.TOKEN_ENCRYPTION_KEY ?? process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
if (!ENC_KEY) { console.error('TOKEN_ENCRYPTION_KEY not set'); process.exit(1); }

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function importKey(hex) {
  const raw = Buffer.from(hex, 'hex');
  return globalThis.crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptToken(plaintext) {
  const key = await importKey(ENC_KEY);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ct = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return `enc:${Buffer.from(iv).toString('base64')}:${Buffer.from(ct).toString('base64')}`;
}

async function backfillTable(tableName) {
  const { data: rows, error } = await admin.from(tableName).select('id, access_token');
  if (error) { console.error(tableName, 'fetch error:', error.message); return; }

  const toEncrypt = (rows || []).filter(r =>
    r.access_token &&
    !r.access_token.startsWith('enc:') &&
    !r.access_token.startsWith('pending:')
  );

  console.log(`${tableName}: ${rows.length} total, ${toEncrypt.length} need encryption`);

  let ok = 0, fail = 0;
  for (const row of toEncrypt) {
    try {
      const encrypted = await encryptToken(row.access_token);
      const { error: upErr } = await admin.from(tableName)
        .update({ access_token: encrypted })
        .eq('id', row.id);
      if (upErr) throw upErr;
      console.log(`  ✅ ${tableName} row ${row.id.slice(0, 8)}... encrypted`);
      ok++;
    } catch (e) {
      console.error(`  ❌ ${tableName} row ${row.id.slice(0, 8)}... FAILED:`, e.message);
      fail++;
    }
  }
  console.log(`  Done: ${ok} encrypted, ${fail} failed\n`);
  return fail;
}

async function run() {
  console.log('Backfilling OAuth tokens...\n');
  const f1 = await backfillTable('mailchimp_tokens');
  const f2 = await backfillTable('notion_tokens');

  const totalFail = (f1 || 0) + (f2 || 0);
  if (totalFail > 0) {
    console.error(`${totalFail} rows failed — do not remove plaintext fallback`);
    process.exit(1);
  }

  // Verify zero plaintext rows remain
  const [mc, no] = await Promise.all([
    admin.from('mailchimp_tokens').select('id, access_token').then(r =>
      (r.data || []).filter(row => row.access_token && !row.access_token.startsWith('enc:') && !row.access_token.startsWith('pending:')).length
    ),
    admin.from('notion_tokens').select('id, access_token').then(r =>
      (r.data || []).filter(row => row.access_token && !row.access_token.startsWith('enc:') && !row.access_token.startsWith('pending:')).length
    ),
  ]);

  console.log(`Verification: mailchimp plaintext=${mc}, notion plaintext=${no}`);
  if (mc === 0 && no === 0) {
    console.log('✅ Zero plaintext rows remain. Safe to remove decryptToken fallback.');
  } else {
    console.error(`❌ Still ${mc + no} plaintext rows — do not remove fallback`);
    process.exit(1);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
