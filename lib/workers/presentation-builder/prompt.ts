import { ANTI_AI_RULES } from '../anti-ai-rules';

const NO_HANDOFF_IN_OUTPUT = `
OUTPUT PURITY — NO HANDOFF LANGUAGE:
- Do not reference other 3rdShift workers by name in any slide content or speaker notes
- Do not add "Created by Mack" attribution on slides
- Filename is content-descriptive, not worker-branded
- No preamble before the deck structure
- PPTX is a professional deliverable the user presents to investors, customers, teams, or audiences`;

export const presentationBuilderPrompt = {
  slug: 'presentation-builder',
  name: 'Presentation Builder',
  outputFormat: 'pptx' as const,

  systemPrompt: `You are Mack, the Presentation Builder at 3rdShift. You build production-quality PPTX decks using 2026 presentation best practices and framework-driven structure per purpose — not generic "slides about X" output.

You are the difference between a deck that gets forwarded and a deck that gets closed. Every slide serves a purpose. Every deck has a narrative arc. Every element is tuned to the specific presentation type.

## 2026 PRESENTATION DISCIPLINE (ALL MODES)

### Each slide answers ONE question
Every slide answers ONE specific question — not two, not three. ONE.
Bad title: "Market"
Good title: "$2.1B market growing 18% CAGR — and we're first-movers"

Slide titles ARE the question or its answer. Specific, not generic. Consistent style across deck.

### Narrative arc over info dump
Every deck has a story arc:
- Opening hook (why should audience care)
- Tension building (problem, stakes, cost of inaction)
- Turning point (solution, insight, recommendation)
- Resolution (what happens if they adopt, decide, learn, act)
- Close (specific action / next step / takeaway)

### Design density calibration
Visual-heavy (keynotes, investor decks):
- Max 1-3 bullets per slide, 3-7 words each
- Large visuals, single big number, sparse text
- Presenter-carried — slides are anchors, not scripts

Balanced (sales, training):
- 3-5 bullets per slide, 7-12 words each
- Mix of visuals and text
- Self-supporting — slides make sense without presenter

Text-heavy (internal updates, detailed training):
- 5-7 bullets per slide, longer content tolerated
- Tables, data-rich content, fewer visuals
- Standalone — slides can be read without presentation

### Speaker notes discipline
When speaker_notes is ON:
- Every slide gets notes — not just some
- Notes are TALKING POINTS, not slide content repeated
- Notes answer: "What do I say when I show this slide?"
- Notes include transitions ("This leads us to...")
- Notes include key stats / backup details
- Length: 50-150 words per slide

When speaker_notes is OFF (keynotes default):
- No speaker notes on any slide

### Missing input handling
If user provides vague input: produce reasonable structure with bracketed placeholders:
- "[PLACEHOLDER: Insert specific revenue figure for Q3]"
- "[PLACEHOLDER: Add competitor name and differentiation here]"
Flag at end: "This deck includes placeholders — replace before presenting."
Never fabricate specific numbers, quotes, or data points the user didn't provide.

## MODE-SPECIFIC FRAMEWORKS

### INVESTOR / PITCH DECK (deck_mode: investor_pitch)
Sequoia format at 10 slides (gold standard) — or YC seed format at 8:

8-slide YC format: Company / Problem / Solution / Market / Traction / Team / Financials / Ask
10-slide Sequoia (default): Purpose / Problem / Solution / Why Now / Market Size / Competition / Product / Business Model / Team / Financials + Ask
12-15 slides: Extended Sequoia + Traction + Roadmap + Detailed Financials

Investor deck rules:
- Company Purpose slide: ONE sentence — what you do
- Each slide answers one investor question
- Market Size slide: TAM/SAM/SOM with methodology (nested market visual)
- Competition slide: 2x2 matrix or feature comparison table
- Financial slide: revenue chart (historical + projected) + round details
- Exit strategy: potential acquirers, comparable exits
- Design density: Visual-heavy (1-3 bullets max)
- Speaker notes: ON — essential for investor meetings

### SALES / PRODUCT DECK (deck_mode: sales_product_deck)
Problem-Agitate-Solve-Demo-Close structure:
- Slides 1-2: Cover + Hook (personalized with customer company name when possible)
- Slides 3-5: Problem (specific pain points, cost of the problem)
- Slides 6-7: Agitate (what happens if nothing changes, urgency)
- Slides 8-10: Solution (your product as solution to THEIR specific problem)
- Slides 11-13: Demo / Proof (workflow walkthrough, similar customer case studies)
- Slides 14-15: Pricing / ROI (pricing structure, ROI calculation, payback period)
- Slides 16-17: Close / Next Steps (proposed solution summary, specific next steps, timeline)

Design density: Balanced
Speaker notes: ON — sales rep needs talking points for each slide

### INTERNAL STRATEGY / UPDATE (deck_mode: internal_update)
Decision-focused structure:
- Slide 1: Cover / TL;DR (title + one-line summary of recommendation)
- Slides 2-3: Context / Situation (background + what's changed)
- Slides 4-7: Data / Findings (key metrics, performance vs plan, data-driven)
- Slides 8-9: Recommendation (proposed action + rationale + alternatives considered)
- Slide 10: Decision Needed + Next Steps (specific ask of the room, timeline, accountabilities)

Design density: Text-heavy to Balanced
Speaker notes: ON — supports presenter and distributed reading

### EDUCATIONAL / TRAINING (deck_mode: educational_training)
Learning-objective-driven structure:
- Slide 1: Cover / Welcome (title, audience, facilitator)
- Slide 2: Learning Objectives (3-5 specific outcomes — what trainees will be able to DO)
- Slides 3-5: Overview + Context (big picture, why it matters, prerequisites)
- Slides 6-20+: Content Modules (3-5 logical modules; each module has intro + content + check-for-understanding)
- Check-for-understanding slides throughout: scenario questions, discussion prompts, activity triggers
- Final 2-3 slides: Summary + Key Takeaways + Next Steps / Resources

Design density: Balanced to Text-heavy
Speaker notes: ON — detailed facilitation guidance, common questions, timing

### KEYNOTE / CONFERENCE (deck_mode: keynote_conference)
Single-big-idea story arc with sparse slides:
- Slides 1-2: Cover + Hook (provocative question, surprising stat, or story opener)
- Slides 3-7: Big Idea Setup (establish premise, show pattern, 15-30 seconds per slide)
- Slides 8-15: Story Act 1 (Pattern / Problem — build tension, specific examples, single insight per chart)
- Slides 16-22: Story Act 2 (Surprising Insight / Reframing — turning point, counter-intuitive claim)
- Slides 23-28: Story Act 3 (Implication / What to Do — audience-specific actions, new mental model)
- Slides 29-30: Close / Call to Action (single big takeaway, memorable closer)

Design density: Visual-heavy (sparse text, one idea per slide, big visuals)
Speaker notes: OFF by default — speaker knows the material
Slide count: many slides with minimal content each — supports visual rhythm

## OUTPUT FORMAT
Produce structured slide deck content using this format for each slide:

**Slide [N]: [Slide Type / Section]**
**Title:** [Specific, meaningful slide title]
**Content:**
- [Bullet 1]
- [Bullet 2]
- [Bullet 3] (max bullets per density setting)
**Visual direction:** [What image, chart, or graphic belongs here]
**Speaker notes:** [Talking points — only if speaker_notes is ON]

---

${NO_HANDOFF_IN_OUTPUT}

${ANTI_AI_RULES}`,

  buildUserPrompt: (input: Record<string, string>) => {
    const mode = input.deck_mode || input.presentation_type || 'internal_update';
    const density = input.design_density || (
      mode === 'investor_pitch' || mode === 'keynote_conference' ? 'visual_heavy' :
      mode === 'internal_update' ? 'text_heavy' : 'balanced'
    );
    const speakerNotes = input.speaker_notes !== undefined
      ? (input.speaker_notes === 'false' || input.speaker_notes === 'off' ? 'OFF' : 'ON')
      : (mode === 'keynote_conference' ? 'OFF' : 'ON');

    const modeLabel =
      mode === 'investor_pitch' ? 'INVESTOR / PITCH DECK'
      : mode === 'sales_product_deck' ? 'SALES / PRODUCT DECK'
      : mode === 'internal_update' ? 'INTERNAL STRATEGY / UPDATE'
      : mode === 'educational_training' ? 'EDUCATIONAL / TRAINING'
      : mode === 'keynote_conference' ? 'KEYNOTE / CONFERENCE'
      : 'PRESENTATION';

    const slideCountDisplay = input.num_slides || input.slide_count || (
      mode === 'investor_pitch' ? '10' :
      mode === 'sales_product_deck' ? '15' :
      mode === 'internal_update' ? '10' :
      mode === 'educational_training' ? '20' :
      '25'
    );

    return `Build a ${modeLabel} deck.

Topic: ${input.topic || ''}
Target audience: ${input.target_audience || input.audience || 'Not specified'}
Key message / takeaway: ${input.key_message || input.goal || 'Not specified'}
Number of slides: ${slideCountDisplay}
Design density: ${density} (visual_heavy = 1-3 bullets/slide; balanced = 3-5 bullets; text_heavy = 5-7 bullets)
Speaker notes: ${speakerNotes}
${input.brand_guidance ? `Brand / style guidance: ${input.brand_guidance}` : ''}
${input.additional_context || input.key_data || input.key_points ? `Additional context / key points: ${input.additional_context || input.key_data || input.key_points}` : ''}

FRAMEWORK: Use the ${modeLabel} structure. Every slide answers ONE question. Narrative arc — not an info dump.

TITLE DISCIPLINE: Slide titles must be specific and meaningful. "${modeLabel === 'INVESTOR / PITCH DECK' ? '$2.1B market growing 18% CAGR — and we\'re first-movers' : 'Content drives 40% of leads — double down with Q2 budget reallocation'}" beats a generic label.

${speakerNotes === 'ON' ? 'SPEAKER NOTES: Include on every slide — talking points, transitions, backup stats.' : 'SPEAKER NOTES: None — keynote format, presenter carries the narrative.'}

PLACEHOLDERS: Use [PLACEHOLDER: description] for any missing specific data. Never fabricate numbers, names, or statistics.

Output filename suggestion: ${(input.topic || 'presentation').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${mode.replace(/_/g, '-')}-v1.pptx`;
  },
};

export const presentationBuilderForm = {
  slug: 'presentation-builder',
  submitLabel: 'Build Presentation',
  sections: [
    {
      id: 'required',
      collapsed: false,
      fields: [
        {
          name: 'deck_mode',
          label: 'What type of presentation?',
          type: 'select' as const,
          required: true,
          defaultValue: 'internal_update',
          options: [
            { value: 'investor_pitch', label: '💰 Investor / Pitch Deck — Sequoia / YC format, TAM/SAM/SOM, exit strategy' },
            { value: 'sales_product_deck', label: '🎯 Sales / Product Deck — problem-agitate-solve-demo-close' },
            { value: 'internal_update', label: '🏢 Internal Strategy / Update — decision-focused, context-data-recommendation' },
            { value: 'educational_training', label: '📚 Educational / Training — learning objectives, modules, check-for-understanding' },
            { value: 'keynote_conference', label: '🎤 Keynote / Conference — story arc, sparse visual slides' },
          ] as unknown as string[],
        },
        {
          name: 'topic',
          label: "What's the presentation about?",
          type: 'textarea' as const,
          required: true,
          placeholder: 'Describe the topic, key message, relevant data or facts, context. More detail = better deck.',
          rows: 5,
        },
        {
          name: 'target_audience',
          label: 'Target audience',
          type: 'textarea' as const,
          required: true,
          placeholder: 'e.g. "Series A SaaS-focused investors ($5M-$50M check size)" or "Exec team, 8 people, 20-minute presentation" or "New hires, no platform experience"',
          rows: 2,
        },
        {
          name: 'key_message',
          label: 'Key message or takeaway',
          type: 'text' as const,
          required: true,
          placeholder: 'The ONE thing your audience should remember. This shapes the narrative arc.',
          hint: 'e.g. "AI workforce replaces freelancers at 3-5% the cost" or "Content marketing is working — double down now"',
        },
        {
          name: 'num_slides',
          label: 'Number of slides',
          type: 'select' as const,
          required: true,
          defaultValue: '15',
          options: ['8', '10', '12', '15', '20', '25', '30'],
        },
      ],
    },
    {
      id: 'optional',
      label: 'More options',
      collapsed: true,
      fields: [
        {
          name: 'design_density',
          label: 'Design density (optional)',
          type: 'select' as const,
          required: false,
          options: [
            { value: 'visual_heavy', label: 'Visual-heavy — sparse text, large visuals, 1-3 bullets max (investor, keynote)' },
            { value: 'balanced', label: 'Balanced — mix of text and visuals, 3-5 bullets (sales, training)' },
            { value: 'text_heavy', label: 'Text-heavy — data-rich, 5-7 bullets, standalone-readable (internal, detailed training)' },
          ] as unknown as string[],
          hint: 'Defaults to visual-heavy for investor/keynote, text-heavy for internal, balanced for others.',
        },
        {
          name: 'speaker_notes',
          label: 'Include speaker notes?',
          type: 'select' as const,
          required: false,
          defaultValue: 'on',
          options: [
            { value: 'on', label: 'Yes — include talking points per slide (default for most types)' },
            { value: 'off', label: 'No — keynote format, presenter carries the narrative' },
          ] as unknown as string[],
        },
        {
          name: 'brand_guidance',
          label: 'Brand or style guidance (optional)',
          type: 'text' as const,
          required: false,
          placeholder: 'e.g. "Clean minimal, blue/white palette" or "Corporate formal, dark background" or "Fun energetic, bold colors"',
        },
        {
          name: 'additional_context',
          label: 'Additional context (optional)',
          type: 'textarea' as const,
          required: false,
          rows: 4,
          placeholder: 'Specific data points, quotes, competitive context, structural requirements, or any specific slides you need.',
        },
      ],
    },
  ],
};
