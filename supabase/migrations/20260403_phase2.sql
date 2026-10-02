-- ============================================================
-- Agent Mode Phase 2 — DB Schema
-- 3rdShift · April 2, 2026
-- ============================================================

-- ── ai_call_log ──────────────────────────────────────────────
-- Logs every callAI() call for admin monitoring + fallback rate
CREATE TABLE IF NOT EXISTS ai_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  call_type TEXT,           -- 'worker' | 'jarvis' | 'orchestration' | 'memory'
  model_tier TEXT,          -- 'sonnet' | 'haiku'
  provider_used TEXT,       -- 'anthropic' | 'openai'
  is_fallback BOOLEAN DEFAULT false,
  worker_id TEXT,           -- nullable
  chain_run_id UUID,        -- nullable
  latency_ms INTEGER,
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_call_log_created ON ai_call_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_call_log_fallback ON ai_call_log(is_fallback) WHERE is_fallback = true;
CREATE INDEX IF NOT EXISTS idx_ai_call_log_user ON ai_call_log(user_id);

-- No RLS — admin reads via service role only

-- ── credit_topups ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pack_name TEXT NOT NULL,           -- 'small' | 'medium' | 'large' | 'xl'
  credits_purchased INTEGER NOT NULL,
  credits_remaining INTEGER NOT NULL,
  price_paid INTEGER NOT NULL,       -- cents
  stripe_payment_id TEXT,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,   -- end of current billing period
  is_expired BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_topups_user ON credit_topups(user_id);
CREATE INDEX IF NOT EXISTS idx_topups_active ON credit_topups(user_id, is_expired) WHERE is_expired = false;

ALTER TABLE credit_topups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='credit_topups' AND policyname='Users read own topups'
  ) THEN
    CREATE POLICY "Users read own topups" ON credit_topups
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
