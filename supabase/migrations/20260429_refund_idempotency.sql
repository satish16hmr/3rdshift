-- Phase 15 F1: Refund idempotency index
-- Prevents the same refund being recorded twice in credit_transactions.
-- Partial index: only on refund rows (amount < 0) to keep index tight.
-- A refund for (user_id, reference_id, reference_type) should be unique.

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_refund_unique
  ON credit_transactions (user_id, reference_id, reference_type)
  WHERE amount < 0;

-- Note: if there are duplicate refund rows already (shouldn't be, but defensive):
-- Run this first to deduplicate before index creation:
--   DELETE FROM credit_transactions
--   WHERE id NOT IN (
--     SELECT MIN(id) FROM credit_transactions
--     WHERE amount < 0
--     GROUP BY user_id, reference_id, reference_type
--   ) AND amount < 0;
