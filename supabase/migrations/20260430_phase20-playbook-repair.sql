-- Phase 20: Full playbook form_settings repair — all 73 validator issues
-- Full workers array replacement per preset (safer than surgical jsonb_set).
-- Approved by JR 2026-04-30. Applied atomically (single transaction).
-- Site Audit → Content Loop is already clean — no update needed.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Brand Voice + Content Foundation (27301d9f)
--    brand-strategist step 1: company→brand_name, industry→industry_or_category
--    brand-strategist step 2: drop goal (context flows from prior output)
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"brand-strategist","form_settings":{"strategy_mode":"positioning","brand_name":"[User fills in]","industry_or_category":"[User fills in]"}},
  {"position":2,"worker_id":"brand-strategist","form_settings":{"strategy_mode":"positioning"}},
  {"position":3,"worker_id":"content-strategist","form_settings":{"strategy_mode":"quick_brief","goal":"Content strategy based on brand direction"}},
  {"position":4,"worker_id":"content-writer","form_settings":{"article_card":"blog_post","topic":"Based on content strategy"}}
]'::jsonb
WHERE id = '27301d9f-f8b2-452a-8eab-b4b9991ae549';

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Client Reporting Chain (a5e48114)
--    report-writer: client→audience, report_type→report_title
--    kpi-dashboard-writer: kpis→metrics_tracked, period→reporting_cadence
--    case-study-writer: focus→problem_before
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"report-writer","form_settings":{"report_mode":"business_review","audience":"[User fills in]","report_title":"Monthly performance summary"}},
  {"position":2,"worker_id":"kpi-dashboard-writer","form_settings":{"metrics_tracked":"[User fills in]","reporting_cadence":"Monthly"}},
  {"position":3,"worker_id":"case-study-writer","form_settings":{"case_study_mode":"standard_case_study","problem_before":"Results and ROI"}}
]'::jsonb
WHERE id = 'a5e48114-5ac5-484f-9c35-437e135b20c8';

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Competitive Intel + Pricing (d1b54084)
--    competitor-analyst: competitors→competitors_to_analyze, focus→focus_areas
--    pricing-strategist: goal→pricing_goal
--    ad-campaign-strategist: campaign_type→campaign_goal
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"competitor-analyst","form_settings":{"focus_areas":"Pricing, messaging, offers","competitors_to_analyze":"[User fills in]"}},
  {"position":2,"worker_id":"pricing-strategist","form_settings":{"pricing_mode":"quick_pricing","pricing_goal":"Competitive pricing analysis"}},
  {"position":3,"worker_id":"ad-campaign-strategist","form_settings":{"campaign_mode":"quick-angle","campaign_goal":"Competitive response"}}
]'::jsonb
WHERE id = 'd1b54084-4cb8-4622-a084-9ac1a36ca312';

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Course Launch Content Sprint (ddc4c894)
--    email-copywriter: drop emails, "Launch sequence"→"promotional"
--    landing-page-copywriter: "Sales page"→"product_launch"
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"content-strategist","form_settings":{"strategy_mode":"quick_brief","goal":"[User fills in]","timeframe":"4 weeks"}},
  {"position":2,"worker_id":"content-writer","form_settings":{"article_card":"blog_post","topic":"Based on strategy output"}},
  {"position":3,"worker_id":"email-copywriter","form_settings":{"email_type":"promotional"}},
  {"position":4,"worker_id":"landing-page-copywriter","form_settings":{"page_type":"product_launch"}}
]'::jsonb
WHERE id = 'ddc4c894-6de8-4fa5-9abe-3343170d4db3';

-- ═══════════════════════════════════════════════════════════════════════
-- 5. Customer Review → Content Loop (42282b5f)
--    step 1: site-auditor (dead fields) → customer-support-writer
--    step 2: content-repurposer: drop format, add platforms + source context
--    step 3: x-twitter-ghostwriter: posts→content_type, style→tone
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"customer-support-writer","form_settings":{"product_name":"[User fills in]","content_type":"Complaint Responses","brand_tone":"Empathetic","common_issues":"[User fills in — paste review text here]"}},
  {"position":2,"worker_id":"content-repurposer","form_settings":{"platforms":"X/Twitter, LinkedIn","original_content":"[Output from previous step]","source_title":"Customer review response"}},
  {"position":3,"worker_id":"x-twitter-ghostwriter","form_settings":{"content_type":"Content batch","tone":"Social proof / testimonial"}}
]'::jsonb
WHERE id = '42282b5f-565e-42d8-ac40-24a3da3fd90f';

-- ═══════════════════════════════════════════════════════════════════════
-- 6. Hiring Pipeline (799f8e70)
--    job-description-writer: role→role_title (department valid, keep)
--    interview-question-writer: question_count→num_questions (role valid, keep)
--    resume-screener: criteria→required_quals
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"job-description-writer","form_settings":{"role_type":"tech_role","role_title":"[User fills in]","department":"[User fills in]"}},
  {"position":2,"worker_id":"interview-question-writer","form_settings":{"hiring_mode":"interview_questions","role":"Based on job description","num_questions":"10"}},
  {"position":3,"worker_id":"resume-screener","form_settings":{"screening_mode":"single_candidate","required_quals":"Based on job description"}}
]'::jsonb
WHERE id = '799f8e70-cc5e-447d-95e0-ebe32e222f1b';

-- ═══════════════════════════════════════════════════════════════════════
-- 7. Investor Readiness Pipeline (203a79c5)
--    competitor-analyst: competitors→competitors_to_analyze, focus→focus_areas
--    business-plan-writer: company→company_name (stage valid, keep)
--    pitch-deck-writer: audience→audience_sophistication, deck_length→slide_count
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"competitor-analyst","form_settings":{"focus_areas":"Market positioning, funding, traction","competitors_to_analyze":"[User fills in]"}},
  {"position":2,"worker_id":"business-plan-writer","form_settings":{"plan_mode":"executive_summary","stage":"[User fills in]","company_name":"[User fills in]"}},
  {"position":3,"worker_id":"pitch-deck-writer","form_settings":{"audience_sophistication":"Institutional VCs / professional investors","slide_count":"10"}}
]'::jsonb
WHERE id = '203a79c5-921d-4bb2-913d-ad3b37d86eff';

-- ═══════════════════════════════════════════════════════════════════════
-- 8. Lead Gen + Outreach Pipeline (b4721eb3)
--    lead-generator: industry→target_industry, drop num_leads (count fixed internally)
--    sales-outreach-writer: drop template_count (tone valid, keep)
--    email-copywriter: drop emails, "Follow-up sequence"→"nurture"
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"lead-generator","form_settings":{"lead_mode":"lead_list","target_industry":"[User fills in]","location":"[User fills in]"}},
  {"position":2,"worker_id":"sales-outreach-writer","form_settings":{"outreach_mode":"single_email","tone":"Professional and personalized"}},
  {"position":3,"worker_id":"email-copywriter","form_settings":{"email_type":"nurture"}}
]'::jsonb
WHERE id = 'b4721eb3-1d15-44aa-9199-e48bf0845f53';

-- ═══════════════════════════════════════════════════════════════════════
-- 9. Local Authority Builder (a3ec9644)
--    linkedin-ghostwriter: goal+tone (both invalid) → post_type: "Personal Story"
--    (x-twitter + newsletter already fixed in prior partial migration)
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"content-writer","form_settings":{"article_card":"blog_post","tone":"Friendly, community-focused","topic":"[User fills in - local topic]"}},
  {"position":2,"worker_id":"x-twitter-ghostwriter","form_settings":{"content_type":"Content batch","tone":"Local business / community voice"}},
  {"position":3,"worker_id":"linkedin-ghostwriter","form_settings":{"post_type":"Personal Story"}},
  {"position":4,"worker_id":"newsletter-writer","form_settings":{"newsletter_style":"classic_founder","newsletter_topic":"Based on blog post"}}
]'::jsonb
WHERE id = 'a3ec9644-c633-477b-870d-2f4c65bb9fbf';

-- ═══════════════════════════════════════════════════════════════════════
-- 10. Newsletter + Social Combo (8d678d4d)
--     content-repurposer: drop format, add platforms
--     linkedin-ghostwriter: post_type "Single post" (invalid value) → "Personal Story"
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"newsletter-writer","form_settings":{"newsletter_style":"classic_founder","tone":"Friendly and informative","newsletter_topic":"[User fills in]","newsletter_length":"standard"}},
  {"position":2,"worker_id":"content-repurposer","form_settings":{"platforms":"X/Twitter, LinkedIn"}},
  {"position":3,"worker_id":"x-twitter-ghostwriter","form_settings":{"content_type":"Content batch"}},
  {"position":4,"worker_id":"linkedin-ghostwriter","form_settings":{"post_type":"Personal Story"}}
]'::jsonb
WHERE id = '8d678d4d-de06-4176-ac03-3c3a1d8a913c';

-- ═══════════════════════════════════════════════════════════════════════
-- 11. Onboarding Document Kit (3b70fdf4)
--     sop-writer: process→process_name
--     training-material-writer: training_focus→training_topic
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"onboarding-document-creator","form_settings":{"role":"[User fills in]","company":"[User fills in]"}},
  {"position":2,"worker_id":"standard-operating-procedure-writer","form_settings":{"sop_format":"step_by_step","process_name":"Based on onboarding outline"}},
  {"position":3,"worker_id":"training-material-writer","form_settings":{"training_mode":"step_by_step","training_topic":"Based on role requirements"}}
]'::jsonb
WHERE id = '3b70fdf4-4a7e-46a6-8271-4d055f6acb10';

-- ═══════════════════════════════════════════════════════════════════════
-- 12. Open House / Event Promo Chain (1254f7fb)
--     landing-page-copywriter: drop event, "Event registration"→"webinar"
--     ad-copywriter: ad_count→num_variations
--     email-copywriter: "Event invitation"→"promotional"
--     x-twitter-ghostwriter: posts→content_type, style→tone
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"landing-page-copywriter","form_settings":{"product_or_service":"[User fills in - event name and details]","page_type":"webinar"}},
  {"position":2,"worker_id":"ad-copywriter","form_settings":{"num_variations":"3","platform":"Meta Ads (Facebook + Instagram)"}},
  {"position":3,"worker_id":"email-copywriter","form_settings":{"email_type":"promotional"}},
  {"position":4,"worker_id":"x-twitter-ghostwriter","form_settings":{"content_type":"Content batch","tone":"Event promotion"}}
]'::jsonb
WHERE id = '1254f7fb-2ca4-4dcf-83d1-8c6ee6a50b9c';

-- ═══════════════════════════════════════════════════════════════════════
-- 13. Product Launch Pipeline (6c32f571)
--     product-description-writer: product→product_name, style→tone
--     landing-page-copywriter: "Product landing page"→"product_launch"
--     ad-copywriter: ad_count→num_variations
--     email-copywriter: "Product announcement" (space) → "product_announcement" (underscore)
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"product-description-writer","form_settings":{"product_name":"[User fills in]","tone":"Benefit-driven"}},
  {"position":2,"worker_id":"landing-page-copywriter","form_settings":{"page_type":"product_launch"}},
  {"position":3,"worker_id":"ad-copywriter","form_settings":{"num_variations":"3","platform":"Meta Ads (Facebook + Instagram)"}},
  {"position":4,"worker_id":"email-copywriter","form_settings":{"email_type":"product_announcement"}}
]'::jsonb
WHERE id = '6c32f571-d8c4-4c20-95a1-66f3d678c399';

-- ═══════════════════════════════════════════════════════════════════════
-- 14. Product Positioning Sprint (1e024ea2)
--     market-research-analyst: industry→market, research_focus→purpose
--     audience-persona-builder: product→product_or_service
--     brand-strategist step 3: drop goal (empty, flows from context)
--     brand-strategist step 4: brand→brand_name, drop count
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"market-research-analyst","form_settings":{"market":"[User fills in]","purpose":"Market landscape and competitors"}},
  {"position":2,"worker_id":"audience-persona-builder","form_settings":{"persona_depth_mode":"full-set","product_or_service":"[User fills in]"}},
  {"position":3,"worker_id":"brand-strategist","form_settings":{"strategy_mode":"positioning"}},
  {"position":4,"worker_id":"brand-strategist","form_settings":{"strategy_mode":"positioning","brand_name":"Based on strategy output"}}
]'::jsonb
WHERE id = '1e024ea2-86f4-4689-adc4-70ca8fbd106c';

-- ═══════════════════════════════════════════════════════════════════════
-- 15. Proposal Factory (3bf38109)
--     audience-persona-builder: client_industry→industry_or_niche
--     proposal-writer step 2: drop budget_range, proposal_type→proposal_stage: "draft"
--     proposal-writer step 3: drop style (context flows from prior step)
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"audience-persona-builder","form_settings":{"persona_depth_mode":"full-set","industry_or_niche":"[User fills in]"}},
  {"position":2,"worker_id":"proposal-writer","form_settings":{"proposal_mode":"proposal","proposal_stage":"draft"}},
  {"position":3,"worker_id":"proposal-writer","form_settings":{"proposal_mode":"proposal"}}
]'::jsonb
WHERE id = '3bf38109-60bd-4cd8-85f7-29fb55f5c95d';

-- ═══════════════════════════════════════════════════════════════════════
-- 16. SEO Content Machine (a98d1435)
--     content-repurposer: drop format (platforms already valid, keep)
--     linkedin-ghostwriter: goal+tone (invalid) → post_type: "Industry Insight"
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"seo-strategist","form_settings":{"seo_mode":"keyword_angle","intent_override":"Informational","primary_keyword":"[User fills in]"}},
  {"position":2,"worker_id":"content-repurposer","form_settings":{"platforms":"X/Twitter, LinkedIn"}},
  {"position":3,"worker_id":"x-twitter-ghostwriter","form_settings":{"content_type":"Content batch","tone":"Engaging, conversational"}},
  {"position":4,"worker_id":"linkedin-ghostwriter","form_settings":{"post_type":"Industry Insight"}}
]'::jsonb
WHERE id = 'a98d1435-d8aa-4868-aa56-a11b21049413';

-- ═══════════════════════════════════════════════════════════════════════
-- 17. Thought Leadership Engine (99679137)
--     linkedin-ghostwriter: goal+tone (invalid) → post_type: "Framework / Breakdown"
--     press-release-writer (DEAD) → whitepaper-writer + document_type: "press_release"
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"seo-strategist","form_settings":{"seo_mode":"keyword_angle","primary_keyword":"[User fills in]"}},
  {"position":2,"worker_id":"linkedin-ghostwriter","form_settings":{"post_type":"Framework / Breakdown"}},
  {"position":3,"worker_id":"whitepaper-writer","form_settings":{"document_type":"press_release"}}
]'::jsonb
WHERE id = '99679137-6574-4017-9821-b220689f4797';

-- ═══════════════════════════════════════════════════════════════════════
-- 18. Weekly Ad Refresh (cd680262)
--     ecommerce-strategist: goal→primary_goal
--     ad-copywriter: ad_count→num_variations
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"trend-analyst","form_settings":{"trend_mode":"quick_scan","focus":"Consumer trends","industry":"[User fills in]"}},
  {"position":2,"worker_id":"ecommerce-strategist","form_settings":{"deliverable":"Store Audit","primary_goal":"Ad campaign optimization"}},
  {"position":3,"worker_id":"ad-copywriter","form_settings":{"num_variations":"3","platform":"Meta Ads (Facebook + Instagram)"}}
]'::jsonb
WHERE id = 'cd680262-951b-4d21-b8d1-0629868e0f2b';

-- ═══════════════════════════════════════════════════════════════════════
-- 19. Weekly Content Engine (e8fdd86a)
--     content-repurposer: drop format (platforms valid, keep)
--     linkedin-ghostwriter: goal+tone (invalid) → post_type: "Framework / Breakdown"
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"content-writer","form_settings":{"article_card":"blog_post","tone":"Professional","topic":"[User fills in]"}},
  {"position":2,"worker_id":"content-repurposer","form_settings":{"platforms":"X/Twitter, LinkedIn"}},
  {"position":3,"worker_id":"x-twitter-ghostwriter","form_settings":{"content_type":"Content batch","tone":"Engaging, conversational"}},
  {"position":4,"worker_id":"linkedin-ghostwriter","form_settings":{"post_type":"Framework / Breakdown"}}
]'::jsonb
WHERE id = 'e8fdd86a-f79d-40c1-8a23-a1ef1514cad0';

-- ═══════════════════════════════════════════════════════════════════════
-- 20. Weekly Content Marketing Engine (395cde3c)
--     content-repurposer: drop format, add platforms
--     linkedin-ghostwriter: post_type "Single post" (invalid) → "Framework / Breakdown"
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets SET workers = '[
  {"position":1,"worker_id":"content-strategist","form_settings":{"strategy_mode":"quick_brief","goal":"Content calendar for the week","business":"[User fills in]"}},
  {"position":2,"worker_id":"content-writer","form_settings":{"article_card":"blog_post","topic":"Based on strategy output"}},
  {"position":3,"worker_id":"content-repurposer","form_settings":{"platforms":"X/Twitter, LinkedIn"}},
  {"position":4,"worker_id":"x-twitter-ghostwriter","form_settings":{"content_type":"Content batch"}},
  {"position":5,"worker_id":"linkedin-ghostwriter","form_settings":{"post_type":"Framework / Breakdown"}}
]'::jsonb
WHERE id = '395cde3c-1107-49fd-b950-30e2de886b5a';

-- ═══════════════════════════════════════════════════════════════════════
-- 21. Playbook card cost metadata repair
--     Align displayed card costs with runtime worker billing.
-- ═══════════════════════════════════════════════════════════════════════
UPDATE agent_mode_presets
SET heavy_credits_per_run = 2, light_tasks_per_run = 1
WHERE name = 'Brand Voice + Content Foundation';

UPDATE agent_mode_presets
SET heavy_credits_per_run = 0, light_tasks_per_run = 4
WHERE name = 'Local Authority Builder';

UPDATE agent_mode_presets
SET heavy_credits_per_run = 0, light_tasks_per_run = 2
WHERE name = 'Proposal Factory';

UPDATE agent_mode_presets
SET heavy_credits_per_run = 3, light_tasks_per_run = 1
WHERE name = 'Product Positioning Sprint';

UPDATE agent_mode_presets
SET heavy_credits_per_run = 0, light_tasks_per_run = 3
WHERE name = 'Client Reporting Chain';

UPDATE agent_mode_presets
SET heavy_credits_per_run = 2, light_tasks_per_run = 1
WHERE name = 'Thought Leadership Engine';

COMMIT;
