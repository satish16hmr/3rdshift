# Charlie · Course Architect — Specialist Spec
**Slug:** `course-outline-builder`  
**Status:** Launch-ready (April 20, 2026)  
**Registry:** Heavy worker, `modeCredits: { mini_course: 0, workshop: 0, signature: 2, premium: 2, certification: 2 }`  
**minPlan:** starter (free modes allow Starter; heavy modes require Pro+)

---

## What Charlie Does

Charlie builds complete course PACKAGES — not outlines. A course package is everything a creator needs to record their course and start selling it.

## 5-Mode Architecture

| Mode | Credits | Available to |
|---|---|---|
| Mini-course / Lead magnet | 0 (free) | All tiers |
| Workshop | 0 (free) | All tiers |
| Signature course (4–8 hours) | 2 credits | Pro+ |
| Premium transformation / Cohort | 2 credits | Pro+ |
| Certification / Credential prep | 2 credits | Pro+ |

## Per-Mode Credit Infrastructure (new pattern)

- Registry uses `modeCredits` map instead of flat `creditCost`
- `execute-task/route.ts` reads `task.input.course_mode` and looks up the credit cost
- 0-credit modes bypass both the credit check AND the Starter plan gate
- Free modes: `credits_charged: 0` on the task record
- This pattern is documented in `audit-global-patterns.md` as the standard for conversion-driving workers

## Tier Gating

**Starter on free modes (mini_course, workshop):**
- Form fully active — no overlay, no disable
- No PRO+ badge on form header
- Template cards show PRO+ badge (templates are Pro-only)
- Submit button shows normally with "Included on all plans"

**Starter on heavy modes (signature, premium, certification):**
- Form grayed out (showroom overlay)
- Inline upgrade CTA at submit area with ROI math
- Attribution query param: `?source=charlie-{mode}`
- "Switch to Mini-course (free)" fallback button

**Pro+ on any mode:**
- Form fully active
- Heavy modes show "2 credits · you have N remaining"
- All 6 templates clickable

## Templates (Pro+ only)

6 templates ship:
1. 30-Day Quick Start (mini_course, lead magnet)
2. Tool Quickstart (mini_course, paid $27-$47)
3. 5-Step Framework (mini_course, paid $47-$97)
4. Zero to First Client (signature, launch cycle)
5. Master [Skill] in 8 Weeks (signature, evergreen)
6. [Outcome] for [Audience] (signature, evergreen)

## System Prompt Architecture

5 mode branches in one system prompt. Key sections:
- MODE INSTRUCTIONS: one branch per mode with specific output guidance
- PLATFORM-SPECIFIC KNOWLEDGE: real 2026 knowledge for 8 platforms
- OUTPUT STRUCTURE: full H1/H2/H3 document structure
- ANTI-PATTERNS: blocked module/lesson name patterns
- VOICE MATCH: inherits Case infrastructure

## Form Fields

**Shared (all modes):** course_mode, course_title, expertise, course_topic, student_starting_point, student_transformation, student_blocker, price_point, platform

**Mini-course conditional:** mini_course_type, promotion_channel  
**Workshop conditional:** workshop_format, workshop_series, workshop_upsell  
**Signature conditional:** num_modules, content_mix, include_capstone, launch_style  
**Premium conditional:** cohort_model, cohort_duration, community_platform, include_application, payment_plan  
**Certification conditional:** cert_name, exam_provider, has_blueprint, blueprint_url, include_practice_tests, include_pass_guarantee  

**More Options:** must_cover, avoid_topics, learning_style, include_quizzes, additional_deliverables, course_tone, competition, voice_match

## Output Sections (mini_course confirmed)

1. Course Overview & Positioning
2. Pricing Recommendation  
3. Lead Magnet
4. Module Breakdown (with lesson content ideas, quizzes, actions)
5. Implementation Roadmap
6. Sales Page Outline

## Smoke Tests (April 20, 2026)

- ✅ Starter: mini_course mode form is active (not disabled)
- ✅ Starter: no PRO+ badge in form header
- ✅ Starter: signature mode shows upgrade CTA
- ✅ Starter: signature mode shows "Switch to Mini-course (free)" button
- ✅ Starter: "Switch to Mini-course" button resets mode
- ✅ Starter: template cards are visible
- ✅ Operator: all 5 modes present in Course Type dropdown
- ✅ Operator: signature mode shows submit button (not upgrade CTA)
- ✅ Operator: signature mode shows "2 credits" indicator
- ✅ Operator: Signature templates visible
- ✅ Operator: signature mode shows num_modules field
- ✅ Operator: mini_course mode shows "Included on all plans"
- ✅ Output quality: mini_course task completed, credits_charged=0, full course package generated
