-- Add compressed_profile cache to brand_profile table
-- Haiku-compressed version (~200 tokens) replaces raw JSON injection in chat
-- April 17, 2026

ALTER TABLE brand_profile
  ADD COLUMN IF NOT EXISTS compressed_profile TEXT,
  ADD COLUMN IF NOT EXISTS compressed_at TIMESTAMPTZ;

-- Index for quick cache lookup
CREATE INDEX IF NOT EXISTS idx_brand_profile_workspace
  ON brand_profile(workspace_id);
