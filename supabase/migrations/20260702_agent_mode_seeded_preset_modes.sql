-- Explicit seeded playbook modes for strict mode-based chain costing.
-- Keeps card metadata aligned with mode-aware run charges.

-- Lead Gen + Outreach Pipeline (0a055395) => 6H + 1L
UPDATE agent_mode_presets
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "lead-generator",
    "form_settings": {
      "location": "[User fills in]",
      "target_industry": "[User fills in]",
      "lead_mode": "lead_list"
    }
  },
  {
    "position": 2,
    "worker_id": "sales-outreach-writer",
    "form_settings": {
      "tone": "Professional and personalized",
      "outreach_mode": "single_email",
      "channel": "Cold Email",
      "sequence_length": "5 messages"
    }
  },
  {
    "position": 3,
    "worker_id": "email-copywriter",
    "form_settings": {
      "email_type": "nurture"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 6,
  light_tasks_per_run = 1
WHERE id = '0a055395-a200-49b2-91b8-9873d5055ddd';

-- Proposal Factory (843c642d) => 1H + 1L
UPDATE agent_mode_presets
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "audience-persona-builder",
    "form_settings": {
      "industry_or_niche": "[User fills in]",
      "persona_depth_mode": "quick-sketch",
      "persona_purpose": "Copy & messaging"
    }
  },
  {
    "position": 2,
    "worker_id": "proposal-writer",
    "form_settings": {
      "proposal_stage": "draft",
      "proposal_mode": "proposal",
      "length_target": "Standard (3-5 pages)"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 1,
  light_tasks_per_run = 1
WHERE id = '843c642d-7c62-4a10-bcc7-e6593c6f6229';

-- Client Reporting Chain (3520b37b) => 1H + 1L
UPDATE agent_mode_presets
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "kpi-dashboard-writer",
    "form_settings": {
      "metrics_tracked": "[User fills in]",
      "reporting_cadence": "Monthly",
      "stage": "Growth"
    }
  },
  {
    "position": 2,
    "worker_id": "report-writer",
    "form_settings": {
      "audience": "Client stakeholders",
      "report_title": "Monthly client performance report",
      "report_mode": "business_review"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 1,
  light_tasks_per_run = 1
WHERE id = '3520b37b-7137-4402-b915-14d528b3746f';

-- Thought Leadership Engine (818aa017) => 3H + 1L
UPDATE agent_mode_presets
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "seo-strategist",
    "form_settings": {
      "primary_keyword": "[User fills in]",
      "seo_mode": "keyword_brief"
    }
  },
  {
    "position": 2,
    "worker_id": "content-writer",
    "form_settings": {
      "tone": "Professional",
      "topic": "Use the SEO brief from the previous step as source material",
      "target_audience": "[User fills in]",
      "article_card": "deep_dive"
    }
  },
  {
    "position": 3,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "post_type": "Framework / Breakdown"
    }
  },
  {
    "position": 4,
    "worker_id": "whitepaper-writer",
    "form_settings": {
      "document_type": "press_release"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 3,
  light_tasks_per_run = 1
WHERE id = '818aa017-98a3-4e45-987e-b18ba741af89';

-- Weekly Content Engine (e30bb7cc) => 0H + 3L
UPDATE agent_mode_presets
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
  heavy_credits_per_run = 0,
  light_tasks_per_run = 3
WHERE id = 'e30bb7cc-bb94-49d9-9ead-a9c8c15a54ea';

-- SEO Content Machine (71366da2) => 1H + 2L
UPDATE agent_mode_presets
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
  heavy_credits_per_run = 1,
  light_tasks_per_run = 2
WHERE id = '71366da2-47c2-48dc-aa1d-b19b6ec4781f';

-- Newsletter + Social Combo (9b9fb28a) => 0H + 3L
UPDATE agent_mode_presets
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
  heavy_credits_per_run = 0,
  light_tasks_per_run = 3
WHERE id = '9b9fb28a-6e11-4ba5-9744-38954e367fd3';

-- Course Launch Content Sprint (86e98a53) => 2H + 2L
UPDATE agent_mode_presets
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "content-strategist",
    "form_settings": {
      "goal": "Drive organic traffic",
      "timeframe": "4 weeks",
      "strategy_mode": "quick_brief"
    }
  },
  {
    "position": 2,
    "worker_id": "content-writer",
    "form_settings": {
      "topic": "Based on strategy output",
      "article_card": "blog_post"
    }
  },
  {
    "position": 3,
    "worker_id": "email-copywriter",
    "form_settings": {
      "email_type": "promotional"
    }
  },
  {
    "position": 4,
    "worker_id": "landing-page-copywriter",
    "form_settings": {
      "page_type": "product_launch"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 2,
  light_tasks_per_run = 2
WHERE id = '86e98a53-7333-457e-ab5c-6a9f23889590';

-- Weekly Ad Refresh (b53f78ae) => 0H + 3L
UPDATE agent_mode_presets
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "trend-analyst",
    "form_settings": {
      "focus": "Consumer trends",
      "industry": "[User fills in]",
      "trend_mode": "quick_scan",
      "timeframe": "Next 6 months"
    }
  },
  {
    "position": 2,
    "worker_id": "ecommerce-strategist",
    "form_settings": {
      "primary_goal": "Ad campaign optimization",
      "deliverable": "Product Page Strategy",
      "store_platform": "Shopify",
      "business_type": "Apparel / Fashion",
      "revenue_stage": "$5K-25K/mo"
    }
  },
  {
    "position": 3,
    "worker_id": "ad-copywriter",
    "form_settings": {
      "platform": "Meta Ads (Facebook + Instagram)",
      "num_variations": "3",
      "funnel_stage": "Cold - never heard of us"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 0,
  light_tasks_per_run = 3
WHERE id = 'b53f78ae-962a-4cec-a173-4f51fa35dc1a';

-- Product Launch Pipeline (eaa2b2a2) => 2H + 2L
UPDATE agent_mode_presets
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "product-description-writer",
    "form_settings": {
      "tone": "Benefit-driven",
      "product_name": "[User fills in]",
      "platform": "Shopify / DTC site",
      "length": "Standard (~150-300 words)"
    }
  },
  {
    "position": 2,
    "worker_id": "landing-page-copywriter",
    "form_settings": {
      "page_type": "product_launch"
    }
  },
  {
    "position": 3,
    "worker_id": "ad-copywriter",
    "form_settings": {
      "platform": "Meta Ads (Facebook + Instagram)",
      "num_variations": "3",
      "funnel_stage": "Cold - never heard of us"
    }
  },
  {
    "position": 4,
    "worker_id": "email-copywriter",
    "form_settings": {
      "email_type": "product_announcement"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 2,
  light_tasks_per_run = 2
WHERE id = 'eaa2b2a2-9c70-47a2-8089-294dd0c5b649';

-- Customer Review → Content Loop (cc478b15) => 0H + 3L
UPDATE agent_mode_presets
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
  heavy_credits_per_run = 0,
  light_tasks_per_run = 3
WHERE id = 'cc478b15-cc8a-485a-bea4-45b85ad29e39';

-- Site Audit → Content Loop (bb6c8773) => 0H + 2L
UPDATE agent_mode_presets
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
  heavy_credits_per_run = 0,
  light_tasks_per_run = 2
WHERE id = 'bb6c8773-a082-43c6-9e35-3b0d2ea6a1fe';

-- Competitive Intel + Pricing (fb7ba3a9) => 2H + 2L
UPDATE agent_mode_presets
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "competitor-analyst",
    "form_settings": {
      "focus_areas": "Pricing, messaging, offers",
      "competitors_to_analyze": "[User fills in]",
      "analysis_goal": "General competitive intel",
      "output_depth": "Standard (default - full analysis, 2,000-3,000 words)"
    }
  },
  {
    "position": 2,
    "worker_id": "pricing-strategist",
    "form_settings": {
      "pricing_goal": "Competitive pricing analysis",
      "pricing_mode": "quick_pricing",
      "business_model": "SaaS subscription"
    }
  },
  {
    "position": 3,
    "worker_id": "ad-campaign-strategist",
    "form_settings": {
      "campaign_goal": "Competitive response",
      "campaign_mode": "quick-angle",
      "platform": "Meta Ads (Facebook + Instagram)"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 2,
  light_tasks_per_run = 2
WHERE id = 'fb7ba3a9-f5d7-41af-8260-6bd20c37a852';

-- Local Authority Builder (bb4bc4b6) => 0H + 4L
UPDATE agent_mode_presets
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "content-writer",
    "form_settings": {
      "tone": "Friendly, community-focused",
      "topic": "[User fills in - local topic]",
      "article_card": "blog_post"
    }
  },
  {
    "position": 2,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "tone": "Local business / community voice",
      "content_type": "Content batch"
    }
  },
  {
    "position": 3,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "post_type": "Personal Story"
    }
  },
  {
    "position": 4,
    "worker_id": "newsletter-writer",
    "form_settings": {
      "newsletter_topic": "Based on blog post",
      "newsletter_style": "classic_founder",
      "newsletter_length": "standard"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 0,
  light_tasks_per_run = 4
WHERE id = 'bb4bc4b6-e4e0-4442-bf35-6ff0da6a1026';

-- Open House / Event Promo Chain (86bba1b9) => 2H + 2L
UPDATE agent_mode_presets
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "landing-page-copywriter",
    "form_settings": {
      "page_type": "webinar",
      "product_or_service": "[User fills in - event name and details]"
    }
  },
  {
    "position": 2,
    "worker_id": "ad-copywriter",
    "form_settings": {
      "platform": "Meta Ads (Facebook + Instagram)",
      "num_variations": "3",
      "funnel_stage": "Cold - never heard of us"
    }
  },
  {
    "position": 3,
    "worker_id": "email-copywriter",
    "form_settings": {
      "email_type": "promotional"
    }
  },
  {
    "position": 4,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "tone": "Event promotion",
      "content_type": "Content batch"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 2,
  light_tasks_per_run = 2
WHERE id = '86bba1b9-c47d-4ed1-a2f6-13e72a4e5005';

-- Brand Voice + Content Foundation (61bfc04a) => 2H + 2L
UPDATE agent_mode_presets
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "brand-strategist",
    "form_settings": {
      "brand_name": "[User fills in]",
      "industry_or_category": "[User fills in]",
      "strategy_mode": "positioning",
      "brand_stage": "Pre-launch"
    }
  },
  {
    "position": 2,
    "worker_id": "content-strategist",
    "form_settings": {
      "goal": "Content strategy based on brand direction",
      "strategy_mode": "full_strategy",
      "timeframe": "90 days"
    }
  },
  {
    "position": 3,
    "worker_id": "content-writer",
    "form_settings": {
      "topic": "Based on content strategy",
      "article_card": "blog_post"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 2,
  light_tasks_per_run = 2
WHERE id = '61bfc04a-01ad-47d4-98f6-96ae5bbc94b4';

-- Hiring Pipeline (802c783d) => 1H + 2L
UPDATE agent_mode_presets
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "job-description-writer",
    "form_settings": {
      "department": "[User fills in]",
      "role_title": "[User fills in]",
      "role_type": "tech_role",
      "work_location": "Fully remote",
      "hiring_approach": "Skills-first"
    }
  },
  {
    "position": 2,
    "worker_id": "interview-question-writer",
    "form_settings": {
      "role": "Based on job description",
      "num_questions": "10",
      "hiring_mode": "interview_questions"
    }
  },
  {
    "position": 3,
    "worker_id": "resume-screener",
    "form_settings": {
      "required_quals": "Based on job description",
      "screening_mode": "single_candidate"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 1,
  light_tasks_per_run = 2
WHERE id = '802c783d-613e-495e-a548-58c7ed76e3f6';

-- Onboarding Document Kit (9e5739d3) => 0H + 3L
UPDATE agent_mode_presets
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "onboarding-document-creator",
    "form_settings": {
      "role": "[User fills in]",
      "company": "[User fills in]"
    }
  },
  {
    "position": 2,
    "worker_id": "standard-operating-procedure-writer",
    "form_settings": {
      "process_name": "Based on onboarding outline",
      "sop_format": "checklist",
      "audience": "Mixed / anyone on the team",
      "frequency": "On demand"
    }
  },
  {
    "position": 3,
    "worker_id": "training-material-writer",
    "form_settings": {
      "training_topic": "Based on role requirements",
      "training_mode": "quick_reference",
      "learner_experience_level": "Mixed audience"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 0,
  light_tasks_per_run = 3
WHERE id = '9e5739d3-4c46-4995-9444-5797009d4b75';

-- Investor Readiness Pipeline (e5c27327) => 4H + 0L
UPDATE agent_mode_presets
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "competitor-analyst",
    "form_settings": {
      "focus_areas": "Market positioning, funding, traction",
      "competitors_to_analyze": "[User fills in]",
      "analysis_goal": "General competitive intel",
      "output_depth": "Standard (default - full analysis, 2,000-3,000 words)"
    }
  },
  {
    "position": 2,
    "worker_id": "business-plan-writer",
    "form_settings": {
      "stage": "[User fills in]",
      "business_name": "[User fills in]",
      "plan_mode": "investor_plan"
    }
  },
  {
    "position": 3,
    "worker_id": "pitch-deck-writer",
    "form_settings": {
      "slide_count": "10",
      "audience_sophistication": "Institutional VCs / professional investors"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 4,
  light_tasks_per_run = 0
WHERE id = 'e5c27327-1033-43b9-bd17-b3488caf87a1';

-- Weekly Content Marketing Engine (54fe901c) => 1H + 3L
UPDATE agent_mode_presets
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
  heavy_credits_per_run = 1,
  light_tasks_per_run = 3
WHERE id = '54fe901c-eca9-4326-a6d7-9421ce015688';

-- Product Positioning Sprint (1eb61080) => 3H + 1L
UPDATE agent_mode_presets
SET
  workers = '[
  {
    "position": 1,
    "worker_id": "market-research-analyst",
    "form_settings": {
      "market": "[User fills in]",
      "purpose": "Competitive intelligence"
    }
  },
  {
    "position": 2,
    "worker_id": "audience-persona-builder",
    "form_settings": {
      "product_or_service": "[User fills in]",
      "persona_depth_mode": "full-set",
      "persona_purpose": "Copy & messaging"
    }
  },
  {
    "position": 3,
    "worker_id": "brand-strategist",
    "form_settings": {
      "brand_name": "Based on strategy output",
      "strategy_mode": "positioning",
      "brand_stage": "Pre-launch"
    }
  }
]'::jsonb,
  heavy_credits_per_run = 3,
  light_tasks_per_run = 1
WHERE id = '1eb61080-f0cf-4259-a7aa-992f32513025';
