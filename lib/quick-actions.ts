import { getWorkerBySlug } from '@/lib/workers/registry'

export type QuickActionGoal =
  | 'Grow My Audience'
  | 'Find Customers'
  | 'Sell Digital Products'
  | 'Launch or Market a Product'
  | 'Build My Brand'
  | 'Run My Business Better'
  | 'Just Exploring'

export type QuickAction = {
  action: string
  slug: string
  worker: string
  role: string
  goal: QuickActionGoal
}

export type QuickActionFilter = QuickActionGoal | 'All'

export const QUICK_ACTION_GOALS: QuickActionFilter[] = [
  'All',
  'Grow My Audience',
  'Find Customers',
  'Sell Digital Products',
  'Launch or Market a Product',
  'Build My Brand',
  'Run My Business Better',
]

export const QUICK_ACTION_GOAL_COLORS: Record<QuickActionGoal, string> = {
  'Grow My Audience': '#378ADD',
  'Find Customers': '#1D9E75',
  'Sell Digital Products': '#7F77DD',
  'Launch or Market a Product': '#BA7517',
  'Build My Brand': '#D4537E',
  'Run My Business Better': '#888780',
  'Just Exploring': '#888780',
}

export const QUICK_ACTIONS: QuickAction[] = [
  // Goal 1 — Grow My Audience
  { action: 'Write a blog post', slug: 'content-writer', worker: 'Ava', role: 'Article Writer', goal: 'Grow My Audience' },
  { action: 'Draft a LinkedIn post', slug: 'linkedin-ghostwriter', worker: 'Elliot', role: 'LinkedIn Ghostwriter', goal: 'Grow My Audience' },
  { action: 'Write a newsletter', slug: 'newsletter-writer', worker: 'Oscar', role: 'Newsletter Editor', goal: 'Grow My Audience' },
  { action: 'Create an X thread', slug: 'x-twitter-ghostwriter', worker: 'Case', role: 'X/Twitter Ghostwriter', goal: 'Grow My Audience' },
  { action: 'Rank on Google (SEO)', slug: 'seo-strategist', worker: 'Kai', role: 'SEO Strategist', goal: 'Grow My Audience' },
  { action: 'Build my Instagram plan', slug: 'instagram-strategist', worker: 'Peyton', role: 'Instagram Content Director', goal: 'Grow My Audience' },
  { action: 'Write scroll-stopping hooks', slug: 'hook-specialist', worker: 'Sam', role: 'Hook Specialist', goal: 'Grow My Audience' },
  { action: 'Repurpose my content', slug: 'content-repurposer', worker: 'Holly', role: 'Content Repurposer', goal: 'Grow My Audience' },

  // Goal 2 — Find Customers
  { action: 'Find new leads', slug: 'lead-generator', worker: 'Lenny', role: 'Lead Generator', goal: 'Find Customers' },
  { action: 'Write cold outreach', slug: 'sales-outreach-writer', worker: 'Wilma', role: 'Sales Outreach Specialist', goal: 'Find Customers' },
  { action: 'Analyze competitors', slug: 'competitor-analyst', worker: 'Zane', role: 'Competitor Analyst', goal: 'Find Customers' },
  { action: 'Build a landing page', slug: 'landing-page-copywriter', worker: 'Quinn', role: 'Landing Page Copywriter', goal: 'Find Customers' },
  { action: 'Write an email sequence', slug: 'email-copywriter', worker: 'Mira', role: 'Email Copywriter', goal: 'Find Customers' },
  { action: 'Research my market', slug: 'market-research-analyst', worker: 'Duncan', role: 'Market Research Analyst', goal: 'Find Customers' },
  { action: 'Build audience personas', slug: 'audience-persona-builder', worker: 'Nora', role: 'Audience Persona Builder', goal: 'Find Customers' },
  { action: 'Plan my funnel', slug: 'funnel-strategist', worker: 'Alice', role: 'Funnel Strategist', goal: 'Find Customers' },

  // Goal 3 — Sell Digital Products
  { action: 'Design a course', slug: 'course-outline-builder', worker: 'Charlie', role: 'Course Architect', goal: 'Sell Digital Products' },
  { action: 'Write a sales page', slug: 'landing-page-copywriter', worker: 'Quinn', role: 'Landing Page Copywriter', goal: 'Sell Digital Products' },
  { action: 'Build a launch email sequence', slug: 'email-copywriter', worker: 'Mira', role: 'Email Copywriter', goal: 'Sell Digital Products' },
  { action: 'Price my product', slug: 'pricing-strategist', worker: 'Cruz', role: 'Pricing Strategist', goal: 'Sell Digital Products' },
  { action: 'Write product descriptions', slug: 'product-description-writer', worker: 'Dex', role: 'Product Copywriter', goal: 'Sell Digital Products' },
  { action: 'Build my ecommerce strategy', slug: 'ecommerce-strategist', worker: 'Emma', role: 'Ecommerce Strategist', goal: 'Sell Digital Products' },

  // Goal 4 — Launch or Market a Product
  { action: 'Write ad copy', slug: 'ad-copywriter', worker: 'Tate', role: 'Ad Copywriter', goal: 'Launch or Market a Product' },
  { action: 'Design an ad campaign', slug: 'ad-campaign-strategist', worker: 'Trey', role: 'Ad Campaign Strategist', goal: 'Launch or Market a Product' },
  { action: 'Write a pitch deck', slug: 'pitch-deck-writer', worker: 'Blair', role: 'Pitch Deck Writer', goal: 'Launch or Market a Product' },
  { action: 'Build an email campaign', slug: 'email-marketing-strategist', worker: 'Ellis', role: 'Email Marketing Strategist', goal: 'Launch or Market a Product' },
  { action: 'Create a video ad', slug: 'ad-creative-generator', worker: 'Darcy', role: 'Ad Creative Generator', goal: 'Launch or Market a Product' },
  { action: 'Build a business plan', slug: 'business-plan-writer', worker: 'Marlo', role: 'Business Plan Architect', goal: 'Launch or Market a Product' },
  { action: 'Write a case study', slug: 'case-study-writer', worker: 'Thea', role: 'Case Study Specialist', goal: 'Launch or Market a Product' },
  { action: 'Build a website', slug: 'website-builder', worker: 'Silas', role: 'Website Builder', goal: 'Launch or Market a Product' },

  // Goal 5 — Build My Brand
  { action: 'Position my brand', slug: 'brand-strategist', worker: 'Piper', role: 'Brand Strategist', goal: 'Build My Brand' },
  { action: 'Name my product', slug: 'product-naming-specialist', worker: 'Sully', role: 'Naming Specialist', goal: 'Build My Brand' },
  { action: 'Design a logo concept', slug: 'logo-concept-generator', worker: 'Shay', role: 'Logo Concept Generator', goal: 'Build My Brand' },
  { action: 'Brief a creative project', slug: 'creative-brief-writer', worker: 'Bree', role: 'Creative Strategist', goal: 'Build My Brand' },
  { action: 'Design social media graphics', slug: 'social-media-graphics-designer', worker: 'Gus', role: 'Social Media Graphics Designer', goal: 'Build My Brand' },
  { action: 'Build a content strategy', slug: 'content-strategist', worker: 'Lane', role: 'Content Strategist', goal: 'Build My Brand' },

  // Goal 6 — Run My Business Better
  { action: 'Write a Standard Operating Procedure (SOP)', slug: 'standard-operating-procedure-writer', worker: 'Flynn', role: 'Operations Specialist', goal: 'Run My Business Better' },
  { action: 'Post a job description', slug: 'job-description-writer', worker: 'Eve', role: 'Recruiting Specialist', goal: 'Run My Business Better' },
  { action: 'Create interview questions', slug: 'interview-question-writer', worker: 'Dale', role: 'Hiring Specialist', goal: 'Run My Business Better' },
  { action: 'Build my resume', slug: 'resume-writer', worker: 'Beck', role: 'Career Coach', goal: 'Run My Business Better' },
  { action: 'Summarize a meeting', slug: 'meeting-notes-writer', worker: 'Dina', role: 'Meeting Notes Specialist', goal: 'Run My Business Better' },
  { action: 'Build an automation', slug: 'automation-blueprint-writer', worker: 'Wes', role: 'Automation Specialist', goal: 'Run My Business Better' },
  { action: 'Draft legal documents', slug: 'legal-document-drafter', worker: 'Jude', role: 'Legal Document Drafter', goal: 'Run My Business Better' },
  { action: 'Write customer support content', slug: 'customer-support-writer', worker: 'Cara', role: 'Customer Experience Specialist', goal: 'Run My Business Better' },
  { action: 'Build a spreadsheet', slug: 'spreadsheet-builder', worker: 'Sienna', role: 'Spreadsheet Builder', goal: 'Run My Business Better' },
  { action: 'Analyze my data', slug: 'data-analyst', worker: 'Tess', role: 'Data Analyst', goal: 'Run My Business Better' },
  { action: 'Write a business report', slug: 'report-writer', worker: 'Iris', role: 'Report Strategist', goal: 'Run My Business Better' },
  { action: 'Build a presentation', slug: 'presentation-builder', worker: 'Mack', role: 'Presentation Builder', goal: 'Run My Business Better' },
]

export const DEFAULT_QUICK_ACTIONS = [
  'Write a blog post',
  'Draft a LinkedIn post',
  'Find new leads',
  'Build a landing page',
  'Analyze competitors',
  'Design a course',
  'Position my brand',
  'Write ad copy',
] as const

export function getDefaultQuickActions() {
  return DEFAULT_QUICK_ACTIONS.map((label) => QUICK_ACTIONS.find((action) => action.action === label)).filter(Boolean) as QuickAction[]
}

export function validateQuickActions() {
  return QUICK_ACTIONS.filter((action) => !getWorkerBySlug(action.slug))
}
