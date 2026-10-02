-- Restructure Agent Mode Playbooks that duplicated Holly social repurposing before platform specialists.
-- Keeps live DB/card copy in sync with the seeded registry.

-- Weekly Content Engine => 0H + 3L
UPDATE agent_mode_presets
SET
  description = 'Produce a blog post, then have Case and Elliot turn the article into platform-native X/Twitter and LinkedIn content.',
  workers = '[
  {
    "position": 1,
    "worker_id": "content-writer",
    "form_settings": {
      "tone": "Professional",
      "topic": "[User fills in]",
      "target_audience": "[User fills in]",
      "article_card": "blog_post"
    }
  },
  {
    "position": 2,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "topic": "Use the completed article from the previous step as source material",
      "tone": "Direct",
      "content_type": "Content batch"
    }
  },
  {
    "position": 3,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "topic": "Use the completed article from the previous step as source material",
      "post_type": "Framework / Breakdown"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 0,
  light_tasks_per_run = 3
WHERE id = 'e30bb7cc-bb94-49d9-9ead-a9c8c15a54ea';

UPDATE agent_mode_chains
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "content-writer",
    "form_settings": {
      "tone": "Professional",
      "topic": "[User fills in]",
      "target_audience": "[User fills in]",
      "article_card": "blog_post"
    }
  },
  {
    "position": 2,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "topic": "Use the completed article from the previous step as source material",
      "tone": "Direct",
      "content_type": "Content batch"
    }
  },
  {
    "position": 3,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "topic": "Use the completed article from the previous step as source material",
      "post_type": "Framework / Breakdown"
    }
  }
]'::jsonb,
  updated_at = now()
WHERE preset_id = 'e30bb7cc-bb94-49d9-9ead-a9c8c15a54ea';

-- SEO Content Machine => 1H + 2L
UPDATE agent_mode_presets
SET
  description = 'Build an SEO strategy brief, then have Case and Elliot create platform-native social posts from the brief.',
  workers = '[
  {
    "position": 1,
    "worker_id": "seo-strategist",
    "form_settings": {
      "intent_override": "Informational",
      "primary_keyword": "[User fills in]",
      "seo_mode": "keyword_brief"
    }
  },
  {
    "position": 2,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "topic": "Use the SEO strategy brief from the previous step as source material",
      "tone": "Data-driven",
      "content_type": "Content batch"
    }
  },
  {
    "position": 3,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "topic": "Use the SEO strategy brief from the previous step as source material",
      "post_type": "Industry Insight"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 1,
  light_tasks_per_run = 2
WHERE id = '71366da2-47c2-48dc-aa1d-b19b6ec4781f';

UPDATE agent_mode_chains
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "seo-strategist",
    "form_settings": {
      "intent_override": "Informational",
      "primary_keyword": "[User fills in]",
      "seo_mode": "keyword_brief"
    }
  },
  {
    "position": 2,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "topic": "Use the SEO strategy brief from the previous step as source material",
      "tone": "Data-driven",
      "content_type": "Content batch"
    }
  },
  {
    "position": 3,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "topic": "Use the SEO strategy brief from the previous step as source material",
      "post_type": "Industry Insight"
    }
  }
]'::jsonb,
  updated_at = now()
WHERE preset_id = '71366da2-47c2-48dc-aa1d-b19b6ec4781f';

-- Newsletter + Social Combo => 0H + 3L
UPDATE agent_mode_presets
SET
  description = 'Write a newsletter, then have Case and Elliot turn it into platform-native X/Twitter and LinkedIn content.',
  workers = '[
  {
    "position": 1,
    "worker_id": "newsletter-writer",
    "form_settings": {
      "tone": "Friendly and informative",
      "newsletter_topic": "[User fills in]",
      "newsletter_length": "standard",
      "newsletter_style": "morning_brew",
      "target_audience": "[User fills in]",
      "core_takeaway": "[User fills in]"
    }
  },
  {
    "position": 2,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "topic": "Use the completed newsletter from the previous step as source material",
      "tone": "Direct",
      "content_type": "Content batch"
    }
  },
  {
    "position": 3,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "topic": "Use the completed newsletter from the previous step as source material",
      "post_type": "Personal Story"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 0,
  light_tasks_per_run = 3
WHERE id = '9b9fb28a-6e11-4ba5-9744-38954e367fd3';

UPDATE agent_mode_chains
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "newsletter-writer",
    "form_settings": {
      "tone": "Friendly and informative",
      "newsletter_topic": "[User fills in]",
      "newsletter_length": "standard",
      "newsletter_style": "morning_brew",
      "target_audience": "[User fills in]",
      "core_takeaway": "[User fills in]"
    }
  },
  {
    "position": 2,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "topic": "Use the completed newsletter from the previous step as source material",
      "tone": "Direct",
      "content_type": "Content batch"
    }
  },
  {
    "position": 3,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "topic": "Use the completed newsletter from the previous step as source material",
      "post_type": "Personal Story"
    }
  }
]'::jsonb,
  updated_at = now()
WHERE preset_id = '9b9fb28a-6e11-4ba5-9744-38954e367fd3';

-- Customer Review → Content Loop => 0H + 3L
UPDATE agent_mode_presets
SET
  description = 'Turn customer review/support context into a response, then have Case and Elliot create social-proof posts from that output.',
  workers = '[
  {
    "position": 1,
    "worker_id": "customer-support-writer",
    "form_settings": {
      "brand_tone": "Empathetic",
      "content_type": "Complaint Responses",
      "product_name": "[User fills in]",
      "product_description": "[User fills in]",
      "common_issues": "[User fills in - paste review text here]"
    }
  },
  {
    "position": 2,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "topic": "Use the customer review response from the previous step as source material",
      "tone": "Storyteller",
      "content_type": "Content batch"
    }
  },
  {
    "position": 3,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "topic": "Use the customer review response from the previous step as source material",
      "post_type": "Case Study"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 0,
  light_tasks_per_run = 3
WHERE id = 'cc478b15-cc8a-485a-bea4-45b85ad29e39';

UPDATE agent_mode_chains
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "customer-support-writer",
    "form_settings": {
      "brand_tone": "Empathetic",
      "content_type": "Complaint Responses",
      "product_name": "[User fills in]",
      "product_description": "[User fills in]",
      "common_issues": "[User fills in - paste review text here]"
    }
  },
  {
    "position": 2,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "topic": "Use the customer review response from the previous step as source material",
      "tone": "Storyteller",
      "content_type": "Content batch"
    }
  },
  {
    "position": 3,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "topic": "Use the customer review response from the previous step as source material",
      "post_type": "Case Study"
    }
  }
]'::jsonb,
  updated_at = now()
WHERE preset_id = 'cc478b15-cc8a-485a-bea4-45b85ad29e39';

-- Site Audit → Content Loop => 0H + 2L
UPDATE agent_mode_presets
SET
  description = 'Audit one page, then have Case turn the findings into an X/Twitter thread.',
  workers = '[
  {
    "position": 1,
    "worker_id": "site-auditor",
    "form_settings": {
      "site_url": "[User fills in]",
      "audit_mode": "single_page_scan"
    }
  },
  {
    "position": 2,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "goal": "Drive replies",
      "tone": "Direct",
      "topic": "Use the site audit findings from the previous step as source material",
      "num_posts": "5",
      "content_type": "Thread"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 0,
  light_tasks_per_run = 2
WHERE id = 'bb6c8773-a082-43c6-9e35-3b0d2ea6a1fe';

UPDATE agent_mode_chains
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "site-auditor",
    "form_settings": {
      "site_url": "[User fills in]",
      "audit_mode": "single_page_scan"
    }
  },
  {
    "position": 2,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "goal": "Drive replies",
      "tone": "Direct",
      "topic": "Use the site audit findings from the previous step as source material",
      "num_posts": "5",
      "content_type": "Thread"
    }
  }
]'::jsonb,
  updated_at = now()
WHERE preset_id = 'bb6c8773-a082-43c6-9e35-3b0d2ea6a1fe';

-- Weekly Content Marketing Engine => 1H + 3L
UPDATE agent_mode_presets
SET
  description = 'Plan the weekly content angle, draft the article, then have Case and Elliot create platform-native social posts from the strategy and article.',
  workers = '[
  {
    "position": 1,
    "worker_id": "content-strategist",
    "form_settings": {
      "goal": "Content calendar for the week",
      "business": "[User fills in]",
      "strategy_mode": "pillar_framework",
      "timeframe": "90 days"
    }
  },
  {
    "position": 2,
    "worker_id": "content-writer",
    "form_settings": {
      "topic": "Based on strategy output",
      "target_audience": "Audience defined in the content strategy output",
      "article_card": "blog_post"
    }
  },
  {
    "position": 3,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "topic": "Use the content strategy and completed article from earlier steps as source material",
      "tone": "Direct",
      "content_type": "Content batch"
    }
  },
  {
    "position": 4,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "topic": "Use the content strategy and completed article from earlier steps as source material",
      "post_type": "Framework / Breakdown"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 1,
  light_tasks_per_run = 3
WHERE id = '54fe901c-eca9-4326-a6d7-9421ce015688';

UPDATE agent_mode_chains
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "content-strategist",
    "form_settings": {
      "goal": "Content calendar for the week",
      "business": "[User fills in]",
      "strategy_mode": "pillar_framework",
      "timeframe": "90 days"
    }
  },
  {
    "position": 2,
    "worker_id": "content-writer",
    "form_settings": {
      "topic": "Based on strategy output",
      "target_audience": "Audience defined in the content strategy output",
      "article_card": "blog_post"
    }
  },
  {
    "position": 3,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "topic": "Use the content strategy and completed article from earlier steps as source material",
      "tone": "Direct",
      "content_type": "Content batch"
    }
  },
  {
    "position": 4,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "topic": "Use the content strategy and completed article from earlier steps as source material",
      "post_type": "Framework / Breakdown"
    }
  }
]'::jsonb,
  updated_at = now()
WHERE preset_id = '54fe901c-eca9-4326-a6d7-9421ce015688';
