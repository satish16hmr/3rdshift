-- ============================================================
-- Phase 2: Chat Tables (team_chat_messages, team_member_memories, brand_profile)
-- 3rdShift · April 3, 2026
-- ============================================================

-- ── Enable pgvector ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── team_chat_messages ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_chat_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id      TEXT NOT NULL,
  role           TEXT NOT NULL,
  content        TEXT NOT NULL,
  deliverable_id UUID,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_member
  ON team_chat_messages(user_id, member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user
  ON team_chat_messages(user_id, created_at DESC);

ALTER TABLE team_chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'team_chat_messages' AND policyname = 'Users manage own messages'
  ) THEN
    CREATE POLICY "Users manage own messages" ON team_chat_messages
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── team_member_memories ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_member_memories (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id      TEXT,
  memory_type    TEXT NOT NULL,
  content        TEXT NOT NULL,
  embedding      vector(1536),
  created_at     TIMESTAMPTZ DEFAULT now(),
  invalidated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_memories_user_member
  ON team_member_memories(user_id, member_id)
  WHERE invalidated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_memories_user_brand
  ON team_member_memories(user_id, memory_type)
  WHERE member_id IS NULL AND invalidated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_memories_embedding
  ON team_member_memories USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE team_member_memories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'team_member_memories' AND policyname = 'Users manage own memories'
  ) THEN
    CREATE POLICY "Users manage own memories" ON team_member_memories
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── brand_profile ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brand_profile (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name       TEXT,
  industry           TEXT,
  audience           TEXT,
  tone               TEXT,
  competitors        TEXT,
  additional_context TEXT,
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_profile_user
  ON brand_profile(user_id);

ALTER TABLE brand_profile ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'brand_profile' AND policyname = 'Users manage own brand profile'
  ) THEN
    CREATE POLICY "Users manage own brand profile" ON brand_profile
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
