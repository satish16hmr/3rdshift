-- Add brand_context column to profiles (for Bug 2 fix)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS brand_context text;

-- Create pinned_workers table (for Bug 3 fix)
CREATE TABLE IF NOT EXISTS pinned_workers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  worker_slug text NOT NULL,
  pinned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, worker_slug)
);

ALTER TABLE pinned_workers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pinned_workers' AND policyname='Users manage own pins') THEN
    CREATE POLICY "Users manage own pins" ON pinned_workers FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pinned_workers_user_id ON pinned_workers(user_id);
