-- Phase 5: add api_key_hash (SHA-256 for lookup) and masked_key (display) columns
-- to zapier_api_keys. The api_key column becomes encrypted storage.
-- Backfill of existing 6 rows is done via scripts/zapier-key-backfill.cjs (Node.js).

ALTER TABLE zapier_api_keys
  ADD COLUMN IF NOT EXISTS api_key_hash TEXT,
  ADD COLUMN IF NOT EXISTS masked_key   TEXT;

-- Index on hash for O(1) lookup (replaces the plain api_key lookup)
CREATE INDEX IF NOT EXISTS zapier_api_keys_hash_idx ON zapier_api_keys (api_key_hash);

-- Note: the existing unique index on api_key is kept — it now enforces
-- uniqueness of the encrypted value, which is fine (each encryption is unique).
-- The hash index is what requireZapierAuth uses for lookups after backfill.
