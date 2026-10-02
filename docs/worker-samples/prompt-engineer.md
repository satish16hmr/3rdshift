# Sample output: prompt-engineer — Pete · Prompt Engineer

**Test input used:**
```
AI tool: ChatGPT. Goal: Write compelling cold email subject lines for B2B SaaS outreach. Use case: Writing. Generate 3 prompt variations.
```

**Generation time:** 52s
**Credits deducted:** 0 (direct API call — bypassed task system for batch generation)
**Output tokens:** 2456
**Output char count:** 8512

**Full output below:**

---

# Cold Email Subject Lines for B2B SaaS Outreach
## 3 Prompt Variations by Pete @ 3rdShift

---

## VARIATION 1: The Research-Based Angle

### Full Prompt (copy-paste ready)

```
You are an expert B2B copywriter who specializes in cold email outreach for SaaS companies. 
Your subject lines get opened because they feel personal, relevant, and low-pressure.

Write 15 cold email subject lines for [YOUR COMPANY NAME], a [DESCRIBE YOUR SAAS PRODUCT 
IN ONE SENTENCE] targeting [TARGET JOB TITLE] at [TARGET COMPANY TYPE].

The prospect's likely biggest pain point is [PRIMARY PAIN POINT].

Requirements:
- Each subject line must be under 50 characters
- Mix these 5 approaches (3 subject lines each):
  1. Direct benefit
  2. Curiosity gap
  3. Peer social proof
  4. Question-based
  5. Hyper-specific stat or number

- Never use spam trigger words: free, guaranteed, limited time, act now
- Never use emoji
- Sound like a human sent it, not a marketing team
- Do not use exclamation points

After the 15 subject lines, flag your top 3 picks and explain why in one sentence each.
```

### Why It Works
The five-approach structure forces variety so you're not getting 15 versions of the same idea. The character limit is practical — many email clients truncate at 50. Banning spam words and exclamation points removes the most common mistakes before they happen. Asking for top picks with reasoning makes ChatGPT self-evaluate, which usually surfaces genuinely stronger options.

### Variables
- `[YOUR COMPANY NAME]` — your SaaS product name
- `[DESCRIBE YOUR SAAS PRODUCT IN ONE SENTENCE]` — e.g., "project management software built for remote engineering teams"
- `[TARGET JOB TITLE]` — e.g., "VP of Operations," "Head of Sales"
- `[TARGET COMPANY TYPE]` — e.g., "Series A startups," "mid-market retail companies"
- `[PRIMARY PAIN POINT]` — e.g., "too many tools, not enough visibility across projects"

### Example Output

> **15 Subject Lines for Acme (project ops SaaS → VP of Operations at Series A startups)**
>
> *Direct Benefit*
> 1. Half your weekly status meetings, gone
> 2. One dashboard. Every team. No chaos.
> 3. Your ops stack, finally talking to itself
>
> *Curiosity Gap*
> 4. What 3 tools are slowing your team down
> 5. Something your engineers won't tell you
> 6. The ops problem hiding in plain sight
>
> *Peer Social Proof*
> 7. How Notion's ops team cut reporting time
> 8. What fast-scaling ops teams do differently
> 9. 4 Series A companies ditched Asana for this
>
> *Question-Based*
> 10. How many tools does your team actually use?
> 11. Who owns visibility on your roadmap?
> 12. Does your ops stack scale past 50 people?
>
> *Stat-Based*
> 13. 6 hours/week lost to bad project handoffs
> 14. 73% of ops leads miss this bottleneck
> 15. Teams like yours save 9 hrs/week here
>
> **Top 3 Picks:**
> - #6 — triggers curiosity without being vague or clickbait-y
> - #11 — identifies a real internal accountability gap they feel daily
> - #13 — the specific number makes the pain tangible and credible

### Iteration Tips
- If subject lines feel generic, add: *"Reference the fact that [PROSPECT COMPANY] recently [TRIGGER EVENT like funding round, new hire, product launch]"*
- If they feel too salesy, add: *"Write as if you're genuinely curious, not pitching"*
- Run it twice and cherry-pick across both outputs

---

## VARIATION 2: The A/B Testing Machine

### Full Prompt (copy-paste ready)

```
You are a conversion-focused copywriter running cold email experiments for a B2B SaaS company.

My product: [DESCRIBE YOUR SAAS PRODUCT IN ONE SENTENCE]
My prospect: [TARGET JOB TITLE] at [TARGET COMPANY TYPE]
Their pain: [PRIMARY PAIN POINT]
My differentiator: [WHAT MAKES YOUR PRODUCT DIFFERENT FROM COMPETITORS]

Create 5 A/B test pairs of subject lines. Each pair tests one specific variable.

Test these variables, one per pair:
1. Long vs. short (one under 30 chars, one 40-50 chars)
2. Statement vs. question
3. Their name personalization vs. no name
4. Specific number vs. no number
5. Pain-focused vs. outcome-focused

Format each pair like this:
Version A: [subject line]
Version B: [subject line]
What's being tested: [one sentence]
My prediction: [which will win and why, in one sentence]

End with one "wildcard" subject line that breaks all conventions but might still work.
```

### Why It Works
This prompt is built for teams actually running campaigns, not just brainstorming. Each pair isolates a single variable, which is how real A/B testing works. The "prediction" step forces the model to engage analytically rather than just generate. The wildcard gives you a creative release valve — sometimes the weird one wins.

### Variables
- `[DESCRIBE YOUR SAAS PRODUCT IN ONE SENTENCE]`
- `[TARGET JOB TITLE]`
- `[TARGET COMPANY TYPE]`
- `[PRIMARY PAIN POINT]`
- `[WHAT MAKES YOUR PRODUCT DIFFERENT FROM COMPETITORS]` — e.g., "we integrate with Salesforce in under an hour, no dev work needed"

### Example Output

> **Pair 1 — Length**
> Version A: Fix your pipeline leaks
> Version B: Where deals go quiet (and how to stop it)
> What's being tested: Whether brevity or specificity drives more opens
> My prediction: Version B wins — the parenthetical creates a mini curiosity loop
>
> **Wildcard:**
> "Saw your LinkedIn post — had a thought"
> *(Works because it implies research and relationship without making a claim)*

### Iteration Tips
- Feed your actual open rate data back in: *"Version A got 31% open rate, Version B got 19%. Generate 3 more pairs using Version A's approach."*
- Add your existing best performer: *"My current best subject line is [X]. Use it as a benchmark."*

---

## VARIATION 3: The Persona Mirror

### Full Prompt (copy-paste ready)

```
Before writing anything, think carefully about who you're writing for.

My prospect profile:
- Title: [TARGET JOB TITLE]
- Industry: [INDUSTRY]
- Company size: [COMPANY SIZE]
- Their most frustrating daily problem: [PRIMARY PAIN POINT]
- What they read: [PUBLICATIONS OR COMMUNITIES THEY FOLLOW]
- How they talk about their work: [1-2 PHRASES THEY ACTUALLY USE, not corporate speak]

My product: [DESCRIBE YOUR SAAS PRODUCT IN ONE SENTENCE]

Step 1: In 3 bullet points, describe how this person thinks about their inbox and what makes them delete an email in under 2 seconds.

Step 2: Write 10 subject lines that would survive their delete reflex. Use their own language and mental frame, not mine.

Step 3: Rewrite your 3 weakest subject lines from Step 2 using what you learned in Step 1.

Format Steps 2 and 3 as numbered lists. Label Step 3 lines as "Revised."
```

### Why It Works
Most cold email subject lines fail because they're written from the seller's perspective. This prompt forces a perspective shift before a single word gets written. The "how they talk about their work" variable is the secret weapon — when a subject line uses the prospect's own vocabulary, it reads like an insider wrote it. The revision step builds in self-correction.

### Variables
- `[TARGET JOB TITLE]`
- `[INDUSTRY]` — e.g., "e-commerce," "healthcare tech"
- `[COMPANY SIZE]` — e.g., "50-200 employees," "enterprise 1,000+"
- `[PRIMARY PAIN POINT]`
- `[PUBLICATIONS OR COMMUNITIES THEY FOLLOW]` — e.g., "SaaStr, Lenny's Newsletter, RevOps Co-op Slack"
- `[1-2 PHRASES THEY ACTUALLY USE]` — e.g., "pipeline hygiene," "burning quota," "churn creep"
- `[DESCRIBE YOUR SAAS PRODUCT IN ONE SENTENCE]`

### Example Output

> **Step 1 — How this person thinks:**
> - A VP of Sales scans subject lines in 1.5 seconds. If it sounds like a vendor, it's dead.
> - They delete anything that starts with "I wanted to reach out" or references "synergy"
> - They respond to things that name their actual problem in words they'd use in a team meeting
>
> **Step 2 — Surviving the delete reflex:**
> 1. Your reps are burning quota on bad-fit accounts
> 2. Pipeline hygiene is a full-time job. It shouldn't be.
> 3. Churn creep usually starts here
> ...
>
> **Step 3 — Revised:**
> 8. Revised: "Where your pipeline actually leaks" → "The handoff where quota dies"

### Iteration Tips
- If you don't know what phrases your prospect actually uses, ask ChatGPT first: *"What slang and jargon does a [JOB TITLE] in [INDUSTRY] use when complaining about [PAIN POINT]? Give me 10 phrases."* Then plug those into this prompt.
- Try running this prompt with two different personas and compare. The gap between outputs will tell you how well-defined your ICP actually is.

---

*Built by Pete @ 3rdShift — prompts that pull weight.*