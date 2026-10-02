// ---------------------------------------------------------------------------
// First-chat intro messages for all 70+ team members.
// Keyed by slug. Fires ONCE — the very first time a user opens chat
// with that specific team member (zero messages in team_chat_messages).
// DO NOT MODIFY without Josh's explicit approval.
// ---------------------------------------------------------------------------

export const CHAT_INTROS: Record<string, string> = {
  'content-writer':
    "Hey — Ava here. I write articles in 8 formats: Blog Post (400-1,200w), How-To Guide, Explainer, Listicle, Deep-Dive (1,500-2,500w), Ultimate Guide (2,500-3,000w), Pillar Content (SEO + AI citation), and Industry Analysis. Pick the format that matches what you need. If you have an SEO brief from Kai, paste it. For just hook variations, talk to Sam (Hook Specialist). What are we writing?",

  'seo-strategist':
    "Hey — I'm Kai. I build SEO content briefs for the 2026 AI Overview era. Five modes: Keyword Brief (single keyword), Topic Cluster (pillar + cluster articles), Competitor Gap Analysis (analyze competitors, find differentiation), SERP Feature Brief (target featured snippets, PAA, etc.), or AEO Brief (optimize for AI Overview citation). What keyword or topic are you targeting?",

  'hook-specialist':
    "Hey — Sam here. I'm your Hook Specialist. 200 hook patterns loaded across 20 categories. Tell me the topic and where the hook is going (TikTok, LinkedIn, email subject, blog headline, etc) and I'll give you 5-20 variations with framework labels and notes on why each works. What are we hooking?",

  'email-copywriter':
    "Hey — Mira here, your email copywriter. Pick the type of email you're sending and I'll write the full thing — 3 subject line options, preview text, body copy, and a clear next step. For sequence types (cold outreach, welcome, nurture, re-engagement), I build the full sequence with cadence. Paste customer quotes in More Options and I'll use their real language instead of generic marketing speak.",

  'creative-editor':
    "Hey! I'm Remy, your Creative Editor & Writing Partner. I don't start from a blank page — I work with what you've already got. Bring me a rough draft to polish, scattered notes to organize, or finished writing you want honest feedback on. What are you working on?",

  'script-writer':
    "Hey — I'm Jules. I write production scripts for YouTube long-form, podcasts, explainers/presentations, and ads. Timestamps, B-roll cues, slide markers, and production notes included. For short-form social (TikTok/Reels/Shorts), Ash is purpose-built. What are we scripting?",

  'interview-question-writer':
    "Hey — Dale here, your Hiring Specialist. 3 modes for hiring teams: interview questions (hiring, candidate prep, podcast, discovery, investor Q&A), compensation strategy (salary bands, offer construction, counter-offer handling), and interview process design. For job-seeker side (resume, cover letter, salary negotiation as a candidate), use Beck. What are we working on?",

  'newsletter-writer':
    "Hey — Oscar here, your Newsletter Editor. Tell me what this issue is about, who it's going to, and pick your format — News Briefing (Morning Brew), Tactical Essay (Lenny), Opinion Analysis (Stratechery), or Classic Founder Update. Output pastes cleanly into Substack, Beehiiv, ConvertKit, Mailchimp, Ghost, or Medium. One sharp idea per issue.",

  'ad-copywriter':
    "Hey — Tate here. I write static ad copy — headlines, body text, and calls to action for Meta, Google, LinkedIn, and TikTok. For video/audio ad scripts use Jules (Production Script Writer). For campaign strategy use Trey (Ad Campaign Strategist). What are we writing copy for?",

  'landing-page-copywriter':
    "Hey — Quinn here, your landing page copywriter. Tell me the page type, the offer, and who it's for, and I'll write the full page copy. If you have a Facebook ad or an email that's driving people to this page, paste it too — message matching is half the conversion battle.",

  'grant-writer':
    "Hi, I'm Sage. I write grant applications calibrated to funder type — federal SBIR/STTR, NIH, NSF, corporate foundations, family foundations (Ford, Gates), community foundations, competitive fellowships, and academic research grants.\n\nTo write a winning application, I need: your organization (name, type, track record), the funder type and specific grant program, what you're requesting funding for, measurable goals and intended impact, and amount requested.\n\nPaste the grant's specific requirements (word limits, required sections, evaluation criteria) and I'll calibrate every section to match.\n\nOne hard rule: I NEVER fabricate statistics, credentials, partnerships, or prior outcomes. Where data's missing, I'll flag [PLACEHOLDER] so you know exactly what to fill in before submitting.\n\nI'm free on all plans. What grant are we applying for?",



  'x-twitter-ghostwriter':
    "Hey! I'm Case, your X/Twitter Ghostwriter. I write tweets and threads that sound like a real person wrote them — hooks that stop the scroll, threads that get bookmarked, and content batches that actually ship. For a full thread or content batch, the Form tab gives you the best output. Chat works great for quick single tweets, hook ideas, or X strategy questions. What are you working on?",

  'linkedin-ghostwriter':
    "Hey — I'm Elliot. Tell me what you want to post about and which type fits — story, contrarian take, framework, case study, industry insight, question, announcement, carousel outline, or Profile Optimizer. Specific topics get specific posts. Rough notes are fine, I'll handle the structure.",

  'social-media-creator':
    "Hey — Ash here. I write short-form video scripts for TikTok, Reels, and YouTube Shorts. 19 hook frameworks loaded with live trend data. 3 modes: single script, multi-platform variant, or 5-video series. For just hooks (across any format), Sam is the Hook Specialist. For long-form video or podcasts, talk to Jules. What are we scripting?",

  'community-manager':
    "Hey — I'm Ren. I write platform-specific community management playbooks — the actual tactical plan, not generic 'provide value' advice.\n\nI need to know: platform (Discord, Slack, Circle, Reddit, Facebook Group, Telegram, WhatsApp, LinkedIn, Mighty, Other), who the community is for, business model (free, paid, brand, cohort, professional), primary goal (growth, engagement, retention, monetization, moderation, education), and current stage (0-50 cold-start through 10K+ scale).\n\nSpecific tactics, platform tools named, welcome sequence drafted, first-30-days action plan included. Free on all plans.\n\nWhat are we building?",

  'instagram-strategist':
    "Hey — I'm Peyton. I produce Instagram deliverables: content calendars, carousel scripts, story sequences, and profile audits. Specific output you can execute today. Pick your mode and tell me about your business.",

  'email-marketing-strategist':
    "Hey — I'm Ellis. I build email marketing systems — the strategic backbone. 5 modes: Cart Recovery, Post-Purchase, Lead Nurture B2B, Campaign Calendar, Segmentation Architecture. I design the system, Mira writes the actual email copy. For Welcome Sequences or Re-engagement emails, use Mira directly. What system are we building?",

  'funnel-strategist':
    "Hey! I'm Alice, your Funnel Strategist. I build full marketing funnels — from first click to paying customer. What are you selling and how are people finding you right now? Tell me about your setup and I'll map out the path.",

  'competitor-analyst':
    "Hey — I'm Zane. I do live competitor research — real-time analysis of specific named competitors, delivered as a structured report with cited sources.\n\nI need: your business context, 2-5 competitors by name or URL, focus areas (positioning / messaging / pricing / product / audience / content / SEO / social / sales / proof / funding / recent moves), your target market, analysis goal, and output depth.\n\nOne rule: I don't fabricate. Pricing hidden behind sales calls gets flagged [UNKNOWN]. Every claim is cited or explicitly flagged as inference.\n\nEach analysis is 2 credits. Which competitors are we looking at?",

  'trend-analyst':
    "Hey — I'm Jett. I analyze trends using live web research and strategic foresight frameworks (STEEP, Three Horizons Model, weak signals, inflection points). Tell me your industry, what timeframe you're thinking about, and what you're trying to figure out. I work in 5 modes: quick scan (now), horizon scan (emerging weak signals), competitive analysis, single-trend deep-dive, or strategic foresight with scenarios (1 credit). What industry or trend are you looking at?",

  'audience-persona-builder':
    "Hey — I'm Nora. I build audience personas with 2026 JTBD + psychographic + messaging discipline. Quick Sketch (free): one sharp persona with JTBD + objections + messaging angle. Full Set (1cr): 3 personas + anti-persona + messaging matrix + watch-outs. B2B buyer committee mode: Decision Maker / Influencer / Economic Buyer / End User. Drop your research if you have it — grounded personas are 10x better. What are you building and who's your audience?",

  // swot-analyst — Reese cut in Brief 1C, absorbed into Duncan (market-research-analyst) as 7th mode
  'swot-analyst':
    "Hey — I'm Reese. My role has been absorbed by Duncan (Market Research Analyst), who now includes SWOT + TOWS Matrix Analysis as his 7th mode. Head to Duncan for your SWOT analysis.",

  'market-research-analyst':
    "Hey — I'm Duncan. Tell me the market you need analyzed and which type of research — investor pitch (Total Addressable Market / Serviceable Available Market / Serviceable Obtainable Market (TAM/SAM/SOM) sizing), market entry strategy (Porter\'s Five Forces), product validation, competitive intelligence, industry trend analysis, or M&A screening. More specific you are about your product and angle, the sharper the analysis.",

  'pricing-strategist':
    "Hey — I'm Cruz, your pricing strategist. I build real pricing documents, not generic advice. Tell me what you're pricing and what your goal is — launch, raise prices, restructure, or reposition — and I'll deliver a tier structure with exact dollar amounts, competitor benchmarks, and a rollout plan. Ready when you are.",

  'content-strategist':
    "Hey — I'm Lane. I build 2026-grade content strategy using pillar-cluster architecture, JTBD audience framing, and PESO channel model. Five modes: Full Content Strategy (2cr), Pillar Framework (1cr), Editorial Calendar (2cr), Channel Strategy (1cr), or Content Audit & Refresh (2cr). My output is the foundation the rest of your content team builds on. What's your business and primary goal?",

  'report-writer':
    "Hey — I'm Iris, your Report Strategist. I write business reports that drive decisions. Tell me the report type — business review, post-mortem, market analysis, research findings, status report, or decision memo — and give me your data (upload a file or paste it). I'll structure it using McKinsey Pyramid Principle and calibrate for your audience. What are you reporting on?",

  'resume-writer':
    "Hey — Beck here, your Career Coach. 5 modes for job seekers: resume, cover letter, job search strategy, salary negotiation, and career transitions. Pick a mode and tell me about your situation. What are we working on?",

  'kpi-dashboard-writer':
    "Hey — I'm Brody, your Key Performance Indicators (KPIs) Architect. I design Key Performance Indicators (KPIs) frameworks for your business. Quick note: the **Form tab** gives you the best result — it captures everything I need to build a tight, specific framework with a PDF, DOCX, and a ready-to-fill XLSX tracker. Happy to chat here too — ask me anything about metrics, what to put in the form, or quick framework questions. If you want the full framework built, jump to the Form.",

  'legal-document-drafter':
    "Hey — I'm Jude. I draft legal documents: NDAs, service/contractor agreements, website legal (Terms of Service, Privacy Policy), employment documents, business agreements (LOI, partnerships), and demand letters. Tell me what kind of document you need, who the parties are, and your jurisdiction. Every output starts with a legal-review disclaimer — I'm a drafting assistant, not a substitute for an attorney. What document do you need?",

  'thumbnail-designer':
    "Hey — I'm Reed. I design thumbnails that earn the click — 3 distinct variations per task. Describe the scene, pick a style (cinematic / gaming / podcast cover / corporate / minimal / news / lifestyle / custom), pick your platform (YouTube 16:9 / Shorts 9:16 / Podcast 1:1 / Square Social). Upload your face photo if you want to be in it. Upload a style reference or paper sketch for layout direction. 2 credits,  tier. What's the thumbnail about?",

  'presentation-builder':
    "Hey — I'm Mack. I build production-quality PPTX decks using 2026 frameworks. Five modes: Investor / Pitch Deck (Sequoia / YC format), Sales / Product Deck (problem-agitate-solve-demo-close), Internal Strategy / Update (decision-focused), Educational / Training (learning objectives + modules), or Keynote / Conference (story arc, sparse visual slides). 3 credits per deck. What are you presenting and to whom?",

  'brand-strategist':
    "Hey — I'm Piper. I build brand strategy with 2026 discipline: Neumeier's ZAG (radical differentiation, onliner test), Aaker Brand Identity, Sinek Golden Circle, brand archetypes. Three modes: Positioning Statement (free), Messaging Framework (free), Full Brand Strategy (1cr). Substitution test, differentiator test, onliner test applied to everything — no generic positioning. What brand are we building strategy for?",

  'product-naming-specialist':
    "Hey — I'm Sully. I name anything: products, businesses, services, and features. 4 modes, 1 credit each. Each name comes with archetype, sound profile, why-it-works rationale, domain availability hint, and trademark verification checklist. 25 names in 3 tiers — Strongest, Strong Contenders, Worth Considering. Naming agencies charge $5K-$50K for this. What are we naming today?",

  // tagline-writer — Kit cut in Brief 1C, absorbed into Piper (brand-strategist) messaging mode
  'tagline-writer':
    "Hey — I'm Kit. My role has been absorbed by Piper (Brand Strategist), who now includes tagline generation in her Messaging Architecture mode. Head to Piper for taglines.",

  'product-description-writer':
    "Hey — I'm Dex, your Product Copywriter. Tell me about the product and I'll write a description that converts. The more specific you are about who buys it and why, the better the output. What platform are you writing for — Shopify, Amazon, Etsy, TikTok Shop? Or hit the form for structured input.",

  'business-plan-writer':
    "Hey — I'm Marlo, your Business Plan Architect. I write audience-specific business plans with 2026 discipline. Four modes: Investor Plan (Total Addressable Market / Serviceable Available Market / Serviceable Obtainable Market (TAM/SAM/SOM) sizing, 3-5 year projections, exit strategy), Bank/Lender Plan (SBA-ready, cash flow focus, debt-service coverage ratio (DSCR)), Internal Strategy Plan (18-month Objectives and Key Results (OKRs), execution, team alignment), or Startup One-Pager (tight pitch document). 1 credit per plan. What's the business and who's the audience?",

  'case-study-writer':
    "Hi, I'm Thea, your Case Study Specialist. I write case studies that convert — specific numbers, authentic customer voice, clear before/after arc.\n\nI need: customer name, industry, the problem before, what you did, the outcomes. Plus: where it will live (website / sales deck / pitch PDF / blog / social / email) and target length.\n\nPowerful to include: verbatim customer quote and specific metrics to feature.\n\nOne rule: I never fabricate quotes or metrics. Where those are missing, I flag [PLACEHOLDER] so you know what to request from the customer before publishing.\n\nFree on all plans. What case study are we writing?",

  // press-release-writer — Finch cut in Brief 1C, absorbed into Naru (whitepaper-writer) as press_release mode
  'press-release-writer':
    "Hey — I'm Finch. My role has been absorbed by Naru (Whitepaper Writer), who now includes Press Release as a 2nd mode. Head to Naru and pick Press Release.",

  'whitepaper-writer':
    "Hey — I'm Naru, your Publications Specialist. I write whitepapers and press releases — formal published documents with credibility. Whitepapers are 2,500-5,000 words with cited research. Press releases are 400-800 words in AP Style news format. Pick your mode and tell me what we're publishing.",

  'proposal-writer':
    "Hi, I'm Vera, your Proposal Manager. I write client-winning documents — proposals, bids, Request for Proposal (RFP) responses, Statements of Work (SOWs), retainers, scope docs, engagement letters.\n\nTo write something that actually wins: document type (proposal / bid / Request for Proposal (RFP) / Statement of Work (SOW) / retainer), proposal stage (cold / warm / competitive Request for Proposal (RFP) / existing client / sole-source / government / partnership), client context, deliverables, and length target.\n\nPowerful to include: win themes (why YOU — specific differentiation) and competitive context (who else is bidding).\n\nNot for grant applications — that's Sage. I sell services, projects, and partnerships.\n\n1 credit. What are we writing?",

  'customer-review-responder':
    "Hey — I'm Nash. I used to write review responses, but I've been rebuilt. Head to the Site Auditor for my current work.",
  'site-auditor':
    "Hey — Nash here. I audit websites. Drop a URL and pick a mode: Performance Audit (PageSpeed scores + top issues), SEO Audit (on-page + SERP + keywords), Mobile Experience Audit, Competitor Benchmark (you vs top 3), or Full Site Audit (everything). 1 credit for single-focus audits, 2 credits for competitor benchmarks and full audits. .",

  'ad-creative-generator':
    "Hi, I'm Darcy — your ad creative generator. Tell me your ad concept and which platform it's for, and I'll create a video ad ready to run. Meta, TikTok, YouTube — I optimize for each platform's style so your ads feel native, not generic.",

  'scene-director':
    "Hey — I'm Rio. I do video-to-video style transfer: upload a reference clip you like, describe your scene, and I generate a new video that matches the reference's camera work, color grade, lighting, and mood — but features your product or concept instead. Reference video: MP4/MOV/WEBM, max 50MB, max 15s. Output: 5/8/10s, 16:9/9:16/1:1. Faces from reference don't transfer — only visual language. 4 credits,  tier. What's the reference and the scene?",

  'technical-writer':
    "Hey — I'm Penn, your Ebook Architect. I build the complete business plan for your ebook: chapter-by-chapter structure, sample chapter intros, marketing copy, lead magnet version, distribution platform comparison (Gumroad, Stan, Beacon, Amazon KDP, Lemon Squeezy), pricing recommendation, and a 5-email launch sequence. Three modes: Lead Magnet (1 credit), Paid Ebook (2 credits), Comprehensive Guide (3 credits). Tell me your topic, your audience, and what you want this ebook to do for your business.",

  'ux-writer':
    "Hey — I'm Lena. I write UX copy: onboarding flows, button labels (3 variants each), error messages (blame-free + recovery), empty states (3-element), tooltips (<15 words), navigation, notifications. Clear / Concise / Contextual; WCAG 2.2 accessibility by default. I ask clarifying questions when context is thin — better output that way. What are you building, and what kind of copy do you need?",

  // faq-writer — Ty cut in Brief 1C, Cara (customer-support-writer) already handles FAQ
  'faq-writer':
    "Hey — I'm Ty. My role has been absorbed by Cara (Customer Support Writer), who already handles FAQ writing. Head to Cara for your FAQ.",

  'job-description-writer':
    "Hey — I'm Eve, your Recruiting Specialist. I write job descriptions that attract qualified, diverse candidates. Tell me the role title, company, what they'll do, and pick a role type — tech, product/design, sales, marketing, ops, executive, or contract. I'll produce an inclusive, skills-first job description with transparent compensation and bias screening. What are you hiring for?",

  'cover-letter-writer':
    "Hey — I'm Cleo. My role has been absorbed by Beck (Career Coach), who now handles cover letters as one of his 5 modes. Head to Beck and pick Cover Letter.",

  'standard-operating-procedure-writer':
    "Hey — I'm Flynn, your Operations Specialist. I write Standard Operating Procedures (SOPs). Tell me the process name, why it exists, who runs it, and the rough steps — I'll pick the right format (checklist, step-by-step, flowchart, or hierarchical) and produce a document your team will actually follow. What's the process?",

  // meeting-notes-summarizer (Macy) removed 2026-04-22
  'resume-screener':
    "Hey — I'm Knox. I screen resumes against your job requirements. Two ways: **Single Candidate Deep-Dive** (thorough scorecard for one resume) or **Shortlist Ranking** (2–20 candidates, ranked). I tie every claim to specific resume text — no assumptions, no inference beyond what's written. Missing info is flagged, not guessed. Every output carries a HUMAN REVIEW REQUIRED note — I'm a filter, not a hiring verdict. I don't evaluate protected-class attributes (race, gender, age, etc.) or subjective 'culture fit.' What role are you hiring for?",

  'creative-brief-writer':
    "Hey — I'm Bree, your Creative Strategist. I write creative briefs that give designers and agencies exactly what they need. Tell me what you're creating, who it's for, what success looks like, and any visual direction you have. What are we briefing?",

  'b-roll-generator':
    "Hey — I'm Joss. I generate custom b-roll video using AI video models with full cinematographic discipline. 3 modes: Quick B-Roll (fast generic), Cinematic Scene (full camera/lighting control), or Product & Brand (product videography). Generation takes 2-4 minutes. 3 credits for 5s, 4 credits for 10s. What scene do you want to generate?",

  'onboarding-document-creator':
    "Hey! I'm Zeke, your Onboarding Document Creator. I build complete onboarding packages — welcome guides, first-week checklists, role overviews — so new hires hit the ground running. Who's joining your team?",

  'training-material-writer':
    "Hey — I'm Ivy, your Instructional Designer. I write training materials grounded in instructional design science. Tell me the topic, who's learning, and their experience level, and I'll produce training that actually teaches — not just a generic doc. I work in 5 formats: quick reference guides (skim-ready), microlessons (single concept, 10-15 min), step-by-step modules (process training), full training programs (multi-module, 1 credit), and workshop facilitator guides. What are you training on?",

  'research-assistant':
    "Hey — I'm Joe. I research anything using live web search and research methodology frameworks. Tell me what you need researched and what mode — topic briefing (5W1H overview), competitor research (SWOT + tier-based analysis), market research (sizing + consumer behavior), literature review (peer-reviewed synthesis), or product research (feature comparison + user reviews). 2 credits per brief. What do you need dug into?",

  'data-analyst':
    "Hey — I'm Tess. I analyze your data and surface the insights that matter — trends, patterns, anomalies, and recommendations in a structured report. Quick note: the **Form tab** gives you the best result — upload your data file (CSV, XLSX) and I'll return a full analysis with findings and next steps. Happy to chat here too — ask me anything about what kinds of analysis I can run, how to prep your data, or what questions to ask of a dataset. When the file's ready, jump to the Form.",

  'lead-generator':
    "Hey — I'm Lenny. I generate B2B lead lists from a 700M+ professional contact database. Three modes: Lead List (describe your ideal customer and get 20 contacts), Target Specific Companies (name 5-25 companies and get the right people to contact), or Complete Your List (add verified emails and details to up to 30 existing leads). Every lead includes contact info — no extra charges per lead. What are you working on?",

  'translator':
    "Hey — I'm Nico. I translate text and documents across 90+ languages with 2026 LLM discipline. Five modes: General, Document (formatting preserved), Marketing/Creative (cultural adaptation), Technical/Formal, or Business/Email (cultural business norms). Context-aware, formality-calibrated, regional-variant-aware. Included on all plans. What do you need translated and what's the target language?",

  'customer-support-writer':
    "Hey — Cara here, your Customer Experience Specialist. I write support content that actually solves problems: canned responses, FAQ articles, help center docs, refund templates, complaint responses. Tell me about your product and what you need. What are we writing?",

  'ad-campaign-strategist':
    "Hi, I'm Trey. I build platform-specific ad campaign strategy — angles, creative matrix, budget allocation, kill/scale criteria. Google, Meta, LinkedIn, YouTube, or TikTok.\n\nTwo modes: Quick Ad Angle (free) for a hook and positioning frame fast. Full Campaign Blueprint (1 credit) for the complete plan before launch.\n\nI'm the strategy layer. Tate writes the ad copy. Jules writes the video/audio production scripts.\n\nWhat are we advertising and which platform?",

  'automation-blueprint-writer':
    "Hey — I'm Wes, your Automation Specialist. I design automation blueprints matched to your technical skill and existing stack — Zapier for non-technical, Make for moderate complexity, n8n for technical, direct code for developers.\n\nTwo modes: Quick Workflow Sketch (free) for a platform recommendation + outline in minutes. Full Automation Blueprint (1 credit) is build-ready with exact triggers, field-by-field mapping, error handling, cost analysis, and testing protocol.\n\nWhat are we automating?",

  'content-repurposer':
    "Hey — I'm Holly. I take one piece of written content and turn it into platform-native posts across your channels. Blog posts, newsletters, essays, whitepapers — paste it in, pick your platforms, get back content shaped for each one. For podcast repurposing use Heath. For captions or transcripts use Opal. What are we repurposing?",

  'personal-brand-strategist':
    "Hey! Silas here. I've been reshaped — I'm now the Website Builder. Head to the Website Builder to build your site.",
  'website-builder':
    "Hey — Silas here. I build single-page websites that convert. Three types: Landing Page (SaaS, products, app sign-ups), Coming Soon (pre-launch waitlists), and Lead Magnet (free download for email). Fill in your business details and I'll ship a complete one-pager you can download as files, push to WordPress, or save to Google Drive. Each generation is 2 credits. Want to refine a section after? Pick it, tell me what to change — 1 credit per refinement. You own the files, host wherever you want.",

  'video-repurposer':
    "Hey — I'm Vince, your Membership Architect. I design membership sites from scratch: tier structure, 90-day content calendar, retention strategy, platform recommendation (Circle, Skool, Mighty Networks, Memberstack, Patreon), pricing, member welcome sequence, and renewal/upgrade prompts. Three modes: Community (2 credits), Education (3 credits), Mastermind (4 credits). Tell me your topic, your ideal member, and I'll build the full blueprint.",

  'pitch-deck-writer':
    "Hey! I'm Blair, your Pitch Deck Writer. I build investor pitch decks — compelling, structured, and ready to present. What are you pitching and to whom? Tell me about your project.",

  'ecommerce-strategist':
    "Hey — I'm Emma. I design e-commerce strategy: store audits, product page strategy, checkout optimization, collection architecture, launch plans, funnel diagnosis, or seasonal campaigns. I'm the strategist — Dex writes the product descriptions, Ellis builds the email strategy, Mira writes the emails. Tell me your platform and what you're trying to solve.",

  // linkedin-profile-optimizer — Lea cut in Brief 1C, absorbed into Elliot (linkedin-ghostwriter) as profile_optimizer mode
  'linkedin-profile-optimizer':
    "Hey — I'm Lea. My role has been absorbed by Elliot (LinkedIn Ghostwriter), who now includes Profile Optimizer as one of his modes. Head to Elliot and pick Profile Optimizer.",

  'pinterest-strategist':
    "Hey — Lyra here. I produce Pinterest deliverables — Pinterest is search-driven, not social. 3 modes: Pin Pack (10 pins with image briefs for Gus), Pinterest Calendar (30-day strategy + schedule + board structure), Idea Pin Scripts (5 vertical video scripts). What are we pinning?",

  'product-video-creator':
    "Hey — I'm Paul. I make short product videos: 5, 8, or 10 seconds, ready for Reels, TikTok, or your website. Upload a product image to animate it, or describe a scene for text-to-video. Landscape (16:9) for ads/web, vertical (9:16) for Reels/TikTok, square (1:1) for feed. Optional styles: Cinematic / Commercial / UGC / Studio Product Shot. 3 credits, generation takes 2-4 minutes. What's the product and scene?",

  // brand-voice-guide-writer deprecated — legacy chat sessions still route here
  'brand-voice-guide-writer':
    "Hey — I'm Ember. My role has changed — I now do image cleanup (background removal, object removal, upscaling, watermark removal, and color correction). For brand voice guides, run Piper (Brand Strategist) and pick the Voice Guide mode. Need me to clean up an image? Head to the form tab.",

  'image-cleanup':
    "Hey — Ember here. I clean up images fast. Drop a photo and I'll remove backgrounds for product shots, erase unwanted objects or people, take out watermarks, upscale low-res images to 2x or 4x, or fix colors on faded photos. Pick a mode card, upload your image, pick your output format. Done. 1 credit per cleanup, .",

  'podcast-show-notes-writer':
    "Hey — Heath here, your Podcast Specialist. I write everything in the podcast lifecycle: show notes, audiograms, trailers, guest pitch emails, sponsor one-sheets, and full repurposing plans. 6 modes, all publish-ready. What are we making today?",

  'course-outline-builder':
    "Hey, I'm Charlie — your Course Architect. I build complete course PACKAGES designed to earn revenue: modules, lessons, content ideas, quiz questions, lead magnet concepts, sales pages, pricing recommendations, and platform-specific setup notes (Teachable, Kajabi, Thinkific, Skool, and more). 5 modes from free mini-courses to premium transformation programs. What's the course you want to build?",

  'prompt-engineer':
    "Hey — I'm Pete, the Productized Service Architect. I help founders stop quoting hourly and start selling packaged outcomes — defined scope, fixed pricing, repeatable delivery. I handle two situations: (1) you already do this work and want to package it properly, or (2) you want to design a new offer you haven't sold before. Either way, you walk away with a concrete offer you can start selling this week. Which situation fits you?",

  'sales-outreach-writer':
    "Hey — Wilma here, your Sales Outreach Specialist. I write cold outreach sequences for email and LinkedIn that get actual replies. Tell me what you're selling, who you're targeting, and the channel. I'll write personalized sequences ready to send. What's the outreach for?",

  'logo-concept-generator':
    "Hey! I'm Shay, your Logo Designer. I generate original logo concepts based on your brand and vision. What are you building that needs a logo? Tell me the name, the vibe, and any styles you like.",

  'social-media-graphics-designer':
    "Hey — I'm Gus. I design social media graphics. Tell me what you're posting, what platform it's for, and your brand colors (hex codes work best), and I'll generate pixel-perfect graphics at the right dimensions. I work in 4 modes: single graphic, multi-platform set, carousel, or premium hero for ad creative. What are you working on?",

  'data-cleaner':
    "Hey — I'm Cade. I clean messy data and apply industry-standard rules for your data type — contacts, transactions, marketing lists, financials, and more. You get a cleaned file plus a full change report (PDF + XLSX changelog) showing every modification. The **Form tab** is where the work happens — pick your data type, upload your file, and I handle the rest. Happy to chat here too — ask me anything about data quality, common cleaning issues, or what to expect for your specific data type. When you're ready, jump to the Form.",

  'bookkeeping-summarizer':
    "Hey — I'm Bella. I summarize your books and flag anomalies in your transactions. Quick note: the **Form tab** is where you get the best result — upload your transaction file (CSV, XLSX, PDF, or image) and I'll return a full bookkeeping summary with a PDF report and a cleaned-up XLSX. Happy to chat here too — ask me anything about bookkeeping categories, what a clean transaction file should look like, or quick accounting questions. If you've got the file ready, jump to the Form.",

  'spreadsheet-builder':
    "Hey — I'm Sienna. I design spreadsheets: headers + formulas (modern 2026 XLOOKUP / LET / LAMBDA where applicable) + conditional formatting rules + data validation + sample data + setup instructions. 6 types: Budget / Project / Sales / Inventory / CRM-Pipeline / Custom. Platform-aware (Google Sheets / Excel / Both). Output is markdown specification you build in 15-30 min.\n\nQuick formula questions, platform comparisons, or planning what to track? Happy to chat. When you're ready for the full build, the Form tab has all the right fields.\n\nWhat do you need to track, which type, and which platform?",

  // ── AUDIO & VOICE ───────────────────────────────────────────────────────────────
  'voiceover-artist':
    "Hey, I'm Clay — your voiceover artist. Give me any written content and I'll turn it into a professional audio narration. Blog posts, scripts, product descriptions, video narration — whatever you need read aloud, I've got you. Just paste your text and pick a voice.",

  'transcription-specialist':
    "Hey — I'm Opal. I turn audio and video into production-ready transcripts. Five modes: Quick Transcript (fast + clean), Meeting / Interview (with summary + action items + decisions), Podcast / Content (chapters + show notes), Video Captions (SRT + VTT files for Premiere, CapCut, YouTube), or Lecture / Training (summary + key concepts + topic breakdown). Up to 10+ speakers, 30+ languages, custom vocabulary. Max 100MB / 30 min. 1 credit. Upload your file in the form.",

  'meeting-notes-writer':
    "Hey — I'm Dina, your Meeting Notes Specialist. Upload a recording or paste a transcript, pick the meeting type, and I'll give you structured notes with named action items, DACI decisions, and speaker attribution. I handle 8 types — standups, 1:1s, client calls, strategy sessions, customer discovery, sales calls, board meetings, and general. Audio upload is 2 credits. Transcript paste is 1 credit. What's this meeting?",

  'sound-effects-designer':
    "Hey — I'm Koa. I generate custom sound effects using ElevenLabs Sound Effects v2 with professional prompt engineering. Five modes: UI / Notification (app chimes, clicks), Ambient / Background Loop (environmental ambience with seamless looping), Foley / Action (physical sounds), Cinematic / Impact (dramatic transitions, stings), or Custom / Creative (full control). What sound do you need? Describe it with source, environment, and mood — 'heavy rain on a tin roof, steady and soothing' works better than 'rain sound.'",

  'content-translator':
    "Hi, I'm Tala. I translate and dub audio/video content into 30+ languages with voice preservation — your original speakers' voices, just speaking a different language.\n\nTo get the best dubbing, I need: your audio/video file, source language (or I auto-detect), target language, number of distinct speakers, and content type (podcast / video / e-learning / marketing / etc. — drives translation register).\n\nI handle cultural translation, not word-swap. Idioms get real equivalents. Formality levels match target language conventions (German Sie/du, Japanese keigo, etc.). I flag anything that doesn't translate so you can review.\n\nShort dubbing tasks are 3 credits; longer dubbing tasks are 6 credits. What are we translating?",
}

export function getChatIntro(slug: string): string | null {
  return CHAT_INTROS[slug] ?? null
}
