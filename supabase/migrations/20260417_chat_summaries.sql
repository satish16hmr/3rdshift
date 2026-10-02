-- Chat Conversation Summaries
-- Stores Haiku-generated summaries of older messages (outside the 10-exchange sliding window)
-- One row per (workspace_id, member_id) pair — upserted when window slides
-- April 17, 2026

CREATE TABLE IF NOT EXISTS chat_conversation_summaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL,
  member_id       TEXT NOT NULL,
  summary         TEXT NOT NULL,
  summarized_up_to_msg_id UUID,     -- last message ID included in this summary
  message_count   INTEGER NOT NULL DEFAULT 0, -- how many messages are summarized
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_summaries_workspace_member
  ON chat_conversation_summaries(workspace_id, member_id);

ALTER TABLE chat_conversation_summaries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_conversation_summaries' AND policyname = 'Service role only'
  ) THEN
    -- Only service role can read/write — never exposed to browser client
    CREATE POLICY "Service role only" ON chat_conversation_summaries
      USING (false);
  END IF;
END $$;
