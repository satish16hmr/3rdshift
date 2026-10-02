-- Add edited_output column to tasks table
-- Stores the customer's edited version of AI output (separate from original)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS edited_output TEXT;
