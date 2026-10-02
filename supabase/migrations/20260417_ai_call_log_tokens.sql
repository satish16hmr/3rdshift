-- Add input_tokens and output_tokens to ai_call_log
-- Every Claude/OpenAI API response returns these — now persisted for FA cost validation
-- April 17, 2026

ALTER TABLE ai_call_log
  ADD COLUMN IF NOT EXISTS input_tokens  INTEGER,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER;

-- Index for cost analysis queries (group by model, call_type, date)
CREATE INDEX IF NOT EXISTS idx_ai_call_log_tokens_analysis
  ON ai_call_log(call_type, model_tier, created_at DESC)
  WHERE input_tokens IS NOT NULL;
