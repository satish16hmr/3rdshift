import type { ModelTier } from './callAI';

export interface ModelConfig {
  provider: 'anthropic' | 'openai';
  model: string;
  maxTokens: number;
  tier: ModelTier;
}

// Per-worker token overrides — right-sized to worst-case output × 1.3 buffer per Platform Reliability Audit 2026-04-22.
// Default: 4096. Workers below are raised above default to prevent truncation on realistic worst-case input.
// Image-gen workers (thumbnail-designer, logo-concept-generator, social-media-graphics) produce no
// meaningful text output — the 500-token floor handles any metadata.
const WORKER_MAX_TOKENS: Record<string, number> = {
  // ─── Existing overrides (kept) ───────────────────────────────────────────────
  'resume-writer': 2000,              // raised from 1200 — short-form but needs space for full resume
  'kpi-dashboard-writer': 12000,      // raised from 8000 — 10-section framework can exceed 8K on complex orgs
  'community-manager': 8000,          // Heavy 1cr — raised from 4096 to prevent truncation on detailed playbooks

  // ─── Long-form content (1500-4000 words = ~3K-5K tokens × 1.3) ──────────────
  'blog-post-writer': 8000,
  'email-copywriter': 8000,
  'newsletter-writer': 8000,
  'landing-page-copywriter': 8000,
  'interview-question-writer': 8000,
  'social-media-creator': 12000,         // Heavy 1cr — raised from 8K, multi-platform mode needs room for 3 full scripts
  'instagram-strategist': 8000,
  'funnel-strategist': 8000,
  'sales-outreach-writer': 4000,       // Phase 24c: free single_email mode is short; full_sequence stays 4K default
  'trend-analyst': 8000,
  'audience-persona-builder': 8000,
  // swot-analyst cut Brief 1C
  'pricing-strategist': 8000,
  'case-study-writer': 8000,
  'proposal-writer': 8000,
  'technical-writer': 8000,
  // faq-writer cut Brief 1C
  'sop-writer': 8000,
  'meeting-notes-writer': 8000,
  'resume-screener': 8000,
  'creative-brief-writer': 8000,
  'onboarding-document-creator': 8000,
  'data-analyst': 8000,
  'lead-generator': 8000,
  'ad-campaign-strategist': 8000,
  'automation-blueprint-writer': 8000,
  'content-repurposer': 8000,
  'video-repurposer': 8000,          // Vince — Membership Architect (heavy worker: full 90-day calendar, platform comparisons, 5+ email templates)
  // linkedin-profile-optimizer cut Brief 1C
  'pinterest-strategist': 8000,
  'podcast-show-notes-writer': 8000,
  'prompt-engineer': 8000,
  'bookkeeping-summarizer': 8000,
  'site-auditor': 8000,              // Nash — structured audit output with scores + recommendations + comparison tables

  // ─── Very long / structured (4000-15000 words = ~5K-12K tokens × 1.3) ────────
  'hook-specialist': 6000,
  'content-writer': 12000,
  'script-writer': 12000,
  'email-marketing-strategist': 12000,
  'competitor-analyst': 12000,
  'content-strategist': 12000,
  'report-writer': 12000,
  'brand-strategist': 8000,          // Light worker — Rule 2 compliant (8K ceiling)
  'presentation-builder': 12000,
  'training-material-writer': 12000,
  'personal-brand-strategist': 12000,  // DEPRECATED — kept for legacy task re-renders
  'website-builder': 16000,            // Silas — full page JSON artifact (5 page types, up to 15 sections)
  // 'ecommerce-strategist' removed — capped at 2500 via registry.maxOutputTokens (Phase 24a)
  // 'proposal-bid-writer': 12000, // REMOVED — proposal-bid-writer cut, Vera (proposal-writer) absorbs
  // brand-voice-guide-writer deprecated — Ember reshaped to image-cleanup (Apr 24-25, 2026)
  // image-cleanup is a fal.ai image worker — no Claude max_tokens applies
  'data-cleaner': 12000,
  'spreadsheet-builder': 12000,

  // ─── Very long + complex (5000-15000 words or structured multi-section) ──────
  // 'seo-writer': 16000,  // REMOVED — stale slug, Kai is now 'seo-strategist'
  'seo-strategist': 16000,
  'creative-editor': 16000,          // editing full documents, input can be long
  // 'grant-writer' removed — capped at 2800 via registry.maxOutputTokens (Phase 24a)
  'market-research-analyst': 16000,
  'legal-document-drafter': 16000,
  'research-assistant': 16000,
  'business-plan-writer': 16000,
  'pitch-deck-writer': 16000,

  // ─── Maximum output workers (verified via production tasks) ──────────────────
  'whitepaper-writer': 20000,         // whitepapers: up to 8000 words = ~10K tokens × 1.3 = 13K; 20K for safety
  'course-outline-builder': 20000,   // signature courses: 60-76K chars confirmed = 15-19K tokens

  // ─── Image-gen workers (no meaningful text output) ────────────────────────────
  'thumbnail-designer': 500,
  'logo-concept-generator': 500,
  'social-media-graphics': 500,
  'image-cleanup': 500,              // Ember — fal.ai image worker, no Claude text output
};

export function getModelForWorker(slug: string, _category: string): ModelConfig {
  // All 78 workers use 'sonnet' tier
  // JARVIS uses 'haiku' tier (see jarvis/route.ts)
  return {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    maxTokens: WORKER_MAX_TOKENS[slug] ?? 4096,
    tier: 'sonnet',
  };
}
