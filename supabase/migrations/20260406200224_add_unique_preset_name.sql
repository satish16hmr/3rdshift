-- Add unique constraint on preset name to prevent duplicates from re-seeding
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_mode_presets_name_unique'
  ) THEN
    ALTER TABLE agent_mode_presets ADD CONSTRAINT agent_mode_presets_name_unique UNIQUE (name);
  END IF;
END $$;
