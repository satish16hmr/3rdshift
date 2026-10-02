-- Support monthly window type in chat_rate_limits
-- The table already exists; just ensure the window_type constraint allows 'month'
-- and add index for monthly queries

DO $$
BEGIN
  -- Add index for monthly window queries if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'chat_rate_limits'
    AND indexname = 'idx_chat_rate_limits_month'
  ) THEN
    CREATE INDEX idx_chat_rate_limits_month
      ON chat_rate_limits (user_id, member_id, window_type, window_start)
      WHERE window_type = 'month';
  END IF;
END $$;
