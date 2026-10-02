-- Ava Team Lead System + one-per-day notification tracking
-- Phase 1 foundation for proactive notifications architecture

-- Add tracking columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_notification_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS milestone_reached INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consistency_streak_weeks INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reengagement_attempts INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_task_date DATE;

-- Add suggestion_type constraint update to team_updates to include Ava types
-- (existing check constraint covers: 'idea' | 'reminder' | 'encouragement' | 'alert')
-- We need to add: 'milestone' | 'consistency' | 'discovery' | 're-engagement'
-- Drop and recreate the check constraint
ALTER TABLE team_updates DROP CONSTRAINT IF EXISTS team_updates_suggestion_type_check;
ALTER TABLE team_updates ADD CONSTRAINT team_updates_suggestion_type_check
  CHECK (suggestion_type IN ('idea', 'reminder', 'encouragement', 'alert', 'milestone', 'consistency', 'discovery', 're-engagement'));
