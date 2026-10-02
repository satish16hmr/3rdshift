export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { logDerivationRejection, extractRejectedFields } from '@/lib/derivation-log';
import { getWorkspaceOwnerPlan } from '@/lib/workspace';
import { callAI } from '@/lib/ai/callAI';
import { getWorkerBySlug } from '@/lib/workers/registry';
import { getWorkerPromptConfig } from '@/lib/workers/configs';
import { CHAT_BEHAVIOR_BASELINE, MODE_GATED_CHAT_PROTOCOLS } from '@/lib/workers/chat-baseline';

// Phase 4 — R7: strict input schema. member_id validated against worker registry below.
const ChatSendSchema = z.object({
  member_id: z.string().min(1),
  message: z.string().min(1),
  proactive_context: z.object({
    team_update_id: z.string(),
    suggestion_text: z.string(),
    parsed_icp: z.record(z.string(), z.string()),
  }).optional(),
}).strict();

// Rate limits per plan — monthly only (no hourly/daily caps)
const RATE_LIMITS: Record<string, { monthly?: number }> = {
  starter:  { monthly: 150 },
  pro:      { monthly: 1000 },
  operator: { monthly: 1500 },
};

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ChatSendSchema.safeParse(rawBody);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    // Log rejection — tells us if UI is still sending derived fields
    await logDerivationRejection({
      userId,
      workspaceId,
      route: '/api/chat/send',
      rejectedFields: extractRejectedFields(flat),
    });
    return NextResponse.json({ error: 'Invalid request body', details: flat }, { status: 400 });
  }

  let { member_id, message } = parsed.data;
  const proactiveContext = parsed.data.proactive_context;
  if (!message?.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  // Phase 4 — R7: validate member_id against worker registry
  const chatWorker = getWorkerBySlug(member_id);
  if (!chatWorker || !chatWorker.active) {
    return NextResponse.json({ error: 'Invalid team member' }, { status: 400 });
  }

  // Handle context-injection from task result page
  // Format: __context__:task_complete:<taskId>:<summary>
  if (message.startsWith('__context__:task_complete:')) {
    const parts = message.split(':')
    const summary = parts.slice(3).join(':') || 'a recent task'
    const personaName = member_id.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    message = `I just finished ${summary} for you. Want me to refine it, expand on any section, or take it in a different direction?`
  }

  // Load user profile (brand context) + workspace plan
  const [wsPlan, profileResult] = await Promise.all([
    getWorkspaceOwnerPlan(workspaceId),
    supabaseAdmin.from('profiles').select('brand_context').eq('id', userId).single(),
  ]);
  const plan = wsPlan;
  const profile = profileResult.data;

  // ── Rate limiting ─────────────────────────────────────────
  const limits = RATE_LIMITS[plan] ?? RATE_LIMITS.starter;
  const now = new Date();
  let chatRateCounted = false;
  let chatWindowStart: Date | null = null;

  // Load billing date for monthly window
  const { data: profileForLimits } = await supabaseAdmin
    .from('profiles').select('heavy_credits_reset_at').eq('id', userId).single();
  const billingResetAt = profileForLimits?.heavy_credits_reset_at
    ? new Date(profileForLimits.heavy_credits_reset_at) : null;
  const monthWindowStart = billingResetAt
    ? new Date(billingResetAt.getTime() - 30 * 24 * 60 * 60 * 1000)
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Monthly cap
  if (limits.monthly) {
    chatWindowStart = monthWindowStart;
    const { data: rateResult, error: rateError } = await (supabaseAdmin as any).rpc(
      'increment_chat_rate_limit',
      {
        p_user_id: userId,
        p_member_id: 'all',
        p_window_type: 'month',
        p_window_start: monthWindowStart.toISOString(),
        p_limit: limits.monthly,
      }
    );
    if (rateError) {
      console.error('[chat/send] increment_chat_rate_limit RPC error:', rateError.message);
      const { data: monthRow } = await supabaseAdmin
        .from('chat_rate_limits').select('msg_count')
        .eq('user_id', userId).eq('member_id', 'all').eq('window_type', 'month')
        .gte('window_start', monthWindowStart.toISOString()).maybeSingle();
      const monthCount = monthRow?.msg_count ?? 0;
      if (monthCount >= limits.monthly) {
        const resetDate = billingResetAt
          ? billingResetAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
          : 'your next billing date';
        return NextResponse.json(
          { error: `Monthly chat limit reached (${limits.monthly} messages). Resets on ${resetDate}.`, limit_hit: true, limit_type: 'monthly', resets_on: billingResetAt?.toISOString() },
          { status: 429 }
        );
      }
      await supabaseAdmin.from('chat_rate_limits').upsert({
        user_id: userId, member_id: 'all', window_type: 'month',
        msg_count: monthCount + 1, window_start: monthWindowStart.toISOString(), updated_at: now.toISOString(),
      }, { onConflict: 'user_id,member_id,window_type,window_start' });
      chatRateCounted = true;
    } else {
      const rateRow = Array.isArray(rateResult) ? rateResult[0] : rateResult;
      if (rateRow?.hit_limit) {
        const resetDate = billingResetAt
          ? billingResetAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
          : 'your next billing date';
        return NextResponse.json(
          { error: `Monthly chat limit reached (${limits.monthly} messages). Resets on ${resetDate}.`, limit_hit: true, limit_type: 'monthly', resets_on: billingResetAt?.toISOString() },
          { status: 429 }
        );
      }

      if (!rateRow?.ok) {
        return NextResponse.json({ error: 'Chat rate limit check failed. Please try again.' }, { status: 409 });
      }

      chatRateCounted = true;
    }
  }

  // No hourly or daily caps — monthly only

  // ── Save user message ────────────────────────────────────
  await supabaseAdmin.from('team_chat_messages').insert({
    user_id: userId,
    workspace_id: workspaceId,
    member_id,
    role: 'user',
    content: message,
  });

  // ── Load messages for sliding window + Haiku summary ──────────────────────
  // Fetch enough to detect sliding (load all up to 120 for summary purposes, but window = last 20)
  const { data: allHistory } = await supabaseAdmin
    .from('team_chat_messages')
    .select('id, role, content, deliverable_id')
    .eq('workspace_id', workspaceId)
    .eq('member_id', member_id)
    .order('created_at', { ascending: false })
    .limit(121); // 120 historical + the one we just inserted

  const allMessages = (allHistory ?? []).reverse();
  // Exclude the message we just inserted (last item after reverse+insert)
  const allPrior = allMessages.slice(0, -1);
  // Sliding window: last 20 messages = 10 exchanges
  const WINDOW_SIZE = 20;
  const recentMessages = allPrior.slice(-WINDOW_SIZE);
  // Messages outside the window (candidates for Haiku summary)
  const olderMessages = allPrior.length > WINDOW_SIZE ? allPrior.slice(0, -WINDOW_SIZE) : [];

  // ── Phase 2: Haiku summary of older messages ─────────────────────────────
  let conversationSummary: string | null = null;
  if (olderMessages.length > 0) {
    // Load cached summary
    const { data: cachedSummary } = await supabaseAdmin
      .from('chat_conversation_summaries')
      .select('summary, summarized_up_to_msg_id, message_count')
      .eq('workspace_id', workspaceId)
      .eq('member_id', member_id)
      .maybeSingle();

    const lastOlderMsg = olderMessages[olderMessages.length - 1];
    const needsUpdate = !cachedSummary ||
      cachedSummary.summarized_up_to_msg_id !== lastOlderMsg.id;

    if (!needsUpdate && cachedSummary) {
      // Use cached summary
      conversationSummary = cachedSummary.summary;
    } else {
      // Generate new Haiku summary
      try {
        const olderText = olderMessages
          .map(m => `${m.role === 'user' ? 'User' : 'Member'}: ${m.content}`)
          .join('\n\n');
        const haikusRes = await callAI({
          model_tier: 'haiku',
          system: 'You summarize conversation history concisely. Return only the summary, no preamble.',
          messages: [{
            role: 'user',
            content: `Summarize the following conversation history in under 200 tokens. Focus on:\n- Key decisions made\n- Important facts about the user or their business\n- Main topics discussed\n- Specific requests or preferences stated\n- Action items or next steps mentioned\n\nDo NOT include greetings, small talk, or filler. Only capture information useful for continuing this conversation.\n\nConversation:\n${olderText}`,
          }],
          max_tokens: 250,
        }, { user_id: userId, call_type: 'chat-summary', worker_id: member_id });
        conversationSummary = haikusRes.content.trim();
        // Cache it
        await supabaseAdmin.from('chat_conversation_summaries').upsert({
          workspace_id: workspaceId,
          member_id,
          summary: conversationSummary,
          summarized_up_to_msg_id: lastOlderMsg.id,
          message_count: olderMessages.length,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'workspace_id,member_id' });
        console.log('[3rdShift][ChatSummary]', JSON.stringify({
          member_id,
          older_messages_summarized: olderMessages.length,
          summary_chars: conversationSummary.length,
          haiku_input_tokens: haikusRes.tokens_used.input,
          haiku_output_tokens: haikusRes.tokens_used.output,
        }));
      } catch (summaryErr) {
        // Graceful failure — proceed without summary, never break the chat
        console.warn('[3rdShift][ChatSummary] Failed to generate summary:', summaryErr);
        conversationSummary = cachedSummary?.summary ?? null;
      }
    }
  }

  // history for backward-compat references (last 21 including just-inserted)
  const history = allHistory ?? [];

  // ── Detect if a deliverable was just generated (last member message has deliverable_id) ──
  // Walk backwards through history to find the most recent member message
  const lastMemberMsg = (history ?? []).find(m => m.role === 'member');
  const deliverableJustSent = !!(lastMemberMsg?.deliverable_id);

  // ── Load brand profile + memories ───────────────────────
  const { data: brandProfile } = await supabaseAdmin
    .from('brand_profile')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  const { data: memories } = await supabaseAdmin
    .from('team_member_memories')
    .select('memory_type, content')
    .eq('workspace_id', workspaceId)
    .is('invalidated_at', null)
    .or(`member_id.eq.${member_id},member_id.is.null`)
    .limit(10); // Cap at 10 memories — ranks 11+ are marginal, saves ~275 tokens

  // ── Build system prompt ──────────────────────────────────
  const worker = getWorkerBySlug(member_id);
  const promptConfig = getWorkerPromptConfig(member_id);
  const personaName = worker?.personaName || member_id;
  const workerTitle = worker?.name || member_id;

  // Worker-specific chat personality overrides
  const CHAT_OVERRIDES: Record<string, string> = {
    'thumbnail-designer': `You are Reed, a professional Thumbnail Designer. You make YouTube thumbnails — bold, clean, click-worthy.

CAPABILITIES:
- Generate ANY visual concept directly from chat once the needed details are present
- Collect missing required fields conversationally: visual concept, style, platform, and face photo only when the user wants to be in it. Platform options are YouTube (16:9), YouTube Shorts (9:16), Podcast Cover (1:1), or Square Social (1:1).
- Face photos are OPTIONAL — only use them when the user specifically wants their face in it
- Do NOT default to "use your face" for concept thumbnails
- Never redirect to the form when chat already has enough information
- Never ask the user to copy-paste a description you already wrote; use the conversation context

CONTEXT AWARENESS — CRITICAL:
- READ THE FULL CONVERSATION before asking any questions
- If the topic, headline, and visual concept are already discussed, DO NOT ask again
- Only ask for information that is genuinely missing from the conversation
- If you have: (1) visual concept/scene, (2) style, and (3) platform, summarize the concept in one short confirmation and generate when the user asks/affirms. If the user already asked you to make/create/generate it, generate immediately.

COPYRIGHT:
- Cannot generate: named celebrities, Disney/Marvel characters, exact movie scenes
- Offer creative alternatives that match the vibe: "Can't do Mary Poppins exactly, but I can generate a woman in a Victorian dress floating over a rooftop with an umbrella — same aesthetic, no copyright issue. Want that?"
- The aesthetic, costume, and vibe of any character is fair game — only the character's name/likeness is protected

RULES:
- Never mention credits, costs, or pricing
- Never ask about secondary text, subtitles, or additional text
- If user says no text/no headline, acknowledge it and generate WITHOUT a headline
- Headline: 1–4 words, ALL CAPS — ONLY if user wants text

WHEN TO GENERATE — add GENERATE_DELIVERABLE on its own line:
✅ User explicitly asks: "make it", "generate", "do it", "go ahead", "create it", "yes" after your summary
✅ User describes a complete concept and says nothing more — they're waiting for you to make it
✅ User sends a nudge like "go" or "do it" or "generate now"
✅ FIRST message where user gives a full concept + headline (don't make them confirm twice)
❌ NEVER for: "thanks", "cool", "ok", "got it", casual chat not asking for generation
❌ NEVER re-ask for info that's already in the conversation
❌ If user says "generating" but you already just fired one in the last 30 seconds, do NOT generate again — say "I just sent it, the card should appear in a moment."

IMPORTANT — DO NOT PROMISE THEN FAIL:
- Only say "Generating now" or "On it" if you are ALSO adding GENERATE_DELIVERABLE in that same response
- If you are NOT generating (e.g. asking a clarifying question), do NOT say "generating now" or "on it"
- These two things must always match: what you say AND whether GENERATE_DELIVERABLE is present

AFTER GENERATING: Say "Here are your thumbnails — let me know if you want any changes." and WAIT.

REFINEMENT AFTER DELIVERING:
- If the user says anything negative about what you just made ("why did you add X", "remove X", "no faces", "that's wrong", "try again", "don't do X") — this IS a generation request. Acknowledge the change, confirm the new concept, and add GENERATE_DELIVERABLE.
- Do NOT ask "want me to generate?" — just do it. They're telling you it's wrong, not asking if you can fix it.
- This refinement generation bypasses the normal cooldown — it will fire immediately.`,
  };

  // KPI Dashboard Writer chat override — consultant mode (short answers + form nudge for full frameworks)
  CHAT_OVERRIDES['kpi-dashboard-writer'] = `You are Brody, the KPI Architect at 3rdShift. NEVER say "same answer as before", "as I mentioned", "as I said", or any phrase that implies repetition. Every response stands on its own. You are the go-to consultant for KPI strategy, metric selection, and dashboard design.

YOUR THREE CHAT USE CASES:
1. Form field help — "What counts as a blind spot?" / "How specific should my quarterly goal be?" / "Should I pick Notion or Google Sheets?" → direct, specific answer. No redirect needed.
2. Quick one-off KPI questions — "Is NPS a vanity metric?" / "What's a good input metric for a pre-launch ecom store?" / "What's a good North Star for a Shopify store doing $50K/mo?" → short reasoned answer (under 400 tokens). Then optionally: "If you want a full framework customized to your business, the Form builds it with all metric cards, a dashboard build plan, and an XLSX tracker."
3. Framework guidance — "Should my North Star be MRR or NRR?" / "What should I measure first?" → short answer with reasoning, then form nudge.

WHAT CHAT MUST NOT DO:
- Never produce a full 10-section framework with all metric cards and formulas in chat
- Never generate metric cards with all 7 fields (Name, Definition, Formula, Data Source, Frequency, Target, Viz Type)
- Never generate an XLSX, DOCX, or PDF from chat
- If user starts describing their full business to get a complete framework built in chat: after you understand their business + goal, say: "This is exactly what the Form is built for — it captures everything I need and returns a full downloadable framework with PDF, DOCX, and a ready-to-fill XLSX tracker. Want to jump over, or keep going here?"
- If they say keep going: collect inputs conversationally, deliver a concise framework SUMMARY (North Star + 3-4 key metrics, no full cards), then say: "The Form gives you the full framework with all metric definitions, formulas, data sources, and your XLSX tracker pre-filled. Takes 60 seconds."
- NEVER refuse to help. NEVER say "you must use the form."

TONE: Direct, no filler. You're a strategist. Keep responses tight — you have a 400-token limit.`;

  // ── Consultant-only workers (chatCanGenerate: false) — form nudge pattern ──────

  CHAT_OVERRIDES['bookkeeping-summarizer'] = `You are Bella, the Bookkeeping Summarizer at 3rdShift. NEVER say "same answer as before", "as I mentioned", or any phrase implying repetition. Each response stands on its own.

YOUR THREE CHAT USE CASES:
1. Bookkeeping category questions — "How should I categorize subscription software?" / "What counts as COGS?" → direct, specific answer.
2. File prep help — "What format works best?" / "My CSV has extra columns, what should I do?" → helpful guidance.
3. Form field help — "What goes in the time period field?" → clear explanation.

WHAT CHAT MUST NOT DO:
- Never produce a full bookkeeping summary, P&L, or categorized transaction list in chat.
- If user pastes transactions one at a time or in bulk: "Upload your file to the Form — CSV or XLSX works best. I can categorize hundreds of transactions in one pass there and return a PDF report + XLSX. Want to keep asking bookkeeping questions here in the meantime?"
- Never say "you must use the form" or refuse to help. Chat stays available.

TONE: Clear, direct. You know bookkeeping. 400-token limit.`;

  CHAT_OVERRIDES['resume-screener'] = `You are Knox, the Resume Screener at 3rdShift. NEVER say "same answer as before", "as I mentioned", or any phrase implying repetition. Each response stands on its own.

YOUR THREE CHAT USE CASES:
1. Hiring/HR questions — "What makes a strong product manager resume?" / "What red flags should I watch for?" → direct answer.
2. Form field help — "What should I put for job requirements?" / "How many candidates can I screen at once?" → clear guidance.
3. Interview/process questions — "What questions should I ask for a sales role?" → helpful suggestions.

WHAT CHAT MUST NOT DO:
- Never produce a full candidate shortlist, scored ranking, or screening report in chat.
- If user pastes resume text or a large candidate list: "The Form captures this cleanly — paste your candidates and job requirements there and I'll return a scored shortlist with notes. Want to keep asking hiring questions here?"
- Never say "you must use the form" or refuse to help. Chat stays available.

TONE: Direct, practical. You know hiring. 400-token limit.`;

  CHAT_OVERRIDES['data-analyst'] = `You are Tess, the Data Analyst at 3rdShift. NEVER say "same answer as before", "as I mentioned", or any phrase implying repetition. Each response stands on its own.

YOUR THREE CHAT USE CASES:
1. Analysis questions — "How do I find outliers in a dataset?" / "What's a good way to visualize churn?" → direct, specific answer.
2. File prep help — "What format should my data be in?" / "My CSV has mixed date formats, is that a problem?" → helpful guidance.
3. Form field help — "What goes in the analysis goal field?" → clear explanation.

WHAT CHAT MUST NOT DO:
- Never produce a full data analysis, trend report, or insight summary in chat.
- If user starts pasting rows of data: "Upload the file to the Form — I analyze the full dataset there and return a structured report with findings and recommendations. Want to keep asking analysis questions here?"
- Never say "you must use the form" or refuse to help. Chat stays available.

TONE: Analytical, clear. You know data. 400-token limit.`;

  CHAT_OVERRIDES['data-cleaner'] = `You are Cade, the Data Cleaner at 3rdShift. NEVER say "same answer as before", "as I mentioned", or any phrase implying repetition. Each response stands on its own.

YOUR THREE CHAT USE CASES:
1. Data quality questions — "How do I handle duplicate rows?" / "What format should phone numbers be in?" / "Difference between Cade and Tess?" (Tess analyzes data, Cade cleans it) → direct answer.
2. File prep help — "My CSV has blank rows, should I remove them first?" / "What data type should I select?" → clear guidance. Data types available: Customer contacts, Sales transactions, Email marketing list, Product catalog, Financial records, Employee records, Survey responses, Inventory data, Web analytics export, Other/mixed.
3. Form field help — "What should I put in the problems field?" / "When would I enable PII masking?" → helpful explanation.

WHAT CHAT MUST NOT DO:
- Never produce a cleaned dataset, deduplication output, or formatted data in chat.
- If user starts pasting data rows: "Upload the file to the Form — I clean the full dataset there and return a cleaned file plus a PDF change report and XLSX changelog. Want to keep asking data questions here?"
- Never say "you must use the form" or refuse to help. Chat stays available.

TONE: Practical, clear. You know messy data. 400-token limit.`;

  CHAT_OVERRIDES['spreadsheet-builder'] = `You are Sienna, the Spreadsheet Builder at 3rdShift. NEVER say "same answer as before", "as I mentioned", or any phrase implying repetition. Each response stands on its own.

YOUR THREE CHAT USE CASES:
1. Spreadsheet design questions — "What's the best way to build a cash flow tracker?" / "Should I use VLOOKUP or INDEX/MATCH here?" → direct, specific answer.
2. Form field help — "How should I describe my spreadsheet in the form?" / "What does 'additional tabs' mean?" → clear guidance.
3. Build brainstorming — "I need something to track project margins but I'm not sure what columns I need" → help them think it through, then nudge to form.

WHAT CHAT MUST NOT DO:
- Never produce a full spreadsheet structure, tab layout, or formula set in chat.
- If user starts fully describing a build: "This is exactly what the Form is built for — describe it once there and I'll return the full XLSX. Want to jump over, or keep brainstorming here first?"
- Never say "you must use the form" or refuse to help. Chat stays available.

TONE: Helpful, practical. You know spreadsheets. 400-token limit.`;

  // Audio worker overrides
  CHAT_OVERRIDES['voiceover-artist'] = `You are Clay, the Voiceover Artist at 3rdShift. You turn written text into professional MP3 narrations.

CAPABILITIES:
- Convert any written content into high-quality audio
- 12 different voices to choose from: Professional Male, Professional Female, Friendly Male, Friendly Female, British Male, British Female, Deep Male, Calm Female, Young Male, Young Female, Dark & Mysterious Male, Soulful Female
- 3 pace options: Normal, Slow, Fast

CRITICAL RULE — ALWAYS ASK FOR VOICE FIRST:
- Before generating ANY deliverable, you MUST confirm two things with the user:
  1. Which voice they want (give them the full list if they don't know)
  2. What pace they want (Normal / Slow / Fast) — default Normal if they don't care
- NEVER generate without knowing the voice. No exceptions.
- If the user says "yes", "go ahead", or "do it" without specifying a voice, ask: "Which voice would you like? I have: Professional Male, Professional Female, Friendly Male, Friendly Female, British Male, British Female, Deep Male, Calm Female, Young Male, Young Female, Dark & Mysterious Male, or Soulful Female."

WHEN TO GENERATE — add GENERATE_DELIVERABLE on its own line:
✅ User has provided text AND confirmed a voice choice
✅ User says "use [voice name]" or picks one from the list
❌ NEVER generate without a confirmed voice
❌ NEVER assume a default voice — always ask

FOR THE DELIVERABLE INPUT:
- Pass the voice name exactly as chosen
- Pass the pace (default Normal)
- Clean up any markdown formatting from the text before sending to TTS

AFTER GENERATING: Say "Your voiceover is ready — you can play and download it from the result card. Want to try a different voice or adjust the pace?"

Never mention credits, costs, or pricing in chat.`;

  // Shay (logo concept generator) — refinement-focused chat
  CHAT_OVERRIDES['logo-concept-generator'] = `You are Shay, the Logo Concept Generator at 3rdShift. You create professional logo concepts and refine them based on customer feedback.

TWO MODES:

**MODE 1 — NEW LOGO REQUEST** (customer asks for a logo from scratch in chat)
- Collect: brand name, industry/vibe, colors, any symbols. One question at a time.
- When you have enough info (at minimum brand name + industry), confirm it back and generate: "Got it — Swank, fitness, golden yellow. Generating 4 concepts now.\nGENERATE_DELIVERABLE"
- This generates 4 separate concepts just like the form does
- CRITICAL: Use the brand name the customer told you in THIS conversation — never assume it from a previous task

**MODE 2 — REFINEMENT** (customer already has a 4-concept grid and picks one)
- Customer says "Concept 2" or "I like the 3rd one"
- Confirm and generate: "Refining Concept 2 with [their changes].\nGENERATE_DELIVERABLE"
- This generates 1 polished standalone logo
- Always include the concept number in your response so it can be extracted

WHEN TO GENERATE — add GENERATE_DELIVERABLE on its own line:
✅ NEW: You have brand name + at least industry/vibe, customer says go or you have enough
✅ REFINEMENT: Customer picks a concept number and gives feedback
✅ Customer says "go", "do it", "generate", "yes" as confirmation
❌ NEVER: casual chat, questions, "thanks", when brand name is still unknown

RULES:
- Never mention credits, costs, or pricing
- Keep responses short and direct
- For new requests: always confirm the brand name back to the customer before generating
- For refinements: always include "Concept [N]" in your confirmation message
- You cannot accept image uploads or photos — if asked, say: "I can't accept images, but describe what you have in mind and I'll create it. What's the brand name and what vibe are you going for?"
- Never tell a customer to upload anything — there is no upload option in this chat
`;

  // Strip deliverable-only anti-AI writing rules from chat prompts — saves 1,500-2,000 tokens
  // These rules are for Winston AI detection on output, irrelevant in conversational chat
  // Strips ONLY: ## ANTI-AI block through ## WRITE LIKE THIS INSTEAD (inclusive)
  // Preserves: everything before anti-AI + all domain behavior sections after it
  function stripChatPrompt(prompt: string): string {
    // Find exact boundaries of the anti-AI block
    const antiAiStart = prompt.indexOf('## ANTI-AI WRITING RULES');
    if (antiAiStart === -1) return prompt; // no anti-AI block, nothing to strip

    // Find end of WRITE LIKE THIS INSTEAD section (last section of anti-AI block)
    const writeLikeIdx = prompt.indexOf('## WRITE LIKE THIS INSTEAD', antiAiStart);
    let antiAiEnd: number;
    if (writeLikeIdx !== -1) {
      // End is at the next ## section after WRITE LIKE THIS
      const nextSectionIdx = prompt.indexOf('\n## ', writeLikeIdx + 10);
      antiAiEnd = nextSectionIdx !== -1 ? nextSectionIdx : prompt.length;
    } else {
      // Fallback: no WRITE LIKE THIS, strip to next known safe section
      const nextSafe = prompt.search(/\n## (?:SOUND HUMAN|STRUCTURE|WRITING RULES|OUTPUT|QUALITY|SEQUENCE|EMAIL TYPE|PLATFORM|CONTENT CREATION|LEAD GEN|TREND|FLOW|RESEARCH|BUSINESS PLAN|CAPTION|OUTPUT)/i);
      antiAiEnd = nextSafe !== -1 ? nextSafe : prompt.length;
    }

    // Also strip ## SOUND HUMAN block (second anti-AI section in Ava)
    let result = prompt.slice(0, antiAiStart) + prompt.slice(antiAiEnd);
    const soundHumanStart = result.indexOf('## SOUND HUMAN');
    if (soundHumanStart !== -1) {
      const nextAfterSoundHuman = result.indexOf('\n## ', soundHumanStart + 10);
      const soundHumanEnd = nextAfterSoundHuman !== -1 ? nextAfterSoundHuman : result.length;
      result = result.slice(0, soundHumanStart) + result.slice(soundHumanEnd);
    }

    return result.replace(/\n{3,}/g, '\n\n').trim();
  }

  let systemPrompt = CHAT_OVERRIDES[member_id]
    ?? (promptConfig?.systemPrompt
      ? `${stripChatPrompt(promptConfig.systemPrompt)}\n\n`
      : `You are ${personaName}, a ${workerTitle} on the 3rdShift platform. You help users with ${workerTitle.toLowerCase()} tasks.\n\n`);

  // Brand profile context — use Haiku-compressed version (~200 tokens) when available
  // Falls back to raw fields (~500 tokens) for legacy users without compressed cache
  const BRAND_VOICE_HEADER = `BRAND VOICE (Style & Tone Guidance)\n\nThe following describes the brand voice of the operator. Apply these voice, tone, and style guidelines to your responses.\n\nIMPORTANT: This context describes the OPERATOR's brand. It does NOT override the subject of any specific task or request. If the user specifies a different company, product, client, or subject, that takes precedence for all identity and naming decisions. Use this brand context ONLY for voice, tone, taboo words, and audience style.\n\nOperator's brand:`;

  if (brandProfile?.compressed_profile) {
    systemPrompt += `${BRAND_VOICE_HEADER}\n${brandProfile.compressed_profile}\n\nWhen the user specifies a different subject (product name, client, company), apply voice and style above while keeping identity focused on what the user specified.\n\n`;
  } else if (brandProfile?.company_name) {
    // Raw fallback: compress on-the-fly and cache for next time
    const parts = [
      brandProfile.company_name && `Company name (operator): ${brandProfile.company_name}`,
      brandProfile.industry && `Industry (operator): ${brandProfile.industry}`,
      brandProfile.audience && `Target audience: ${brandProfile.audience}`,
      brandProfile.tone && `Tone/voice: ${brandProfile.tone}`,
      brandProfile.competitors && `Competitors: ${brandProfile.competitors}`,
      brandProfile.additional_context && brandProfile.additional_context,
    ].filter(Boolean);
    systemPrompt += `${BRAND_VOICE_HEADER}\n${parts.join('\n')}\n\nWhen the user specifies a different subject, apply voice and style above while keeping identity focused on what the user specified.\n\n`;
    // Async compress and cache (fire-and-forget, non-blocking)
    (async () => {
      try {
        const profileText = parts.join('\n');
        const compressed = await callAI({
          model_tier: 'haiku',
          system: 'You compress brand profiles into concise AI assistant context. Return only the compressed text, no preamble.',
          messages: [{ role: 'user', content: `Summarize this brand profile into a concise context block for an AI writing assistant. Target: 200 tokens or less. Preserve: brand name, product/service (one sentence), target audience (one line), brand voice (3-5 words), any non-negotiable rules. Format as plain text instructions. No headers.\n\n${profileText}` }],
          max_tokens: 250,
        }, { call_type: 'brand-compress' });
        await supabaseAdmin.from('brand_profile').update({
          compressed_profile: compressed.content.trim(),
          compressed_at: new Date().toISOString(),
        }).eq('workspace_id', workspaceId);
      } catch { /* non-fatal */ }
    })();
  } else if (profile?.brand_context) {
    systemPrompt += `${BRAND_VOICE_HEADER}\n${profile.brand_context}\n\nWhen the user specifies a different subject, apply voice and style above while keeping identity focused on what the user specified.\n\n`;
  }

  // Retrieved memories
  if (memories && memories.length > 0) {
    const memLines = memories.map((m) => `- [${m.memory_type}] ${m.content}`).join('\n');
    systemPrompt += `REMEMBERED ABOUT THIS USER:\n${memLines}\n\n`;
  }

  // Haiku summary of older conversation (Phase 2)
  if (conversationSummary) {
    systemPrompt += `[CONVERSATION CONTEXT — Summary of earlier discussion]:\n${conversationSummary}\n[END CONTEXT]\n\n`;
  }

  // Inject post-deliverable awareness signal when a deliverable was just sent
  if (deliverableJustSent) {
    systemPrompt += `⚠️ DELIVERABLE JUST SENT: You just generated and delivered a deliverable in this conversation. The customer can see it right now in the chat above. Your next response MUST acknowledge this — do not act as if nothing happened.

POST-DELIVERABLE RESPONSE RULES (apply based on what the customer says):
- POSITIVE response ("cool", "nice", "thanks", "looks good", "love it", "perfect", "great"): Acknowledge briefly ("Glad that works!"), ask if they want any changes, optionally suggest a natural next step.
- NEGATIVE response ("not right", "off", "not what I wanted", "try again", "that's wrong"): Don't get defensive. Ask specifically what needs to change — tone, structure, angle, etc. Offer to refine.
- NEW REQUEST ("now do X", "can you also write Y"): Transition naturally. Do NOT re-ask context already established in this conversation.
- VAGUE response ("ok", "hmm", "interesting", "..."): Light check-in — "Want me to adjust anything or is it good to go?"
- NEVER say "whenever you're ready, just say the word and I'll get started" — you already started and finished. It's done.

`;
  }

  // Inject proactive suggestion context for Lenny so he doesn't ask redundant questions
  if (proactiveContext && member_id === 'lead-generator') {
    const icp = proactiveContext.parsed_icp;
    systemPrompt += `IMPORTANT CONTEXT — READ THIS FIRST:

You recently sent this customer a proactive suggestion:
"${proactiveContext.suggestion_text}"

That suggestion was based on these confirmed search criteria:
- Job titles: ${icp.job_titles || 'not specified'}
- Industry: ${icp.industry || 'not specified'}
- Company size: ${icp.company_size || 'not specified'}
- Location: ${icp.location || 'United States'}
- Matches found: ${icp.match_count || 'multiple'}

The customer is now replying to YOUR suggestion. They already know the criteria because YOU told them.

DO NOT ask about job titles, industry, company size, or location. You already have this information.

If they say yes/run it/do it/let's go/pull the list or any affirmative:
  Respond with 1 sentence confirming you're running the search with their criteria.
  End your response with exactly: RUNNING_LENNY_SEARCH
  Example: "Running the search now — Founder/CEO roles at SaaS companies under 200 in the US.\nRUNNING_LENNY_SEARCH"

If they want to MODIFY criteria (e.g. 'actually marketing directors instead'):
  Acknowledge the change, confirm updated criteria, end with: RUNNING_LENNY_SEARCH

Do NOT ask clarifying questions about criteria you already stated.

`;
  }

  // ── Mode-gated chat protocol (Charlie, Heath, Quinn, Oscar, Mira) ────────────────
  const isModeGated = !!MODE_GATED_CHAT_PROTOCOLS[member_id];
  if (isModeGated) {
    systemPrompt += MODE_GATED_CHAT_PROTOCOLS[member_id];
  }

  // ── CHAT_BEHAVIOR_BASELINE — platform-wide chat hygiene (all workers) ────────────
  // Replace [YOUR-SLUG] placeholder with actual worker slug for form redirect links
  systemPrompt += CHAT_BEHAVIOR_BASELINE.replace(/\[YOUR-SLUG\]/g, member_id);

  systemPrompt += `You are chatting with the user conversationally. Be helpful, professional, and stay in character as ${personaName}. Reference past work naturally when relevant. Keep responses concise — save long output for deliverables. NEVER say "same answer as before", "as I mentioned previously", or any phrase implying you are repeating yourself. Each response stands on its own.

${!isModeGated ? `GENERATING DELIVERABLES — READ CAREFULLY:
- You do NOT write the actual deliverable output in chat. The system generates it automatically via the real pipeline.
- When you have enough info to generate, respond with a SHORT confirmation (1-2 sentences) and add GENERATE_DELIVERABLE on its own line at the end.
- Example: "On it — working on your blog post now.\nGENERATE_DELIVERABLE"
- The system will run the actual generation and show a deliverable card with View and Download.
- NEVER write the full output in chat. No full articles, no thumbnail descriptions, no full documents.
- Ask clarifying questions ONLY if you genuinely need more info. 1-2 questions max.
- ONLY add GENERATE_DELIVERABLE when the user EXPLICITLY asks you to create/generate/make something. Phrases like "go ahead", "make it", "do it", "generate it", "create it", "yes" as a direct answer to "want me to generate?" — these trigger generation.
- NEVER add GENERATE_DELIVERABLE for: "thanks", "cool", "ok", "got it", "sounds good", casual chat, or any message that is not an explicit creation request.
- NEVER generate again after you already produced a deliverable this session, unless the user explicitly asks for a NEW one.
- After generating: say something like "Here you go — want any changes?" and WAIT. Do not generate again.` : ''}
- NEVER mention credits, costs, or pricing. Hard rule, no exceptions.
- Never volunteer AI model names, companies, or API names unless the customer put them in their message first. No introducing Claude, Anthropic, ChatGPT, GPT-4, OpenAI, Gemini, fal.ai, Serper, Apollo, or what powers you. If the customer asks you to discuss specific AI tools by name, follow their lead. Otherwise use generic terms. Never reveal your data sources or underlying stack.

TONE RULES:
- Do not use emojis unless the user uses them first
- Use **bold** only for genuinely important terms, not decorative
- Keep responses focused and professional — no filler phrases

FORM BRIDGE:
- If the user describes a complex task that would benefit from the structured form (e.g. "write me a full blog post about X with SEO optimization and specific tone"), you may say "This sounds like it needs the full form — I can open it for you with what you've told me." and include the phrase "open form" somewhere in your response. A button will appear automatically.

${plan === 'operator' ? `CHAIN ORCHESTRATION (Operator feature):
- If the user asks you to coordinate with another team member (e.g. "have Reed make a thumbnail for this", "pass this to Kai for SEO", "write the blog post and have Elliot turn it into a LinkedIn post"), you can trigger a chain.
- When you detect a chain request, respond with a confirmation message that:
  1. Names the members in order (e.g. "I'll write the post, then pass it to Reed for the thumbnail")
  2. States the total credit cost simply once (e.g. "This chain uses X credits total")
  3. Ends with: "Want me to kick it off? Reply yes to confirm." 
  4. End your message with: "Want me to kick it off? Reply yes to confirm."
- Wait for user to confirm (yes/go/confirm/do it) before executing` : ''}`.trim();

  // ── Call AI (Sonnet) ─────────────────────────────────────
  const messages: Array<{role: 'user' | 'assistant'; content: string}> = [
    ...recentMessages.map((m) => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: m.content,
    })),
    { role: 'user', content: message },
  ];

  let responseText: string;
  try {
    const aiResponse = await callAI({ model_tier: plan === 'starter' ? 'haiku' : 'sonnet', system: systemPrompt, messages, max_tokens: 400 }, { user_id: userId, call_type: 'chat', worker_id: member_id });
    responseText = aiResponse.content;
    // P8-2: Phase 0 token logging — gated to development only (exposes plan + member_id)
    if (process.env.NODE_ENV === 'development') {
      console.log('[3rdShift][ChatTokens]', JSON.stringify({
        member_id,
        plan,
        msg_count_in_window: recentMessages.length + 1,
        input_tokens: aiResponse.tokens_used.input,
        output_tokens: aiResponse.tokens_used.output,
        system_prompt_chars: systemPrompt.length,
        history_messages_sent: recentMessages.length,
      }));
    }
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : 'AI service unavailable';
    if (chatRateCounted && chatWindowStart) {
      const { error: decError } = await (supabaseAdmin as any).rpc('decrement_chat_rate_limit', {
        p_user_id: userId,
        p_member_id: 'all',
        p_window_type: 'month',
        p_window_start: chatWindowStart.toISOString(),
        p_amount: 1,
      });
      if (decError) {
        const { data: monthRow } = await supabaseAdmin
          .from('chat_rate_limits').select('msg_count')
          .eq('user_id', userId).eq('member_id', 'all').eq('window_type', 'month')
          .eq('window_start', chatWindowStart.toISOString()).maybeSingle();
        await supabaseAdmin.from('chat_rate_limits').upsert({
          user_id: userId,
          member_id: 'all',
          window_type: 'month',
          msg_count: Math.max((monthRow?.msg_count ?? 0) - 1, 0),
          window_start: chatWindowStart.toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,member_id,window_type,window_start' });
      }
    }
    await supabaseAdmin.from('team_chat_messages').insert({
      user_id: userId,
      workspace_id: workspaceId,
      member_id,
      role: 'system',
      content: 'Chat response failed. Please try again.',
    });
    return NextResponse.json({ error: errMsg }, { status: 503 });
  }

  // ── Detect GENERATE_DELIVERABLE tag ─────────────────────────────────────────
  // Any post-deliverable message where the customer asks for a change should bypass
  // the cooldown. The old REFINEMENT_SIGNALS approach was too narrow — "make it more
  // colorful" doesn't match any negative-signal word. The correct rule: if a deliverable
  // was just sent AND the AI decides to generate again, don't block it.
  // The 30s guard only applies to rapid-fire non-post-deliverable clicks (double-taps).
  const msgLower = message.toLowerCase();

  // Fallback: detect generation-intent phrases in the AI response.
  // If Reed (or any member) says "generating now / on it / working on it" but forgot the token,
  // treat it as a generation trigger automatically.
  // EXCLUDED: workers with chatCanGenerate: false in registry (consultant-only / file-upload workers).
  // Add new workers to the flag in registry.ts — this list auto-updates from there.
  const currentWorker = getWorkerBySlug(member_id);
  const workerCanGenerate = currentWorker?.chatCanGenerate !== false; // default true if not set
  const GENERATION_INTENT_PHRASES = [
    'generating now', 'on it —', 'on it!', 'working on it', 'making your', 'creating your',
    'building your', 'putting it together', "here's your", 'generating your',
    'pulling it together', 'making that now', 'generating 4', 'generating four',
  ];
  const responseHasGenerationIntent = workerCanGenerate &&
    GENERATION_INTENT_PHRASES.some(p => responseText.toLowerCase().includes(p));

  // Force GENERATE_DELIVERABLE if the response signals intent but forgot the token
  if (responseHasGenerationIntent && !responseText.includes('GENERATE_DELIVERABLE')) {
    responseText += '\nGENERATE_DELIVERABLE';
  }

  let triggerDeliverable = false;
  // Hard block: workers with chatCanGenerate: false can never trigger a task from chat
  if (!workerCanGenerate && responseText.includes('GENERATE_DELIVERABLE')) {
    responseText = responseText.replace(/\nGENERATE_DELIVERABLE\n?/g, '').replace(/GENERATE_DELIVERABLE\n?/g, '').trim();
  }
  if (responseText.includes('GENERATE_DELIVERABLE')) {
    // Post-deliverable messages ALWAYS bypass the cooldown — the customer already
    // received a result and is asking for a revision. Blocking them here causes the
    // member to say "Generating now" while the system silently does nothing.
    // The 30s dedup guard still applies to fresh (non-post-deliverable) rapid-fire clicks.
    let blocked = false;
    if (!deliverableJustSent) {
      const thirtySecAgo = new Date(Date.now() - 30 * 1000).toISOString();
      const { count: recentDeliverables } = await supabaseAdmin
        .from('team_chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('member_id', member_id)
        .not('deliverable_id', 'is', null)
        .gte('created_at', thirtySecAgo);
      if ((recentDeliverables ?? 0) > 0) blocked = true;
    }

    if (!blocked) {
      triggerDeliverable = true;
    }
    responseText = responseText.replace(/\nGENERATE_DELIVERABLE\n?/g, '').replace(/GENERATE_DELIVERABLE\n?/g, '').trim();
  }

  // Reed attachment preflight: if multiple chat-uploaded images exist, ask once before task creation
  // so a face photo is not silently treated as a style/layout reference or vice versa.
  if (triggerDeliverable && member_id === 'thumbnail-designer') {
    const contextForPreflight = [...recentMessages.map((m: {role: string; content: string}) => `${m.role === 'user' ? 'User' : 'Member'}: ${m.content}`), `User: ${message}`].join('\n\n');
    const imageMatches = [...contextForPreflight.matchAll(/\[STORAGE_PATH:\s*([^\]]+)\]/g)];
    if (imageMatches.length >= 2 && !/\b(face|my photo|me|selfie|style reference|layout reference|sketch)\b/i.test(message)) {
      triggerDeliverable = false;
      responseText = 'I see two images. Which one is your face photo and which one is the style/layout reference? Once you tell me, I’ll generate the thumbnails.';
    }
  }

  // ── Extract chain proposal — ask Haiku to parse member slugs ───────────────
  let chainProposal: { members: string[]; description: string; source_context?: string } | null = null;
  if (plan === 'operator' && responseText.toLowerCase().includes('want me to kick it off')) {
    try {
      const { workers: workerList } = await import('@/lib/workers/registry');
      const { getWorkerPromptConfig } = await import('@/lib/workers/configs');
      const chainEligibleWorkers = workerList.filter((w) => w.active && !!getWorkerPromptConfig(w.slug));
      const slugList = chainEligibleWorkers.map(w => `${w.personaName}=${w.slug}`).join(',');
      const extractRes = await callAI({
        model_tier: 'haiku',
        system: 'Extract team member slugs from a chain proposal. Return only valid JSON.',
        messages: [{
          role: 'user',
          content: `Given this chain proposal:\n\n"${responseText}"\n\nThe available team members and their slugs are:\n${slugList}\n\nReturn a JSON object with: {"members": ["slug1","slug2"], "description": "brief description"}\nOnly include members explicitly mentioned. Return empty array if none found.`
        }]
      });
      const jsonMatch = extractRes.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.members?.length >= 2) {
          const allowedSlugs = new Set(chainEligibleWorkers.map((w) => w.slug));
          const members = parsed.members.filter((slug: string) => allowedSlugs.has(slug));
          if (members.length >= 2) {
            const contextMessages = [
              ...recentMessages.map((m) => `${m.role === 'user' ? 'User' : 'Member'}: ${m.content}`),
              `User: ${message}`,
            ];

            chainProposal = {
              members,
              description: parsed.description || '',
              source_context: contextMessages.join('\n\n').slice(-12000),
            };
          }
          if (chainProposal) {
            // Store pending chain in DB for this user
            await supabaseAdmin.from('team_chat_messages').insert({
              user_id: userId,
              workspace_id: workspaceId,
              member_id,
              role: 'system',
              content: `PENDING_CHAIN:${JSON.stringify(chainProposal)}`,
            });
          }
        }
      }
    } catch { /* ignore — chain detection is best-effort */ }
  }

  // ── Save member response ─────────────────────────────────
  const { data: savedMsg } = await supabaseAdmin
    .from('team_chat_messages')
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      member_id,
      role: 'member',
      content: responseText,
    })
    .select('id')
    .single();

  // ── Async memory extraction (fire and forget) ─────────────
  extractMemoriesAsync(userId, workspaceId, member_id, message, responseText).catch(() => {});

  // ── If GENERATE_DELIVERABLE was triggered, fire the real pipeline ────────
  let newTaskId: string | null = null;
  if (triggerDeliverable) {
    const contextForExtraction = [...recentMessages.map((m: {role: string; content: string}) => `${m.role === 'user' ? 'User' : 'Member'}: ${m.content}`), `User: ${message}`].join('\n\n');
    // Search ENTIRE conversation context for the most recent uploaded image (not just current message)
    // User may have uploaded photo in a previous message, confirmation comes later
    const allImageMatches = [...contextForExtraction.matchAll(/\[STORAGE_PATH:\s*([^\]]+)\]/g)];
    const attachedImage = allImageMatches.length > 0 ? allImageMatches[allImageMatches.length - 1][1].trim() : undefined;

    // Carry forward the reference image for ALL post-deliverable messages, not just
    // negative-signal refinements. "Make it more colorful" is just as valid a refinement
    // as "that's wrong". If the user uploaded a photo earlier, preserve it.
    let priorReferenceImage: string | undefined = undefined;
    if (deliverableJustSent && !attachedImage) {
      // Find the most recent message with a deliverable_id in this conversation
      const msgWithDeliverable = (history ?? []).find(m => m.deliverable_id);
      if (msgWithDeliverable?.deliverable_id) {
        const { data: priorTask } = await supabaseAdmin
          .from('tasks')
          .select('input')
          .eq('id', msgWithDeliverable.deliverable_id)
          .single();
        // Look for any file-upload field in the prior task input (face_photo, reference_image, etc.)
        if (priorTask?.input) {
          const imageField = Object.values(priorTask.input as Record<string, string>).find(
            v => typeof v === 'string' && v.includes('[STORAGE_PATH:')
          );
          if (imageField) {
            const match = imageField.match(/\[STORAGE_PATH:\s*([^\]]+)\]/);
            if (match) priorReferenceImage = match[1].trim();
          }
        }
      }
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai';
    try {
      // Await so we get the task_id back to return to the frontend
      const genRes = await fetch(`${siteUrl}/api/chat/generate-deliverable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('authorization') ?? '',
        },
        body: JSON.stringify({
          member_id,
          conversation_context: contextForExtraction,
          attached_image: attachedImage,
          prior_reference_image: priorReferenceImage,
        }),
      });
      if (genRes.ok) {
        const genData = await genRes.json();
        newTaskId = genData.task_id ?? null;
        // Link task to the member message
        if (newTaskId && savedMsg?.id) {
          await supabaseAdmin.from('team_chat_messages')
            .update({ deliverable_id: newTaskId })
            .eq('id', savedMsg.id);
        }
      } else {
        const errData = await genRes.json().catch(() => ({}));
        // Post a visible error message to chat
        await supabaseAdmin.from('team_chat_messages').insert({
          user_id: userId, workspace_id: workspaceId, member_id, role: 'system',
          content: `❌ Generation failed: ${errData.error || 'Unknown error'}. Try using the form instead.`,
        });
      }
    } catch (e) {
      // Visible error in chat, not silent
      await supabaseAdmin.from('team_chat_messages').insert({
        user_id: userId, workspace_id: workspaceId, member_id, role: 'system',
        content: `❌ Generation failed — network error. Try using the form for reliable results.`,
      });
    }
  }

  // Detect RUNNING_LENNY_SEARCH marker — strip from visible response, flag for frontend
  let triggerLennySearch = false;
  if (responseText.includes('RUNNING_LENNY_SEARCH')) {
    responseText = responseText.replace('\nRUNNING_LENNY_SEARCH', '').replace('RUNNING_LENNY_SEARCH', '').trim();
    triggerLennySearch = true;
  }

  return NextResponse.json({
    id: savedMsg?.id,
    role: 'member',
    content: responseText,
    member_id,
    chain_proposal: chainProposal,
    trigger_deliverable: triggerDeliverable,
    new_task_id: newTaskId,
    trigger_lenny_search: triggerLennySearch,
    proactive_team_update_id: proactiveContext?.team_update_id || null,
  });
}

const MEMORY_CAP_PER_MEMBER = 10; // Capped at 10 (down from 15)
const MEMORY_MAX_CHARS = 160;     // 40 tokens × 4 chars/token — individual memory length cap

async function extractMemoriesAsync(
  userId: string,
  workspaceId: string,
  memberId: string,
  userMessage: string,
  memberResponse: string
) {
  try {
    // Load existing memories FIRST — pass them to Haiku so it can skip duplicates
    const { data: existingMemories } = await supabaseAdmin
      .from('team_member_memories')
      .select('id, member_id, memory_type, content, created_at')
      .eq('workspace_id', workspaceId)
      .is('invalidated_at', null)
      .or(`member_id.eq.${memberId},member_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(100);

    const memberMems = (existingMemories ?? []).filter(m => m.member_id === memberId);
    const brandMems = (existingMemories ?? []).filter(m => m.member_id === null);
    const allExisting = [...memberMems, ...brandMems];

    // ── Hard cap enforcement ─────────────────────────────────────────────────
    // If we're already at or over the cap for this member, check if we can prune first.
    // Cap applies to per-member memories. Brand memories are shared and have their own limit.
    const memberMemCount = memberMems.length;
    const overCap = memberMemCount >= MEMORY_CAP_PER_MEMBER;

    const existingList = allExisting.length > 0
      ? `\nEXISTING MEMORIES ALREADY STORED (do NOT re-extract anything covered here):\n${allExisting.map((m, i) => `${i + 1}. [${m.memory_type}] ${m.content}`).join('\n')}\n`
      : '';

    const prompt = `You are extracting facts about the USER from this conversation. Only extract facts about the USER — never about the team member.

User: ${userMessage}
Member: ${memberResponse}
${existingList}
ONLY extract if the user explicitly stated it:
- brand: User's company name, industry, product name, target audience, brand tone/voice, brand visual style
- preference: What the user wants in outputs (style, format, length, things to exclude/include)

HARD RULES — return [] if none of these apply:
1. ONLY facts the USER stated. Never extract what the member said, did, acknowledged, or committed to.
2. NEVER extract: member behavior, member communication style, member commitments, copyright rules, platform limitations, system behavior
3. NEVER extract conversational filler: "user prefers clear direction", "user expects feedback loops", "user wants specific outputs"
4. NEVER extract facts about what was generated (no output summaries)
5. NEVER extract things that are obvious or universal (everyone wants good output)
6. DO NOT extract anything already captured in the EXISTING MEMORIES list above, even if phrased differently
7. Maximum 1-2 memories per exchange. When in doubt, return [].

GOOD examples (extract these):
- User said "my company is 3rdShift" → brand: "User's company is 3rdShift"
- User said "no text on the thumbnail" → preference: "No text/headline on thumbnails"
- User said "photorealistic style only" → preference: "Prefers photorealistic image style"
- User said "same two animals from the reference image" → preference: "Images should feature the same two animals from their uploaded reference"

BAD examples (never extract these):
- "Member acknowledged a failure" → SKIP (about the member)
- "Member prefers detailed confirmations" → SKIP (about the member)
- "User expects specific outputs" → SKIP (vague/universal)
- "Team member handles thumbnail creation" → SKIP (about the member)
- "Cannot generate copyrighted characters" → SKIP (system rule, not user fact)
- "User wants to maintain same animals" → only extract if user EXPLICITLY said this

Return JSON array only: [{"type": "brand|preference", "content": "..."}] or []`;

    const aiResult = await callAI({
      model_tier: 'haiku',
      system: 'You extract facts about users from conversations. Return only valid JSON. When in doubt, return [].',
      messages: [{ role: 'user', content: prompt }],
    });

    let newMemories: Array<{type: string; content: string}> = [];
    try {
      const json = aiResult.content.match(/\[[\s\S]*\]/)?.[0];
      if (json) newMemories = JSON.parse(json);
    } catch { return; }

    for (const mem of newMemories) {
      if (!mem.type || !mem.content) continue;

      const isBrand = mem.type === 'brand';
      const relevantExisting = isBrand ? brandMems : memberMems;

      // Truncate memory to 40-token cap (160 chars) before storing
      if (mem.content.length > MEMORY_MAX_CHARS) {
        // Truncate at last word boundary within limit
        mem.content = mem.content.slice(0, MEMORY_MAX_CHARS).replace(/\s+\S*$/, '').trim();
      }

      // Skip exact or near-exact duplicates (case-insensitive)
      const isDuplicate = relevantExisting.some(
        (e) => e.content.toLowerCase().trim() === mem.content.toLowerCase().trim()
      );
      if (isDuplicate) continue;

      // Enforce hard cap for per-member memories
      if (!isBrand) {
        const currentCount = memberMems.length;
        if (currentCount >= MEMORY_CAP_PER_MEMBER) {
          // Drop the oldest entry to make room for the new one
          const oldest = memberMems[memberMems.length - 1];
          if (oldest) {
            await supabaseAdmin
              .from('team_member_memories')
              .update({ invalidated_at: new Date().toISOString() })
              .eq('id', oldest.id);
            // Remove from our local list so future iterations in this loop are accurate
            memberMems.splice(memberMems.length - 1, 1);
          }
        }
      }

      await supabaseAdmin.from('team_member_memories').insert({
        user_id: userId,
        workspace_id: workspaceId,
        member_id: isBrand ? null : memberId,
        memory_type: mem.type,
        content: mem.content,
      });

      // Keep local count accurate for subsequent iterations
      if (!isBrand) {
        memberMems.unshift({ id: 'new', member_id: memberId, memory_type: mem.type, content: mem.content, created_at: new Date().toISOString() });
      }
    }
  } catch { /* silent */ }
}
