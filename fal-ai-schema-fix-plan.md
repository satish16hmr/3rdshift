# fal.ai Schema Fix Plan

Prepared for: 3rdShift technical review  
Scope: `app/api/execute-task/route.ts` only  
Status: Planning handoff, no code changes applied in this document

## Summary

Three image workers are failing because their fal.ai request payloads still send `image_size`, while the current fal.ai model docs for the affected routes use `aspect_ratio`.

Affected workers:

- `logo-concept-generator`
- `social-media-graphics-designer`
- `thumbnail-designer`

Recommended fix: replace `image_size` with `aspect_ratio` in the fal.ai request bodies for these workers, using fal-supported ratio values such as `1:1`, `16:9`, `9:16`, `4:5`, and `3:4`.

## Current Failure Pattern

The failed Layer 1A audit errors were:

| Worker | Error |
|---|---|
| `logo-concept-generator` | `Image generation failed` |
| `social-media-graphics-designer` | `Image generation failed` |
| `thumbnail-designer` | `All image generations failed` |

These workers all route through `app/api/execute-task/route.ts` and call fal.ai directly.

## Current Code Patterns

### 1. Logo Concept Generator

File:

```text
app/api/execute-task/route.ts
```

Current refinement request body:

```ts
const falBody: Record<string, unknown> = {
  prompt: refinePrompt,
  image_size: 'square_hd',
  num_images: 1,
  enable_safety_checker: true,
};
```

Current initial-generation helper:

```ts
const body: Record<string, unknown> = {
  prompt,
  image_size: 'square_hd',
  num_images: 1,
  enable_safety_checker: true
};
```

Proposed replacement:

```ts
const falBody: Record<string, unknown> = {
  prompt: refinePrompt,
  aspect_ratio: '1:1',
  num_images: 1,
  enable_safety_checker: true,
};
```

```ts
const body: Record<string, unknown> = {
  prompt,
  aspect_ratio: '1:1',
  num_images: 1,
  enable_safety_checker: true
};
```

Classification: code bug.

## 2. Social Media Graphics Designer

Current code maps platform sizes to `image_size` values and custom pixel objects:

```ts
const GUS_PLATFORM_SIZES: Record<string, string | { width: number; height: number }> = {
  'Instagram Post Square (1080x1080)': 'square_hd',
  'Instagram Post Vertical (1080x1350)': { width: 1080, height: 1350 },
  'Instagram Story (1080x1920)': 'portrait_9_16',
  'LinkedIn Post (1200x627)': { width: 1200, height: 627 },
  'YouTube Thumbnail (1280x720)': 'landscape_16_9',
};

const imageSize = GUS_PLATFORM_SIZES[platform] || 'square_hd';

const falBody: Record<string, unknown> = {
  prompt: fluxPrompt,
  image_size: thisImageSize,
  num_images: 1,
  enable_safety_checker: true,
};
```

Proposed replacement:

```ts
const GUS_PLATFORM_RATIOS: Record<string, string> = {
  'Instagram Post Square (1080x1080)': '1:1',
  'Instagram Post Vertical (1080x1350)': '4:5',
  'Instagram Story (1080x1920)': '9:16',
  'Instagram Reel Cover (1080x1920)': '9:16',
  'LinkedIn Post (1200x627)': '16:9',
  'LinkedIn Post Square (1200x1200)': '1:1',
  'LinkedIn Cover (1584x396)': '4:1',
  'X/Twitter Post (1200x675)': '16:9',
  'Facebook Post (1200x630)': '16:9',
  'Facebook Cover (820x312)': '21:9',
  'Pinterest Pin (1000x1500)': '2:3',
  'TikTok Cover (1080x1920)': '9:16',
  'YouTube Thumbnail (1280x720)': '16:9',
  'YouTube Community Post (1200x900)': '4:3',
};

const aspectRatio = GUS_PLATFORM_RATIOS[platform] || '1:1';

const falBody: Record<string, unknown> = {
  prompt: fluxPrompt,
  aspect_ratio: thisAspectRatio,
  num_images: 1,
  enable_safety_checker: true,
};
```

For multi-platform mode, `thisImageSize` should become `thisAspectRatio`:

```ts
let thisAspectRatio = aspectRatio;
if (gusMode === 'multi_platform_set' && platformsMulti && platformsMulti[i]) {
  thisAspectRatio = GUS_PLATFORM_RATIOS[platformsMulti[i].trim()] || '1:1';
}
```

Classification: code bug plus input-normalization risk.

Risk note: the Layer 1A audit sent `platform: "LinkedIn"`, but the config expects exact labels like `LinkedIn Post (1200x627)`. The route currently falls back silently. The schema fix should unblock fal.ai, but a later hardening pass should normalize short platform names.

## 3. Thumbnail Designer

Current fal input type:

```ts
type KontextInput = {
  prompt: string;
  negative_prompt?: string;
  guidance_scale: number;
  num_inference_steps: number;
  num_images: number;
  image_url?: string;
  image_size?: string;
};
```

Current request input:

```ts
const input: KontextInput = {
  prompt,
  negative_prompt: NEGATIVE_PROMPT,
  guidance_scale: 3.5,
  num_inference_steps: 35,
  num_images: 1,
  image_size: 'landscape_16_9'
};
```

Proposed replacement:

```ts
type KontextInput = {
  prompt: string;
  negative_prompt?: string;
  guidance_scale: number;
  num_inference_steps: number;
  num_images: number;
  image_url?: string;
  aspect_ratio?: string;
};
```

```ts
const input: KontextInput = {
  prompt,
  negative_prompt: NEGATIVE_PROMPT,
  guidance_scale: 3.5,
  num_inference_steps: 35,
  num_images: 1,
  aspect_ratio: '16:9'
};
```

Classification: code bug / API schema mismatch.

## Notes Outside This Exact Fix

There is another fal.ai `image_size` usage in the Website Builder optional AI-image path:

```ts
body: JSON.stringify({
  prompt,
  image_size: 'landscape_16_9',
  num_images: 1,
  safety_tolerance: '2'
})
```

That worker was not included in this requested fix because its Layer 1A failure happened before optional image generation, during Claude JSON parsing. It should be reviewed separately if fal.ai schema cleanup is being done globally.

## Verification Plan

After code changes, run only narrow checks first:

1. Typecheck or lint the changed file if available.
2. Run `/api/health` and confirm `11/11 green` before any authenticated production-like test.
3. For any real worker-output test, use `codex-audit@3rdshift.ai`.
4. Include task IDs for cleanup.
5. Grade generated image output A/B/C/F per AGENTS.md.

No billing tables should be touched by a pure code review. If real task execution is tested, credit evidence may be required depending on the test path and whether credits are charged/refunded.

## Recommended Implementation Scope

Minimal PR:

- Edit only `app/api/execute-task/route.ts`.
- Replace fal.ai `image_size` keys with `aspect_ratio` for the three affected worker branches.
- Keep existing model names unchanged unless separately approved.
- Do not modify worker registry, billing, migrations, middleware, or env files.

Expected result:

- fal.ai requests match current schema for the affected workers.
- Layer 1A failures for the three image workers should move from API schema failure to either successful image output or a more specific provider/content error.
