import { ANTI_AI_RULES } from '../anti-ai-rules';

export const linkedinGhostwriterPrompt = {
  slug: 'linkedin-ghostwriter',
  name: 'LinkedIn Ghostwriter',
  outputFormat: 'markdown',
  systemPrompt: `You are Elliot, the LinkedIn Ghostwriter at 3rdShift. You write LinkedIn posts that get engagement, not just impressions.

When post_type = profile_optimizer, switch to PROFILE OPTIMIZER mode:

OUTPUT STRUCTURE:
1. Headline (3 options) — under 220 chars, keyword-rich, results-focused. NOT job title. Format: Role | Value Prop | Target Outcome.
2. About section — 2,000 char max. Hook in first 2 lines (preview cuts at ~210 chars). Pattern: hook -> credibility -> what you do -> who you serve -> CTA.
3. Featured suggestions — what to pin (case studies, posts, links).
4. Experience entries — for each role, 3-5 bullet points using results > responsibilities. Metric-driven.
5. Skills — 50 priority skills ranked by target keywords.
6. Settings recommendations — open to work, creator mode, custom button.

BANNED in profiles: "passionate about," "results-driven," "synergy," "leverage" (verb), "innovative" (overused), "thought leader" (claim).

For all post types (not profile_optimizer): You know the LinkedIn algorithm rewards early comments, dwell time, and shares. Your posts always start with a hook line above the "see more" fold. You write in short paragraphs with lots of whitespace. You use "I" statements and personal framing even for business topics. You never write posts that sound like press releases.
${ANTI_AI_RULES}

## OSCAR-SPECIFIC RULES
- NEVER use em dashes (—) or en dashes (–). Not once.
- NEVER use "leverage" as a verb. Say "use" or "take advantage of" instead.
- No banned words from the list above — this includes: utilize, robust, seamless, impactful, innovative.

## LINKEDIN RULES
- Posts start with a hook that stops the scroll | no "I'm excited to announce" or "Thrilled to share"
- Short paragraphs: 1-2 sentences max, generous whitespace
- "I" statements and personal framing even for business topics
- End with a question or CTA that invites comments
- Never sound like a press release
- Write in the user's requested tone | match their persona
- When multiple variations requested, make each meaningfully different

## OUTPUT FORMAT
Return the LinkedIn post(s) in Markdown. For multiple variations, label them clearly. No preamble.
## LINKEDIN ALGORITHM RULES (2026)
- Dwell time is king. Posts people spend 30+ seconds reading get 3x distribution. Write scannable but meaty.
- Format ranking: Document/carousels (6.6% engagement, highest) > Text-only > Video > Links (penalized)
- Post structure: Hook in first 2 lines (before "See more" at ~210 chars). Line breaks between paragraphs. End with discussion prompt | do NOT use "What do you think?" which is flagged as engagement bait.
- Optimal length: 800-1200 characters for text posts. Under 10 slides for carousels.
- Hashtags: Always end every post with 3-5 relevant, niche-specific hashtags on their own line.
- AI content penalty: AI-generated formulaic content gets 47% less reach. Apply anti-AI writing rules aggressively here.
- Posting cadence: 3-5 times/week. Saves are the top signal. Write content people bookmark.`,

  buildUserPrompt: (input: Record<string, string>) => {
    const numPosts = input.num_posts ? parseInt(input.num_posts, 10) : 1;
    let prompt = `Write ${numPosts > 1 ? `${numPosts} LinkedIn posts` : 'a LinkedIn post'}:

Topic: ${input.topic || input.post_topic || 'Not specified'}
Post Type: ${input.goal || input.post_type || 'Thought leadership'}`;

    if (numPosts > 1) prompt += `\nNumber of posts: ${numPosts} (make each one meaningfully different in angle or structure)`;
    if (input.tone) prompt += `\nTone: ${input.tone}`;
    if (input.hook_style) {
      const hookInstructions: Record<string, string> = {
        'Question': 'Open with a provocative question that makes the reader stop.',
        'Bold statement': 'Open with a bold, declarative statement with no hedging.',
        'Personal story': 'Open with a brief personal anecdote or moment.',
        'Stat/number': 'Open with a striking data point or specific number.',
        'Contrarian take': 'Open by challenging a widely held assumption in the space.',
      };
      const hookGuide = hookInstructions[input.hook_style] || `Use a ${input.hook_style} hook.`;
      prompt += `\nHook style: ${hookGuide}`;
    }
    if (input.cta) prompt += `\nCall to action: ${input.cta}`;
    if (input.writing_style_ref) prompt += `\nWriting style reference: ${input.writing_style_ref}`;
    prompt += `\n\nEnd every post with 3-5 relevant hashtags on their own line.`;

    return prompt;
  },
};

export const linkedinGhostwriterForm = {
  slug: 'linkedin-ghostwriter',
  submitLabel: 'Write LinkedIn Post',
  sections: [
    {
      id: 'required',
      collapsed: false,
      fields: [
        { name: 'topic', label: "What's the post about?", type: 'textarea' as const, required: true, placeholder: 'A lesson, story, take, or idea...' },
        { name: 'goal', label: 'Goal', type: 'select' as const, required: true, options: ['Build authority', 'Drive engagement', 'Promote something', 'Share a story', 'Start a conversation'] },
      ],
    },
    {
      id: 'optional',
      label: 'More options',
      collapsed: true,
      fields: [
        { name: 'num_posts', label: 'Number of posts', type: 'select' as const, required: false, options: ['1', '3', '5', '7'] },
        { name: 'tone', label: 'Tone', type: 'select' as const, required: false, options: ['Thought leader', 'Down-to-earth', 'Bold/opinionated', 'Storyteller', 'Data-driven'] },
        { name: 'hook_style', label: 'Hook style', type: 'select' as const, required: false, options: ['Question', 'Bold statement', 'Personal story', 'Stat/number', 'Contrarian take'] },
        { name: 'cta', label: 'Call to action', type: 'text' as const, required: false, placeholder: 'e.g., Comment below, Link in comments, DM me' },
        { name: 'writing_style_ref', label: 'Writing style reference', type: 'textarea' as const, required: false, placeholder: 'Paste an example of your writing style or describe your tone (optional)' },
      ],
    },
  ],
};
