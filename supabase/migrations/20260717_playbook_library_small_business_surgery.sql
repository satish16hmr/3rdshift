-- Playbook Library Surgery: small-business-focused preset cleanup and additions.
-- Removes startup/pipeline-only cards, renames event promo, recategorizes proposals,
-- and adds the Welcome & Follow-Up playbook.

-- Remove cards/presets entirely. Keep any user-created chains by detaching the preset FK first.
UPDATE agent_mode_chains
SET preset_id = NULL,
    updated_at = now()
WHERE preset_id IN (
  'e5c27327-1033-43b9-bd17-b3488caf87a1', -- Investor Readiness Pipeline
  'bb6c8773-a082-43c6-9e35-3b0d2ea6a1fe', -- Site Audit → Content Loop
  '1eb61080-f0cf-4259-a7aa-992f32513025'  -- Product Positioning Sprint
);

DELETE FROM agent_mode_presets
WHERE id IN (
  'e5c27327-1033-43b9-bd17-b3488caf87a1',
  'bb6c8773-a082-43c6-9e35-3b0d2ea6a1fe',
  '1eb61080-f0cf-4259-a7aa-992f32513025'
);

-- Open House / Event Promo Chain → Event Promo Package. Steps unchanged.
UPDATE agent_mode_presets
SET
  name = 'Event Promo Package',
  description = 'Build the full promotional package for any event — a tasting, sale, workshop, or open house: landing page, ads, email, and social posts.'
WHERE id = '86bba1b9-c47d-4ed1-a2f6-13e72a4e5005';

-- Proposal Factory belongs in Multi-Purpose for contractors, consultants, and local services.
UPDATE agent_mode_presets
SET
  category = 'multi_purpose',
  sort_order = 2
WHERE id = '843c642d-7c62-4a10-bcc7-e6593c6f6229';

-- New Customer Welcome & Follow-Up => 2H + 0L
INSERT INTO agent_mode_presets (
  id,
  name,
  description,
  category,
  workers,
  default_schedule_days,
  heavy_credits_per_run,
  light_tasks_per_run,
  is_launch_preset,
  is_onboarding_preset,
  sort_order
)
VALUES (
  'cc04c5e8-a51c-4cc4-a9fe-c031043c3141',
  'New Customer Welcome & Follow-Up',
  'Turn new customers into repeat customers — a ready-to-send welcome email and follow-up sequence in your voice.',
  'multi_purpose',
  '[
  {
    "position": 1,
    "worker_id": "email-marketing-strategist",
    "form_settings": {
      "deliverable": "Post-Purchase Sequence",
      "business_context": "[User fills in - business, offer, customers, and what happens after purchase]",
      "business_type": "Local / Brick-and-mortar",
      "email_platform": "Mailchimp",
      "list_stage": "0-500 subs / just launched",
      "primary_goal": "Increase lifetime value / repeat purchase",
      "tone": "Warm & relationship-first"
    }
  },
  {
    "position": 2,
    "worker_id": "email-copywriter",
    "form_settings": {
      "email_type": "welcome",
      "target_audience": "Use the customer and audience details from Ellis''s welcome/follow-up strategy",
      "offer_or_context": "Write the ready-to-send welcome and follow-up emails from Ellis''s sequence plan",
      "primary_cta": "Invite the customer to take the next best step with the business",
      "sequence_length": "3 (short sequence)",
      "tone": "Warm / Personal"
    }
  }
]'::jsonb,
  ARRAY[]::text[],
  2,
  0,
  false,
  false,
  3
)
ON CONFLICT (name) DO UPDATE
SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  workers = EXCLUDED.workers,
  default_schedule_days = EXCLUDED.default_schedule_days,
  heavy_credits_per_run = EXCLUDED.heavy_credits_per_run,
  light_tasks_per_run = EXCLUDED.light_tasks_per_run,
  is_launch_preset = EXCLUDED.is_launch_preset,
  is_onboarding_preset = EXCLUDED.is_onboarding_preset,
  sort_order = EXCLUDED.sort_order;

-- Leave room for additional Multi-Purpose cards after the new welcome playbook.
UPDATE agent_mode_presets
SET sort_order = 4
WHERE id = '61bfc04a-01ad-47d4-98f6-96ae5bbc94b4';
