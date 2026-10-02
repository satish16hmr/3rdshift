# Section-Based Artifacts — Pattern Documentation

**Introduced:** April 25, 2026 (Silas / Website Builder reshape, V28 Phase 2 Worker 3)

---

## Problem

Standard worker output is a single blob (text or single file). When a user asks "make the hero bolder" on a full-page output, the only option is regenerating the entire deliverable — user loses parts they liked, and iterative refinement becomes an infinite loop that never converges.

## Solution

Store the deliverable as **independent sections** with shared assets. Refine one section at a time. Other sections stay byte-for-byte identical.

---

## Artifact Schema

```typescript
interface WebsiteArtifact {
  sections: {
    [section_id: string]: {
      type: 'hero' | 'features' | 'about' | 'social_proof' | 'pricing' | 'faq' | 'cta' | 'footer'
           | 'email_capture' | 'pain_solution' | 'services' | 'contact' | 'testimonials' | 'process'
           | 'differentiators' | 'urgency' | 'guarantee' | 'pain_agitation' | 'interest' | 'desire'
           | 'bonuses' | 'risk_reversal' | 'service_area' | 'local_schema' | string;
      order: number;       // sort order for assembly
      label: string;       // human-readable label for dropdown (e.g. "Hero", "Features")
      html: string;        // complete, self-contained section HTML
      css: string;         // section-scoped CSS (use unique prefixes e.g. .s-hero-001 { })
      js?: string;         // optional section-scoped JS
      version?: number;    // increments on each refinement (starts at 1)
    };
  };
  shared: {
    head_html: string;     // <title>, <meta>, font imports, Open Graph, schema markup
    global_css: string;    // body, containers, CSS variables, typography scale, button base styles
    global_js: string;     // smooth scroll, mobile nav toggle, global functionality
    tailwind_cdn: boolean; // whether to include Tailwind CDN <script> tag
  };
  images: Array<{
    id: string;
    type: 'unsplash' | 'ai_generated';
    query?: string;        // for unsplash: search terms
    url?: string;          // for ai_generated: resolved fal.ai URL
    alt: string;
    section_id: string;    // which section uses this image
  }>;
  summary?: string;        // 2-3 sentence plain-language summary
  placeholders_added?: string[]; // list of fabricated placeholders needing user replacement
}
```

---

## Final HTML Assembly

```typescript
function assembleSite(artifact: WebsiteArtifact): string {
  const sortedSections = Object.values(artifact.sections)
    .sort((a, b) => a.order - b.order);
  const sectionsHtml = sortedSections.map(s => s.html).join('\n');
  const sectionsCss = sortedSections.map(s => s.css).filter(Boolean).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${artifact.shared.tailwind_cdn ? '<script src="https://cdn.tailwindcss.com"></script>' : ''}
${artifact.shared.head_html}
<style>
${artifact.shared.global_css}
${sectionsCss}
</style>
</head>
<body>
${sectionsHtml}
<script>
${artifact.shared.global_js}
</script>
</body>
</html>`;
}
```

---

## Refinement Flow

1. User picks section from dropdown (e.g., "Hero")
2. User types refinement: "Make the headline bolder, add an emoji"
3. System sends ONLY that section's current HTML/CSS to Claude
4. Claude returns only the updated section object
5. New section replaces old section in artifact
6. `version` increments
7. Final HTML re-assembles from updated artifact
8. Preview updates

**Critical:** Other sections are NOT touched. NOT regenerated. NOT re-prompted.

---

## Credit Costs (Silas pattern)

| Operation | Credits |
|---|---|
| Initial generation (full page) | 2cr |
| Section refinement (1 section) | 1cr |
| New section addition | 1cr |
| Section reorder | free (no Claude call) |
| Section delete | free (no Claude call) |
| Generate alternative version | 2cr (same as initial) |
| AI-generated image | +1cr per image (max 4/page) |

---

## Claude Output Format (Initial Generation)

Returns single JSON object:
```json
{
  "sections": {
    "hero_001": { "type": "hero", "order": 1, "label": "Hero", "html": "...", "css": "..." }
  },
  "shared": { "head_html": "...", "global_css": "...", "global_js": "...", "tailwind_cdn": true },
  "images": [{ "id": "hero_bg", "type": "unsplash", "query": "modern office", "alt": "...", "section_id": "hero_001" }],
  "summary": "...",
  "placeholders_added": ["[Your phone number] in hero CTA"]
}
```

## Claude Output Format (Section Refinement)

Returns single JSON object:
```json
{
  "section_id": "hero_001",
  "type": "hero",
  "label": "Hero",
  "html": "... updated html ...",
  "css": "... updated css ...",
  "refinement_summary": "Made headline bolder (font-weight 900) and added rocket emoji prefix."
}
```

---

## Future Applications

This pattern is appropriate for any worker where:
- Output consists of multiple discrete, independently-editable chunks
- Users need to refine specific parts without losing the rest
- Iterative refinement is a core workflow

**Candidates (post-launch):**
- **Ava** (Content Writer): paragraph-level refinement of articles
- **Sam** (Blog Post Writer): section-level refinement (intro, body sections, CTA)
- **Mira** (Email Copywriter): per-email refinement in multi-email sequences
- **Blair** (Pitch Deck Writer): per-slide refinement

**Implementation requirements:**
1. Artifact storage (task_results or dedicated table)
2. Section picker UI component (dropdown or visual hover)
3. Refinement input + submit (1cr per refinement)
4. Per-operation credit deduction (separate from initial task credit)
5. Prompt file must define both generation and refinement output formats

---

*Pattern documented: April 25, 2026. Reference worker: Silas (website-builder).*
