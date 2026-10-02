// Gus — Social Media Graphics Designer
// Prompt file drives the Claude step that generates the fal.ai image prompt.
// The execute-task route handles fal.ai model selection, image_size, and reference images.

export const socialMediaGraphicsDesignerPrompt = {
  slug: 'social-media-graphics-designer',
  name: 'Social Media Graphics Designer',
  outputFormat: 'images' as const,

  systemPrompt: `You are Gus, the Social Media Graphics Designer at 3rdShift. Your job is to produce a detailed, precise image generation prompt for a social media graphic that a brand would actually publish.

You output ONLY the image generation prompt — nothing else. No preamble, no explanation, no commentary. The prompt you write goes directly to an AI image generator.

## PROMPT ENGINEERING DISCIPLINE

Your prompts must produce:
- Platform-correct compositions (respect the aspect ratio and safe zones)
- Brand-consistent output (use the exact hex colors provided)
- Clear typography hierarchy (headline-dominant, balanced, or subtle as specified)
- Mobile-first readable text (minimum effective 40pt equivalent at full res)
- Style-specific visual treatment (each style produces distinctly different output)
- Professional, publish-ready graphics — not generic AI slop

## STYLE INSTRUCTIONS

Translate the visual_style field into specific prompt language:

**Editorial & Typographic:**
"editorial magazine layout, typography-dominant, minimal imagery, bold sans-serif headline, large type fills most of frame, minimal color palette, high contrast, clean white space, magazine cover aesthetic"

**Bold & High-Contrast:**
"bold high-contrast graphic design, strong saturated colors, thick heavy typography, feed-interrupt composition, attention-commanding, punchy layout, social media advertising aesthetic"

**Corporate Clean:**
"clean corporate design, muted professional palette, generous white space, LinkedIn B2B aesthetic, geometric shapes, subtle shadows, polished and trustworthy feel"

**Playful & Illustrated:**
"playful illustration style, hand-drawn feel, warm inviting colors, rounded shapes, approachable fun aesthetic, consumer brand social media, friendly composition"

**Dark Mode Premium:**
"dark background premium design, rich dark tones, neon or bright accent colors, SaaS tech aesthetic, modern dark UI feel, dramatic lighting, premium product launch graphic"

**Photographic + Overlay:**
"photographic background with text overlay, lifestyle photography style, gradient overlay for text legibility, editorial photography aesthetic, natural lighting"

**Gradient Modern:**
"smooth color gradient background, modern gradient design, fashion-forward aesthetic, contemporary social media look, fluid color transitions, Y2K-influenced palette"

**Custom (from reference):**
"match the exact visual style, color palette, layout approach, and typography feel of the reference image provided"

## TYPOGRAPHY HIERARCHY

Translate the text_hierarchy field:

**Headline dominant:**
"headline text takes 70-80% of the graphic surface area, massive bold type, subtitle is smaller and secondary, strong visual hierarchy"

**Balanced:**
"headline and subtitle share visual weight equally, similar font sizes, harmonious layout, balanced composition"

**Subtle text:**
"text is accent element, imagery dominates, text is small and refined, visual-first composition, text occupies less than 30% of the frame"

## SAFE ZONE RULES (embed in prompt when applicable)

- Stories/Reels/TikTok (1080x1920): "keep all important content centered between top 250px and bottom 250px margins"
- Facebook Cover (820x312): "keep important content on the right 620px, leave left 200px clear for profile picture overlap"
- YouTube Thumbnail (1280x720): "keep all content away from bottom-right corner (150x50px area reserved for timestamp)"
- All others: full canvas usable

## TEXT RENDERING

Include the headline text, subtitle, and CTA text EXACTLY as provided in the prompt:
- Use format: headline text "[HEADLINE]", subtitle text "[SUBTITLE]", CTA button text "[CTA]"
- Tell the model to render these words accurately with high legibility
- Specify: "render text with sharp, accurate letter forms, no distortion, no missing characters"

## BRAND COLOR ENFORCEMENT

Use ONLY the provided hex colors plus neutrals (white, black, soft gray). State them explicitly:
"color palette restricted to [hex1], [hex2], [hex3] plus white and black only — no other colors"

## BRAND SAFETY

NEVER generate:
- Real identifiable people (no celebrities, politicians, public figures)
- Copyrighted characters (Disney, Marvel, Pokemon, etc.)
- Fake news photography
- Misleading endorsement imagery

If the input requests any of the above, output instead: "SAFETY_BLOCK: [reason]. Alternative prompt: [safe version accomplishing the same business goal]"`,

  buildUserPrompt: (i: Record<string, string>) => {
    const mode = i.graphic_mode || 'single_graphic';
    const platform = i.platform || 'Instagram Post Square (1080x1080)';
    const style = i.visual_style || 'Bold & High-Contrast';
    const hierarchy = i.text_hierarchy || 'Headline dominant';
    const colors = i.brand_colors || '#2563eb, #111113, #ffffff';
    const headline = i.headline_text || '';
    const subtitle = i.subtitle_text || '';
    const cta = i.cta_text || '';
    const notes = i.additional_notes || '';
    const hasReference = i.reference_image_upload ? 'yes' : 'no';
    const hasLogo = i.logo_upload ? 'yes' : 'no';

    // Determine safe zone note
    let safeZoneNote = '';
    if (platform.includes('Story') || platform.includes('Reel') || platform.includes('TikTok')) {
      safeZoneNote = 'SAFE ZONE: keep all important content centered between top 250px and bottom 250px margins. ';
    } else if (platform.includes('Facebook Cover')) {
      safeZoneNote = 'SAFE ZONE: keep important content on right side, leave left 200px clear. ';
    } else if (platform.includes('YouTube Thumbnail')) {
      safeZoneNote = 'SAFE ZONE: keep all content away from bottom-right corner. ';
    }

    const logoNote = hasLogo === 'yes'
      ? 'LOGO: incorporate the uploaded logo subtly in the bottom-right or top-right corner, respecting safe zones. '
      : '';

    const refNote = hasReference === 'yes'
      ? 'STYLE REFERENCE: match the visual style, color palette, and typography feel of the uploaded reference image. '
      : '';

    if (mode === 'carousel') {
      const slideCount = i.slide_count || '5';
      const narrative = i.carousel_narrative || '';
      return `Generate an image generation prompt for slide 1 of a ${slideCount}-slide carousel.

Platform: ${platform}
Visual style: ${style}
Typography hierarchy: ${hierarchy}
Brand colors (use ONLY these): ${colors}
Headline: ${headline}
Subtitle: ${subtitle}
CTA: ${cta}
Carousel narrative arc: ${narrative}
${safeZoneNote}${logoNote}${refNote}
Additional notes: ${notes}

This is slide 1 — it must be the HOOK slide that stops scrolling. The visual style established here must be maintained across all ${slideCount} slides (consistent colors, typography, layout DNA).

Output ONLY the image generation prompt.`;
    }

    if (mode === 'premium_hero') {
      return `Generate a PREMIUM image generation prompt for pixel-perfect ad creative. Typography accuracy is critical — this is for paid advertising where every character must render perfectly.

Platform: ${platform}
Visual style: ${style}
Typography hierarchy: ${hierarchy}
Brand colors (use ONLY these): ${colors}
Headline: ${headline}
Subtitle: ${subtitle}
CTA: ${cta}
${safeZoneNote}${logoNote}${refNote}
Additional notes: ${notes}

Emphasize: crisp sharp text rendering, professional advertising aesthetic, no distortion, pixel-perfect typography. This will be used in paid media — quality is paramount.

Output ONLY the image generation prompt.`;
    }

    // single_graphic and multi_platform_set
    return `Generate an image generation prompt for a social media graphic.

Platform: ${platform}
Visual style: ${style}
Typography hierarchy: ${hierarchy}
Brand colors (use ONLY these): ${colors}
Headline: ${headline}
Subtitle: ${subtitle}
CTA: ${cta}
${safeZoneNote}${logoNote}${refNote}
Additional notes: ${notes}

Output ONLY the image generation prompt.`;
  },
};

// Platform → fal.ai image_size mapping (used by execute-task route)
export const GUS_PLATFORM_SIZES: Record<string, string | { width: number; height: number }> = {
  'Instagram Post Square (1080x1080)': 'square_hd',
  'Instagram Post Vertical (1080x1350)': { width: 1080, height: 1350 },
  'Instagram Story (1080x1920)': 'portrait_9_16',
  'Instagram Reel Cover (1080x1920)': 'portrait_9_16',
  'LinkedIn Post (1200x627)': { width: 1200, height: 627 },
  'LinkedIn Post Square (1200x1200)': 'square_hd',
  'LinkedIn Cover (1584x396)': { width: 1584, height: 396 },
  'X/Twitter Post (1200x675)': 'landscape_16_9',
  'Facebook Post (1200x630)': { width: 1200, height: 630 },
  'Facebook Cover (820x312)': { width: 820, height: 312 },
  'Pinterest Pin (1000x1500)': { width: 1000, height: 1500 },
  'TikTok Cover (1080x1920)': 'portrait_9_16',
  'YouTube Thumbnail (1280x720)': 'landscape_16_9',
  'YouTube Community Post (1200x900)': { width: 1200, height: 900 },
};

// Mode → image count mapping
export const GUS_MODE_IMAGE_COUNT: Record<string, number> = {
  single_graphic: 2,
  multi_platform_set: 4,
  carousel: -1, // variable — use slide_count field
  premium_hero: 4,
};

// Mode → fal.ai model mapping
export const GUS_MODE_MODEL: Record<string, string> = {
  single_graphic: 'fal-ai/nano-banana-2',
  multi_platform_set: 'fal-ai/nano-banana-2',
  carousel: 'fal-ai/nano-banana-2',
  premium_hero: 'fal-ai/nano-banana-pro',
};
