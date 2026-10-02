-- ============================================================
-- Migration: account_deletion_requests table
-- Run in Supabase SQL Editor AFTER Josh approves this file.
-- ============================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  user_email      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'completed', 'completed_with_errors')),
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at     TIMESTAMPTZ,
  approved_by     UUID,
  completed_at    TIMESTAMPTZ,
  error_log       TEXT
);

-- 2. Index for fast pending lookups
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user_id
  ON account_deletion_requests (user_id);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_status
  ON account_deletion_requests (status);

-- 3. Enable RLS
ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
--    Customers can INSERT their own deletion request
CREATE POLICY "Users can request deletion of own account"
  ON account_deletion_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

--    Customers can SELECT their own pending request
CREATE POLICY "Users can view own deletion requests"
  ON account_deletion_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

--    Service role (used by execute-deletion API) can do everything
--    (service role bypasses RLS by default in Supabase — no extra policy needed)

-- ============================================================
-- NOTE: This table is NEVER deleted. It is the compliance audit
-- log proving that deletions were requested and executed.
-- ============================================================
