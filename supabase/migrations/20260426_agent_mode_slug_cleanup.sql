-- Brief 1A/1B/1C slug cleanup in agent_mode_presets
-- Updates stale worker_ids in preset JSON workers arrays
-- Runs once on migration apply; safe to re-run (idempotent via string replace)

-- press-release-writer → whitepaper-writer (Finch cut, Naru absorbs as press_release mode)
UPDATE agent_mode_presets
SET workers = jsonb_set(
  workers::text::jsonb,
  '{}'::text[],
  (
    SELECT jsonb_agg(
      CASE WHEN (item->>'worker_id') = 'press-release-writer'
        THEN jsonb_set(item, '{worker_id}', '"whitepaper-writer"')
        ELSE item
      END
    )
    FROM jsonb_array_elements(workers) AS item
  )
)
WHERE workers::text LIKE '%press-release-writer%';

-- tagline-writer → brand-strategist (Kit cut, Piper messaging mode absorbs taglines)
UPDATE agent_mode_presets
SET workers = (
  SELECT jsonb_agg(
    CASE WHEN (item->>'worker_id') = 'tagline-writer'
      THEN jsonb_set(item, '{worker_id}', '"brand-strategist"')
      ELSE item
    END
  )
  FROM jsonb_array_elements(workers) AS item
)
WHERE workers::text LIKE '%tagline-writer%';

-- seo-writer → seo-strategist (old slug, pre-Brief 1A rename)
UPDATE agent_mode_presets
SET workers = (
  SELECT jsonb_agg(
    CASE WHEN (item->>'worker_id') = 'seo-writer'
      THEN jsonb_set(item, '{worker_id}', '"seo-strategist"')
      ELSE item
    END
  )
  FROM jsonb_array_elements(workers) AS item
)
WHERE workers::text LIKE '%seo-writer%';

-- twitter-ghostwriter → x-twitter-ghostwriter (old slug)
UPDATE agent_mode_presets
SET workers = (
  SELECT jsonb_agg(
    CASE WHEN (item->>'worker_id') = 'twitter-ghostwriter'
      THEN jsonb_set(item, '{worker_id}', '"x-twitter-ghostwriter"')
      ELSE item
    END
  )
  FROM jsonb_array_elements(workers) AS item
)
WHERE workers::text LIKE '%twitter-ghostwriter%';

-- brand-voice-guide-writer → brand-strategist (Ember reshaped, Piper covers brand voice)
UPDATE agent_mode_presets
SET workers = (
  SELECT jsonb_agg(
    CASE WHEN (item->>'worker_id') = 'brand-voice-guide-writer'
      THEN jsonb_set(item, '{worker_id}', '"brand-strategist"')
      ELSE item
    END
  )
  FROM jsonb_array_elements(workers) AS item
)
WHERE workers::text LIKE '%brand-voice-guide-writer%';

-- customer-review-responder → site-auditor (Nash reshaped)
UPDATE agent_mode_presets
SET workers = (
  SELECT jsonb_agg(
    CASE WHEN (item->>'worker_id') = 'customer-review-responder'
      THEN jsonb_set(item, '{worker_id}', '"site-auditor"')
      ELSE item
    END
  )
  FROM jsonb_array_elements(workers) AS item
)
WHERE workers::text LIKE '%customer-review-responder%';

-- proposal-bid-writer → proposal-writer (old slug)
UPDATE agent_mode_presets
SET workers = (
  SELECT jsonb_agg(
    CASE WHEN (item->>'worker_id') = 'proposal-bid-writer'
      THEN jsonb_set(item, '{worker_id}', '"proposal-writer"')
      ELSE item
    END
  )
  FROM jsonb_array_elements(workers) AS item
)
WHERE workers::text LIKE '%proposal-bid-writer%';

-- long-form-article-writer → content-writer (Sam reshaped to Hook Specialist, Ava is now article writer)
UPDATE agent_mode_presets
SET workers = (
  SELECT jsonb_agg(
    CASE WHEN (item->>'worker_id') = 'long-form-article-writer'
      THEN jsonb_set(item, '{worker_id}', '"content-writer"')
      ELSE item
    END
  )
  FROM jsonb_array_elements(workers) AS item
)
WHERE workers::text LIKE '%long-form-article-writer%';
