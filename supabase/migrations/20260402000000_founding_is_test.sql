-- Add is_test flag to founding_members so test signups can be excluded from the spot counter
ALTER TABLE founding_members ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false;
