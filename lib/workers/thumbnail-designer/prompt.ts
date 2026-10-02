// Reed Thumbnail Designer — Nano Banana Pro thumbnail pipeline
// Native in-image headline rendering is preferred; client-side canvas overlay is fallback only.

export type ReedConcept = {
  scene?: string;
  subject_pose?: string;
  expression?: string;
  background_elements?: string[];
  text_headline?: string;
  color_accents?: string[];
  props?: string[];
};

export type ReedVariation = {
  composition: string;
  palette: string;
  textZone: string;
  treatment: string;
  prompt: string;
};

export const REED_MODEL = 'fal-ai/nano-banana-pro';
export const REED_FACE_FALLBACK_MODEL = 'fal-ai/flux-pro/kontext';

export const STYLE_PROMPTS: Record<string, string> = {
  cinematic: 'extreme close-up potential, rim lighting, shallow depth of field, high contrast, filmic shadows, premium YouTube drama',
  bright: 'bright viral thumbnail style, saturated colors, crisp lighting, simple readable shapes, high-energy contrast',
  dark: 'dark dramatic thumbnail style, deep blacks, hard highlights, red or blue edge light, urgent ominous atmosphere',
  minimal: 'clean minimal thumbnail style, one strong focal subject, uncluttered background, premium modern clarity',
  gaming: 'gaming thumbnail style, dynamic action, neon glow, exaggerated emotion, high contrast effects, bold readable focal points',
  corporate: 'business YouTube thumbnail style, polished professional lighting, clean props, confident face-forward composition',
  podcast: 'podcast cover thumbnail style, face-dominant composition, studio lighting, timeless bold editorial framing',
  news: 'news thumbnail style, urgent headline energy, bold editorial layout, high contrast, clear visual evidence elements',
  lifestyle: 'lifestyle thumbnail style, warm human authenticity, natural but punchy color, aspirational framing',
  custom: 'custom style from the user brief, translated into a premium YouTube thumbnail with strong focal hierarchy',
};

export const COMPOSITION_AXES = [
  'extreme close-up face-dominant frame, face large on one side, direct eye contact, hand or prop entering foreground',
  'split-screen composition with clean-vs-cluttered contrast, subject bridging the two halves, clear visual comparison',
  'subject plus oversized prop composition, foreground prop or evidence element huge, subject reacting beside it',
];

export const PALETTE_AXES = [
  'black and red accent palette with hot rim light and urgent danger energy',
  'teal-orange cinematic palette with bright skin tones and warm highlight contrast',
  'high-key white/yellow/blue palette with bold clean commercial brightness',
];

export const TEXT_ZONES = [
  'lower-third text zone, kept away from the face and main hand gesture',
  'upper-left text zone, balanced against the face on the opposite side',
  'right-half text zone, large stacked headline in open negative space',
];

export const TEXT_TREATMENTS = [
  'huge condensed bold sans-serif, white fill, thick black stroke, subtle red glow',
  'blocky editorial type, yellow/white fill, black drop shadow, slight 2-degree rotation',
  'clean premium sans-serif, white fill, red underline/accent slash, crisp shadow',
];

export const PLATFORM_ASPECT_RATIOS: Record<string, { aspectRatio: string; sizeLabel: string }> = {
  youtube: { aspectRatio: '16:9', sizeLabel: '1280×720' },
  'youtube (16:9)': { aspectRatio: '16:9', sizeLabel: '1280×720' },
  'youtube shorts (9:16)': { aspectRatio: '9:16', sizeLabel: '1080×1920' },
  shorts: { aspectRatio: '9:16', sizeLabel: '1080×1920' },
  'podcast cover (1:1)': { aspectRatio: '1:1', sizeLabel: '1400×1400' },
  podcast: { aspectRatio: '1:1', sizeLabel: '1400×1400' },

  'square social (1:1)': { aspectRatio: '1:1', sizeLabel: '1080×1080' },
  square: { aspectRatio: '1:1', sizeLabel: '1080×1080' },
};

export function normalizeReedStyle(style: string | undefined): string {
  const raw = (style || 'cinematic').toLowerCase();
  const key = raw.split(/\s*[-—]/)[0].trim();
  return STYLE_PROMPTS[key] ? key : 'cinematic';
}

export function getReedPlatformSpec(platform: string | undefined): { aspectRatio: string; sizeLabel: string } {
  const key = (platform || 'youtube').toLowerCase().trim();
  return PLATFORM_ASPECT_RATIOS[key] || PLATFORM_ASPECT_RATIOS.youtube;
}

export function formatReedConcept(concept: ReedConcept | string | undefined, fallbackDescription: string): string {
  if (typeof concept === 'string') return concept.trim() || fallbackDescription;
  const c = concept || {};
  const parts = [
    c.scene && `Scene: ${c.scene}`,
    c.subject_pose && `Subject pose: ${c.subject_pose}`,
    c.expression && `Expression: ${c.expression}`,
    c.background_elements?.length && `Background elements: ${c.background_elements.join(', ')}`,
    c.props?.length && `Props/evidence: ${c.props.join(', ')}`,
    c.color_accents?.length && `Color accents: ${c.color_accents.join(', ')}`,
  ].filter(Boolean);
  return parts.length ? parts.join('. ') : fallbackDescription;
}

export function buildReedThumbnailPrompts(params: {
  description: string;
  style: string;
  platform?: string;
  headlineText?: string;
  colorPreference?: string;
  concept?: ReedConcept | string;
  hasFace: boolean;
  hasSketch: boolean;
  hasBoth: boolean;
  nativeText?: boolean;
}): ReedVariation[] {
  const styleKey = normalizeReedStyle(params.style);
  const styleInstruction = STYLE_PROMPTS[styleKey];
  const platformSpec = getReedPlatformSpec(params.platform);
  const conceptText = formatReedConcept(params.concept, params.description || 'High-performing YouTube thumbnail concept');
  const headline = (params.headlineText || '').toUpperCase().trim();
  const colorPreference = (params.colorPreference || '').trim();

  let referenceInstruction = '';
  if (params.hasBoth) {
    referenceInstruction = 'Reference image includes both person and layout intent. Preserve the person from the face reference exactly, and follow the uploaded layout/style reference as composition guidance.';
  } else if (params.hasFace) {
    referenceInstruction = 'Use the uploaded reference image as the exact person to feature. Preserve THAT person’s likeness, facial structure, hair, skin tone, and identity. Do not invent a different person.';
  } else if (params.hasSketch) {
    referenceInstruction = 'Use the uploaded reference image as a style/layout reference. Follow its spatial composition and visual language while rendering the described thumbnail.';
  }

  return [0, 1, 2].map((i) => {
    const composition = COMPOSITION_AXES[i];
    const palette = PALETTE_AXES[i];
    const textZone = TEXT_ZONES[i];
    const treatment = TEXT_TREATMENTS[i];
    const textInstruction = headline
      ? params.nativeText !== false
        ? `Render the headline text natively inside the image: "${headline}". Text placement: ${textZone}. Text treatment: ${treatment}. The text must be legible, correctly spelled, and must not cover the face.`
        : `Leave clean negative space for the headline "${headline}". Text placement plan: ${textZone}. Do not render any words in the image.`
      : 'No headline text. Do not render any words, captions, watermarks, labels, or typography.';

    const prompt = [
      `Premium click-worthy thumbnail for ${platformSpec.sizeLabel} (${platformSpec.aspectRatio}).`,
      conceptText,
      `Variation ${i + 1} composition: ${composition}.`,
      `Variation ${i + 1} palette: ${palette}.`,
      colorPreference ? `User color preference: ${colorPreference}. Incorporate it while keeping this variation's palette distinct.` : '',
      styleInstruction,
      referenceInstruction,
      textInstruction,
      'Thumbnail-native art direction: exaggerated expression, clear story in one glance, bold foreground/background separation, high contrast, saturated but polished color, no generic stock-photo look, no duplicate composition from other variations.',
    ].filter(Boolean).join(' ');

    return { composition, palette, textZone, treatment, prompt };
  });
}

// Backward-compatible name for older call sites/tests.
export function buildKontextPrompt(
  description: string,
  style: string,
  hasFace: boolean,
  hasSketch: boolean,
  hasBoth: boolean,
  variationIndex: number
): string {
  return buildReedThumbnailPrompts({ description, style, hasFace, hasSketch, hasBoth, nativeText: false })[variationIndex % 3].prompt;
}

export const thumbnailDesignerForm = {
  slug: 'thumbnail-designer',
  submitLabel: 'Generate Thumbnails',
  sections: [
    {
      id: 'required',
      label: "Give me the details, and I'll get started.",
      collapsed: true,
      defaultOpen: true,
      fields: [
        {
          name: 'description',
          label: 'Describe your thumbnail',
          type: 'textarea' as const,
          required: true,
          placeholder: 'Close-up face calling out a bloated invoice, split background with clean $79/mo alternative, red accent lighting',
          helpText: 'Describe the scene, subject, mood, composition, props, and visual energy. Specific beats generic.',
        },
        {
          name: 'headline_text',
          label: 'Thumbnail text',
          type: 'text' as const,
          required: false,
          placeholder: 'THEY LIE!',
          helpText: 'Native in-image text. 1-4 words is best. Leave blank for text-free thumbnails.',
        },
        {
          name: 'style',
          label: 'Style',
          type: 'select' as const,
          required: true,
          options: [
            'cinematic — Dramatic lighting, moody, high contrast',
            'bright — Vibrant colors, energetic, eye-catching',
            'dark — Dark tones, intense, mysterious',
            'minimal — Clean, simple, professional',
            'gaming — Dynamic action, neon/glow effects, stylized',
            'corporate — Professional, clean, business-focused',
            'podcast — Title-dominant or face-dominant, timeless',
            'news — Headline-driven, bold typography, urgency',
            'lifestyle — Warm tones, natural feel, authentic',
            'custom — Describe your style in the description field',
          ],
        },
        {
          name: 'platform',
          label: 'Platform',
          type: 'select' as const,
          required: false,
          options: [
            'YouTube (16:9)',
            'YouTube Shorts (9:16)',
            'Podcast Cover (1:1)',

            'Square Social (1:1)',
          ],
          helpText: 'Drives aspect ratio and composition. YouTube (16:9) is the default.',
        },
        {
          name: 'color_preference',
          label: 'Color preference',
          type: 'text' as const,
          required: false,
          placeholder: 'Red accent lighting, teal/orange, brand colors, no purple',
          helpText: 'Optional. Reed preserves variation distinctness while respecting your color direction.',
        },
      ],
    },
    {
      id: 'optional',
      label: 'Reference image',
      collapsed: true,
      fields: [
        {
          name: 'face_photo',
          label: 'Your face photo',
          type: 'file-upload' as const,
          required: false,
          uploadType: 'image' as const,
          acceptedTypesLabel: 'JPG, PNG, WEBP',
          helpText: 'Upload your photo to appear in the thumbnail. Clear, well-lit face photos work best.',
        },
        {
          name: 'reference_image',
          label: 'Style reference or layout sketch',
          type: 'file-upload' as const,
          required: false,
          uploadType: 'image' as const,
          acceptedTypesLabel: 'JPG, PNG, WEBP',
          helpText: 'Upload a style reference (existing thumbnail you like) or a rough paper sketch of the layout. Reed reads the intent.',
        },
      ],
    },
  ],
};

// Keep this for configs.ts compatibility
export const thumbnailDesignerPrompt = {
  slug: 'thumbnail-designer',
  name: 'Thumbnail Designer',
  outputFormat: 'images' as const,
  systemPrompt: '',
  buildUserPrompt: (_input: Record<string, string>) => '',
};
