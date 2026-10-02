-- Phase 15 Batch E v4: Playbook Content Rebuild
-- Source: Roger's Batch D schema dump + verification pass corrections (2026-04-29)
-- v4: 23 missing required fields added across 14 Playbooks + Proposal Factory restructured to 2 steps

-- ============================================================
-- 1. Brand Voice + Content Foundation (61bfc04a) [LAUNCH+ONBOARDING]
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "brand-strategist",
    "form_settings": {
      "strategy_mode": "positioning",
      "brand_name": "[User fills in]",
      "what_you_do": "[User fills in]",
      "industry_or_category": "[User fills in]",
      "target_customer": "[User fills in]",
      "brand_stage": "[User fills in]",
      "top_competitors": "[User fills in]",
      "brand_personality": "Direct, confident, results-focused"
    }
  },
  {
    "step": 2,
    "worker_id": "audience-persona-builder",
    "form_settings": {
      "persona_depth_mode": "full-set",
      "product_or_service": "[User fills in]",
      "audience_description": "[User fills in]",
      "industry_or_niche": "[User fills in]",
      "persona_purpose": "[User fills in]",
      "business_context": "[Output from step 1]",
      "existing_knowledge": ""
    }
  },
  {
    "step": 3,
    "worker_id": "content-strategist",
    "form_settings": {
      "strategy_mode": "full_strategy",
      "goal": "Content strategy based on brand voice and audience",
      "business": "[User fills in]",
      "timeframe": "30 days",
      "target_audience": "[Output from step 2]",
      "current_channels": "Blog, Social media"
    }
  },
  {
    "step": 4,
    "worker_id": "content-writer",
    "form_settings": {
      "article_card": "pillar",
      "tone": "Match brand voice from step 1",
      "topic": "Based on content strategy",
      "target_audience": "[Output from step 2]"
    }
  }
]'::jsonb
WHERE id = '61bfc04a';

-- ============================================================
-- 2. Weekly Ad Refresh (b53f78ae) [LAUNCH]
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "trend-analyst",
    "form_settings": {
      "trend_mode": "category_trends",
      "focus": "[User fills in]",
      "industry": "[User fills in]",
      "timeframe": "This week",
      "user_context": "Trending ad angles and high-converting formats"
    }
  },
  {
    "step": 2,
    "worker_id": "ecommerce-strategist",
    "form_settings": {
      "deliverable": "Seasonal Campaign",
      "store_platform": "[User fills in]",
      "business_type": "[User fills in]",
      "revenue_stage": "[User fills in]",
      "primary_goal": "Drive ad-driven conversions",
      "product_details": "[Output from previous step]",
      "additional_notes": "[User fills in target customer]",
      "season_details": "Current week trend"
    }
  },
  {
    "step": 3,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "goal": "Drive conversions",
      "tone": "Conversational",
      "topic": "[Output from previous step]",
      "num_posts": "3",
      "content_type": "Thread",
      "niche": "[User fills in]"
    }
  }
]'::jsonb
WHERE id = 'b53f78ae';

-- ============================================================
-- 3. Local Authority Builder (bb4bc4b6) [LAUNCH]
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "content-writer",
    "form_settings": {
      "article_card": "pillar",
      "tone": "Professional",
      "topic": "[User fills in]",
      "target_audience": "[User fills in]"
    }
  },
  {
    "step": 2,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "goal": "Build local authority",
      "tone": "Conversational",
      "topic": "[Output from step 1]",
      "num_posts": "5",
      "content_type": "Thread"
    }
  },
  {
    "step": 3,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "post_type": "Industry Insight",
      "topic": "[Output from step 1]",
      "voice": "Thoughtful operator",
      "audience": "Local business community",
      "include_cta": "Follow for more local business tips"
    }
  }
]'::jsonb
WHERE id = 'bb4bc4b6';

-- ============================================================
-- 4. Weekly Content Engine (e30bb7cc) [LAUNCH]
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "content-writer",
    "form_settings": {
      "article_card": "pillar",
      "tone": "Professional",
      "topic": "[User fills in]",
      "target_audience": "[User fills in]"
    }
  },
  {
    "step": 2,
    "worker_id": "content-repurposer",
    "form_settings": {
      "source_title": "[Output from step 1 title]",
      "platforms": "Twitter, LinkedIn",
      "original_content": "[Output from previous step]",
      "brand_voice": "Professional"
    }
  },
  {
    "step": 3,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "goal": "Engagement",
      "tone": "Conversational",
      "topic": "[User fills in]",
      "num_posts": "5",
      "content_type": "Thread"
    }
  },
  {
    "step": 4,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "post_type": "Industry Insight",
      "topic": "[Output from step 1]",
      "voice": "Thoughtful operator",
      "audience": "[User fills in]",
      "include_cta": "Comment your thoughts"
    }
  }
]'::jsonb
WHERE id = 'e30bb7cc';

-- ============================================================
-- 5. Hiring Pipeline (802c783d) [LAUNCH]
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "job-description-writer",
    "form_settings": {
      "role_type": "tech_role",
      "role_title": "[User fills in]",
      "department": "[User fills in]",
      "company_name_stage": "[User fills in]",
      "work_location": "Remote",
      "hiring_approach": "skills-first",
      "compensation": "[User fills in]",
      "nice_to_have": "",
      "required_skills": "[User fills in]",
      "responsibilities": "[User fills in]"
    }
  },
  {
    "step": 2,
    "worker_id": "interview-question-writer",
    "form_settings": {
      "hiring_mode": "interview_questions",
      "mode": "hiring",
      "role": "[Output from step 1]",
      "skills": "[User fills in]",
      "num_questions": "10",
      "culture_fit": "Collaboration, ownership"
    }
  },
  {
    "step": 3,
    "worker_id": "resume-screener",
    "form_settings": {
      "screening_mode": "single_candidate",
      "resume_content": "[User fills in]",
      "job_title": "[Output from step 1]",
      "nice_to_have": "",
      "required_quals": "[User fills in]"
    }
  }
]'::jsonb
WHERE id = '802c783d';

-- ============================================================
-- 6. Lead Gen + Outreach Pipeline (0a055395) [LAUNCH]
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "lead-generator",
    "form_settings": {
      "lead_mode": "lead_list",
      "location": "United States",
      "job_titles": "[User fills in]",
      "company_size": "[User fills in]",
      "target_industry": "[User fills in]"
    }
  },
  {
    "step": 2,
    "worker_id": "sales-outreach-writer",
    "form_settings": {
      "your_name_company": "[User fills in]",
      "what_selling": "[User fills in]",
      "prospect_role": "[User fills in]",
      "target_industry": "[User fills in]",
      "channel": "Email",
      "sequence_length": "3",
      "tone": "Professional and personalized",
      "value_prop": "[User fills in]"
    }
  },
  {
    "step": 3,
    "worker_id": "email-copywriter",
    "form_settings": {
      "email_type": "nurture",
      "tone": "Conversational",
      "offer_or_context": "[User fills in]",
      "target_audience": "[User fills in]",
      "primary_cta": "[User fills in]"
    }
  }
]'::jsonb
WHERE id = '0a055395';

-- ============================================================
-- 7. Investor Readiness Pipeline (e5c27327) [LAUNCH]
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "competitor-analyst",
    "form_settings": {
      "your_business": "[User fills in]",
      "competitors_to_analyze": "[User fills in]",
      "focus_areas": "Market positioning, funding, traction",
      "your_target_market": "[User fills in]",
      "analysis_goal": "Investor positioning",
      "output_depth": "Standard (~1,500-2,500 words)"
    }
  },
  {
    "step": 2,
    "worker_id": "business-plan-writer",
    "form_settings": {
      "plan_mode": "investor_plan",
      "business_name": "[User fills in]",
      "stage": "Early",
      "description": "[User fills in]",
      "revenue_model": "SaaS subscription",
      "target_market": "[User fills in]"
    }
  },
  {
    "step": 3,
    "worker_id": "pitch-deck-writer",
    "form_settings": {
      "slide_count": "10",
      "company_name": "[User fills in]",
      "one_liner": "[User fills in]",
      "problem": "[Output from previous step]",
      "solution": "[User fills in]",
      "market": "[User fills in]",
      "business_model": "SaaS subscription",
      "traction": "[User fills in]",
      "team": "[User fills in]",
      "funding_ask": "[User fills in]",
      "competitive_advantage": "[User fills in]"
    }
  }
]'::jsonb
WHERE id = 'e5c27327';

-- ============================================================
-- 8. Product Launch Pipeline (eaa2b2a2) [LAUNCH]
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "script-writer",
    "form_settings": {
      "script_mode": "ad_commercial",
      "topic": "[User fills in]",
      "length": "60 seconds",
      "target_audience": "[User fills in]",
      "tone": "Persuasive",
      "key_points": "[User fills in]",
      "cta": "Buy now"
    }
  },
  {
    "step": 2,
    "worker_id": "landing-page-copywriter",
    "form_settings": {
      "page_type": "product_launch",
      "product_or_service": "[Output from step 1]",
      "target_audience": "[User fills in]",
      "core_offer": "[User fills in]",
      "primary_goal": "Buy now"
    }
  },
  {
    "step": 3,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "goal": "Drive conversions",
      "tone": "Excited",
      "topic": "[Output from step 1]",
      "num_posts": "3",
      "content_type": "Thread",
      "niche": "[User fills in]"
    }
  },
  {
    "step": 4,
    "worker_id": "email-copywriter",
    "form_settings": {
      "email_type": "product_announcement",
      "tone": "Excited",
      "offer_or_context": "[Output from step 1]",
      "target_audience": "[User fills in]",
      "primary_cta": "[User fills in]"
    }
  }
]'::jsonb
WHERE id = 'eaa2b2a2';

-- ============================================================
-- 9. Weekly Content Marketing Engine (54fe901c) [LAUNCH]
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "content-strategist",
    "form_settings": {
      "strategy_mode": "full_strategy",
      "goal": "Content calendar for the week",
      "business": "[User fills in]",
      "timeframe": "30 days",
      "target_audience": "[User fills in]",
      "current_channels": "Blog, Social media"
    }
  },
  {
    "step": 2,
    "worker_id": "content-writer",
    "form_settings": {
      "article_card": "pillar",
      "tone": "Professional",
      "topic": "Based on strategy output",
      "target_audience": "[Output from step 1]"
    }
  },
  {
    "step": 3,
    "worker_id": "content-repurposer",
    "form_settings": {
      "source_title": "[Output from step 2 title]",
      "platforms": "Twitter, LinkedIn, Instagram",
      "original_content": "[Output from previous step]",
      "brand_voice": "Professional"
    }
  },
  {
    "step": 4,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "goal": "Engagement",
      "tone": "Conversational",
      "topic": "[User fills in]",
      "num_posts": "5",
      "content_type": "Thread"
    }
  },
  {
    "step": 5,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "post_type": "Industry Insight",
      "topic": "[Output from step 2]",
      "voice": "Thoughtful operator",
      "audience": "[User fills in]",
      "include_cta": "Comment your thoughts"
    }
  }
]'::jsonb
WHERE id = '54fe901c';

-- ============================================================
-- 10. Open House / Event Promo Chain (86bba1b9)
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "landing-page-copywriter",
    "form_settings": {
      "page_type": "services",
      "product_or_service": "[User fills in]",
      "target_audience": "[User fills in]",
      "core_offer": "Open house event",
      "primary_goal": "Drive event registrations"
    }
  },
  {
    "step": 2,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "post_type": "Announcement",
      "topic": "[User fills in]",
      "voice": "Professional but warm",
      "audience": "Local community",
      "include_cta": "Register now — link in bio"
    }
  },
  {
    "step": 3,
    "worker_id": "email-copywriter",
    "form_settings": {
      "email_type": "promotional",
      "tone": "Conversational",
      "offer_or_context": "[User fills in]",
      "target_audience": "[User fills in]",
      "primary_cta": "Register now"
    }
  },
  {
    "step": 4,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "goal": "Drive event attendance",
      "tone": "Conversational",
      "topic": "[User fills in]",
      "num_posts": "5",
      "content_type": "Event promo thread"
    }
  }
]'::jsonb
WHERE id = '86bba1b9';

-- ============================================================
-- 11. SEO Content Machine (71366da2) [LAUNCH]
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "seo-strategist",
    "form_settings": {
      "seo_mode": "keyword_brief",
      "primary_keyword": "[User fills in]",
      "context": "[User fills in]",
      "target_audience": "[User fills in]"
    }
  },
  {
    "step": 2,
    "worker_id": "content-repurposer",
    "form_settings": {
      "source_title": "[Output from step 1 title]",
      "platforms": "Twitter, LinkedIn",
      "original_content": "[Output from previous step]",
      "brand_voice": "Professional"
    }
  },
  {
    "step": 3,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "goal": "Engagement",
      "tone": "Conversational",
      "topic": "[User fills in]",
      "num_posts": "5",
      "content_type": "Thread"
    }
  },
  {
    "step": 4,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "post_type": "Industry Insight",
      "topic": "[Output from step 1]",
      "voice": "Thoughtful operator",
      "audience": "[User fills in]",
      "include_cta": "Comment your thoughts"
    }
  }
]'::jsonb
WHERE id = '71366da2';

-- ============================================================
-- 12. Proposal Factory (843c642d) — RESTRUCTURED to 2 steps
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "audience-persona-builder",
    "form_settings": {
      "persona_depth_mode": "full-set",
      "product_or_service": "[User fills in]",
      "audience_description": "[User fills in]",
      "industry_or_niche": "[User fills in]",
      "persona_purpose": "Proposal targeting",
      "existing_knowledge": ""
    }
  },
  {
    "step": 2,
    "worker_id": "proposal-writer",
    "form_settings": {
      "proposal_mode": "proposal",
      "proposal_stage": "New client (warm referral or inbound)",
      "length_target": "Standard (3-5 pages)",
      "client_name": "[User fills in]",
      "project_or_engagement": "[User fills in]",
      "client_context": "[Output from previous step]",
      "services_or_deliverables": "[User fills in]",
      "timeline": "30 days"
    }
  }
]'::jsonb
WHERE id = '843c642d';

-- ============================================================
-- 13. Onboarding Document Kit (9e5739d3)
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "onboarding-document-creator",
    "form_settings": {
      "company": "[User fills in]",
      "tools": "[User fills in]",
      "department": "[User fills in]",
      "priorities": "[User fills in]",
      "team_structure": "",
      "role": "[User fills in]"
    }
  },
  {
    "step": 2,
    "worker_id": "standard-operating-procedure-writer",
    "form_settings": {
      "sop_format": "step_by_step",
      "process_name": "[User fills in]",
      "purpose": "[User fills in]",
      "scope": "[User fills in]",
      "audience": "[User fills in]",
      "frequency": "On demand",
      "key_steps": "[User fills in]",
      "department": "[User fills in]",
      "tools": "[User fills in]"
    }
  },
  {
    "step": 3,
    "worker_id": "training-material-writer",
    "form_settings": {
      "training_mode": "full_program",
      "learner_role": "[User fills in]",
      "learner_experience_level": "Beginner",
      "learning_objectives": "[User fills in]",
      "training_topic": "[User fills in]",
      "include_checks": "Yes"
    }
  }
]'::jsonb
WHERE id = '9e5739d3';

-- ============================================================
-- 14. Site Audit → Content Loop (bb6c8773) [LAUNCH]
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "site-auditor",
    "form_settings": {
      "audit_mode": "performance_audit",
      "site_url": "[User fills in]"
    }
  },
  {
    "step": 2,
    "worker_id": "content-repurposer",
    "form_settings": {
      "source_title": "Site audit findings",
      "platforms": "Twitter, LinkedIn, Instagram",
      "original_content": "[Output from previous step]",
      "brand_voice": "Professional"
    }
  },
  {
    "step": 3,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "goal": "Engagement",
      "tone": "Conversational",
      "topic": "[User fills in]",
      "num_posts": "5",
      "content_type": "Thread"
    }
  }
]'::jsonb
WHERE id = 'bb6c8773';

-- ============================================================
-- 15. Client Reporting Chain (3520b37b)
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "report-writer",
    "form_settings": {
      "report_mode": "business_review",
      "report_title": "[User fills in]",
      "audience": "Executive team",
      "key_findings": "[Output from previous step]"
    }
  },
  {
    "step": 2,
    "worker_id": "kpi-dashboard-writer",
    "form_settings": {
      "business_type": "SaaS",
      "business_description": "[User fills in]",
      "primary_goal": "Revenue, leads, content performance",
      "stage": "Growth",
      "tools": "Google Analytics, HubSpot",
      "function": "Marketing"
    }
  }
]'::jsonb
WHERE id = '3520b37b';

-- ============================================================
-- 16. Customer Review → Content Loop (cc478b15) [LAUNCH]
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "customer-support-writer",
    "form_settings": {
      "product_name": "[User fills in]",
      "product_description": "[User fills in]",
      "content_type": "review_response",
      "common_issues": "[User pastes reviews]",
      "brand_tone": "Grateful and professional",
      "primary_channel": "Public review platform",
      "customer_state": "Mixed feedback",
      "num_templates": "3"
    }
  },
  {
    "step": 2,
    "worker_id": "content-repurposer",
    "form_settings": {
      "source_title": "Customer review responses",
      "platforms": "Twitter, LinkedIn, Instagram",
      "original_content": "[Output from previous step]",
      "brand_voice": "Grateful and professional"
    }
  },
  {
    "step": 3,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "goal": "Build social proof",
      "tone": "Conversational",
      "topic": "[Output from step 1]",
      "num_posts": "3",
      "content_type": "Social proof posts"
    }
  }
]'::jsonb
WHERE id = 'cc478b15';

-- ============================================================
-- 17. Product Positioning Sprint (1eb61080)
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "market-research-analyst",
    "form_settings": {
      "purpose": "Internal strategy / market entry",
      "market": "[User fills in]",
      "product_angle": "[User fills in]",
      "geography": "United States",
      "questions": "[User fills in]"
    }
  },
  {
    "step": 2,
    "worker_id": "audience-persona-builder",
    "form_settings": {
      "persona_depth_mode": "full-set",
      "product_or_service": "[User fills in]",
      "audience_description": "[User fills in]",
      "industry_or_niche": "[User fills in]",
      "persona_purpose": "Product positioning",
      "existing_knowledge": ""
    }
  },
  {
    "step": 3,
    "worker_id": "brand-strategist",
    "form_settings": {
      "strategy_mode": "positioning",
      "brand_name": "[User fills in]",
      "what_you_do": "[User fills in]",
      "industry_or_category": "[User fills in]",
      "target_customer": "[User fills in]",
      "brand_stage": "[User fills in]",
      "top_competitors": "[User fills in]",
      "brand_personality": "Professional"
    }
  },
  {
    "step": 4,
    "worker_id": "ad-copywriter",
    "form_settings": {
      "platform": "Multiple",
      "product": "[Output from step 3]",
      "target_audience": "[User fills in]",
      "funnel_stage": "Top of funnel",
      "goal": "Drive awareness",
      "tone": "Direct and confident",
      "num_variations": "3"
    }
  }
]'::jsonb
WHERE id = '1eb61080';

-- ============================================================
-- 18. Newsletter + Social Combo (9b9fb28a) [LAUNCH]
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "newsletter-writer",
    "form_settings": {
      "newsletter_style": "classic_founder",
      "newsletter_topic": "[User fills in]",
      "target_audience": "[User fills in]",
      "newsletter_length": "Medium (600-900 words)",
      "core_takeaway": "[User fills in]",
      "tone": "Conversational"
    }
  },
  {
    "step": 2,
    "worker_id": "content-repurposer",
    "form_settings": {
      "source_title": "[Output from step 1 title]",
      "platforms": "Twitter, LinkedIn, Instagram",
      "original_content": "[Output from previous step]",
      "brand_voice": "Conversational"
    }
  },
  {
    "step": 3,
    "worker_id": "x-twitter-ghostwriter",
    "form_settings": {
      "goal": "Engagement",
      "tone": "Conversational",
      "topic": "[Output from step 1]",
      "num_posts": "5",
      "content_type": "Thread"
    }
  },
  {
    "step": 4,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "post_type": "Industry Insight",
      "topic": "[Output from step 1]",
      "voice": "Thoughtful operator",
      "audience": "[User fills in]",
      "include_cta": "Share if you found this useful"
    }
  }
]'::jsonb
WHERE id = '9b9fb28a';

-- ============================================================
-- 19. Course Launch Content Sprint (86e98a53) [LAUNCH]
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "content-strategist",
    "form_settings": {
      "strategy_mode": "full_strategy",
      "goal": "[User fills in]",
      "business": "[User fills in]",
      "timeframe": "4 weeks",
      "target_audience": "[User fills in]",
      "current_channels": "Blog, Social media"
    }
  },
  {
    "step": 2,
    "worker_id": "content-writer",
    "form_settings": {
      "article_card": "pillar",
      "tone": "Professional",
      "topic": "Based on strategy output",
      "target_audience": "[Output from step 1]"
    }
  },
  {
    "step": 3,
    "worker_id": "email-copywriter",
    "form_settings": {
      "email_type": "promotional",
      "tone": "Conversational",
      "offer_or_context": "[User fills in]",
      "target_audience": "[User fills in]",
      "primary_cta": "[User fills in]"
    }
  },
  {
    "step": 4,
    "worker_id": "landing-page-copywriter",
    "form_settings": {
      "page_type": "lead_magnet",
      "product_or_service": "[User fills in]",
      "target_audience": "[User fills in]",
      "core_offer": "Course launch",
      "primary_goal": "Drive course signups"
    }
  }
]'::jsonb
WHERE id = '86e98a53';

-- ============================================================
-- 20. Competitive Intel + Pricing (fb7ba3a9)
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "competitor-analyst",
    "form_settings": {
      "your_business": "[User fills in]",
      "competitors_to_analyze": "[User fills in]",
      "focus_areas": "Pricing, positioning, features",
      "your_target_market": "[User fills in]",
      "analysis_goal": "Pricing strategy input",
      "output_depth": "Standard (~1,500-2,500 words)"
    }
  },
  {
    "step": 2,
    "worker_id": "pricing-strategist",
    "form_settings": {
      "pricing_goal": "Optimize SaaS pricing",
      "product": "[Output from step 1]",
      "target_customers": "[User fills in]",
      "business_model": "SaaS subscription",
      "competitor_pricing": "[Output from step 1]"
    }
  },
  {
    "step": 3,
    "worker_id": "ad-campaign-strategist",
    "form_settings": {
      "campaign_mode": "full-blueprint",
      "platform": "Meta (Facebook/Instagram), Google Search",
      "product_or_offer": "[Output from step 1]",
      "target_audience": "[User fills in]",
      "campaign_goal": "Drive conversions",
      "budget_range": "3000"
    }
  }
]'::jsonb
WHERE id = 'fb7ba3a9';

-- ============================================================
-- 21. Thought Leadership Engine (818aa017)
-- ============================================================
UPDATE agent_mode_presets
SET workers = '[
  {
    "step": 1,
    "worker_id": "seo-strategist",
    "form_settings": {
      "seo_mode": "keyword_brief",
      "primary_keyword": "[User fills in]",
      "context": "[User fills in]",
      "target_audience": "[User fills in]"
    }
  },
  {
    "step": 2,
    "worker_id": "linkedin-ghostwriter",
    "form_settings": {
      "post_type": "Industry Insight",
      "topic": "[Output from previous step]",
      "voice": "Thoughtful operator",
      "audience": "[User fills in]",
      "include_cta": "Comment below"
    }
  },
  {
    "step": 3,
    "worker_id": "newsletter-writer",
    "form_settings": {
      "newsletter_style": "stratechery",
      "newsletter_topic": "[Output from step 1]",
      "target_audience": "[User fills in]",
      "newsletter_length": "Medium (600-900 words)",
      "core_takeaway": "[User fills in]",
      "tone": "Professional thought leadership"
    }
  }
]'::jsonb
WHERE id = '818aa017';

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT id, name, jsonb_array_length(workers) as step_count
FROM agent_mode_presets
WHERE is_active = true
ORDER BY sort_order;
-- Expected: 21 rows, each with the correct number of steps.
