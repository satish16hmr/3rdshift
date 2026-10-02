# Sample output: email-marketing-strategist — Ellis · Email Marketing Strategist

**Test input used:**
```
Campaign goal: Welcome series for new trial users. Product: Acme Analytics. Audience: SaaS founders trying to reduce churn.
```

**Generation time:** 68s
**Credits deducted:** 0 (direct API call — bypassed task system for batch generation)
**Output tokens:** 3334
**Output char count:** 11815

**Full output below:**

---

# EMAIL MARKETING STRATEGY: Acme Analytics Welcome Series

---

## FLOW MAP (VISUAL DESCRIPTION)

```
[TRIGGER: New Trial Signup]
         |
         v
[Email 1 | Day 0 | Immediate] --> Deliver access + set expectations
         |
         v
[Email 2 | Day 2] --> Founder story + why churn is a solvable problem
         |
         v
[Email 3 | Day 4] --> Quick win tutorial (the one thing to do first)
         |
         v
         +------ [BRANCH CHECK: Has user connected their data source?]
         |                    |
         |                   YES                        NO
         |                    |                          |
         v                    v                          v
[Email 4 | Day 7]    [Power User Track]        [Re-engagement Nudge]
Social proof +       Skip to advanced           "Still stuck? Here's
soft offer           tips sequence               the 3-minute setup"
         |
         v
[Email 5 | Day 10 | Conversion Push]
Trial ending soon + clear upgrade CTA
         |
         v
         +------ [BRANCH CHECK: Did they upgrade?]
                             |
                   YES                  NO
                    |                    |
                    v                    v
          [Post-Purchase         [Churn Save Sequence]
           Onboarding Flow]       2-email final push
```

---

## FLOW 1: WELCOME + TRIAL NURTURE SEQUENCE

**Trigger:** User completes trial signup form
**Total emails:** 5 (+ 2 branch variations)
**Goal:** Get founder to first "aha moment" inside Acme Analytics, then convert to paid

---

### Email 1 (Day 0 | IMMEDIATE)

**Subject line options:**
- "Your Acme Analytics trial is live. Start here."
- "One thing to do in the next 10 minutes"
- "You're in. Here's what matters first."

**Goal:** Confirm access, reduce friction, direct to single action

**Key content:**
- Login button front and center
- One-sentence value reminder: "Acme shows you exactly where users drop off before they cancel."
- Tell them what to do first (connect their data source). One step. Not five.
- Set expectations: "Over the next week, we'll send you a few emails with tips from founders who've cut churn by 30% or more."

**CTA:** "Connect Your First Data Source"

**Send time:** Immediately on trigger. No delay.

**Length:** Short. Under 150 words. They want access, not a manifesto.

---

### Email 2 (Day 2 | BRAND STORY)

**Subject line options:**
- "The churn problem nobody talks about honestly"
- "We built this after losing $18k MRR in 60 days"
- "Why most analytics tools miss the point entirely"

**Goal:** Build trust with a founder-to-founder voice. Make them feel understood.

**Key content:**
- Lead with a real, specific pain: "You can see that users are leaving. You just can't see why."
- Tell the founding story. Concrete details. Not "we're passionate about helping businesses." Something like: "Our founder ran a B2B SaaS for 4 years and watched the same pattern repeat: users would activate, go quiet, and cancel without a single support ticket."
- Explain what Acme actually does differently. Plain language. No jargon.
- One line of social proof to plant a seed: "Teams using Acme find their first churn signal inside 48 hours on average."

**CTA:** "See How It Works (3-minute overview)"

**Send time:** Day 2, 9am in user's timezone (or 10am EST as fallback)

**Length:** 250 to 350 words. Personal tone. Write like a person, not a product page.

---

### Email 3 (Day 4 | QUICK WIN)

**Subject line options:**
- "The one report to run before anything else"
- "Do this before your trial hits Day 7"
- "Most founders check the wrong metric first. Here's the right one."

**Goal:** Drive a meaningful product interaction. Give them a real win they can feel.

**Key content:**
- Teach one specific thing: how to run the "Drop-Off Timeline" report (or whatever Acme's core feature is called)
- Frame it as: "This is the exact report I'd run on Day 1 if I were you"
- Use a short numbered list for steps (3 steps max)
- Show what the output looks like and what to do with it
- No selling here. Pure value.

**CTA:** "Run the Drop-Off Timeline Report Now"

**Send time:** Day 4, 10am

**Branch logic firing at send time:**
- If user HAS connected data source: send this email as written
- If user HAS NOT connected data source: swap this email for the "Still Stuck" variation (see Branch A below)

---

### Branch A (Day 4 | FOR NON-ACTIVATED USERS)

**Subject:** "Quick question about your setup"

**Content:**
- Acknowledge the friction without being preachy: "Setting up a new tool during a busy week is rough."
- Offer a specific fix: "Here's a 3-minute Loom walkthrough of the exact setup steps."
- Offer a human option: "Or reply to this email and someone from our team will set it up with you."

**CTA:** "Watch the 3-Minute Setup"

---

### Email 4 (Day 7 | SOCIAL PROOF)

**Subject line options:**
- "How Clearbit (small team, big churn problem) fixed their drop-off in 3 weeks"
- "What 47 SaaS founders learned in their first 7 days"
- "Real numbers from teams like yours"

**Goal:** Remove doubt with proof. Activate desire without a direct pitch.

**Key content:**
- Lead with a specific customer result: a named company (or anonymized archetype), the problem they had, the specific metric that changed
- Keep it story-shaped: before, action, after. Two short paragraphs.
- Add a second piece of proof (a quote or a stat)
- Mention the trial ending naturally, no alarm bells yet: "You've got a few days left in your trial, and this is a good time to see if what you found matches what these teams experienced."

**CTA:** "See More Customer Results" (links to case study or testimonials page)

**Send time:** Day 7, Tuesday or Wednesday, 9am

---

### Email 5 (Day 10 | CONVERSION PUSH)

**Subject line options:**
- "Your trial ends in 4 days"
- "Before you go: what did you find?"
- "3 things to do before your Acme trial expires"

**Goal:** Convert trial to paid. Clear, direct, no fluff.

**Key content:**
- Open with what they now know (or should know) after 10 days: "You've had 10 days to poke around. Hopefully you've seen at least one thing about your churn you didn't know before."
- Make the case for upgrading in 3 concrete points. Not features. Outcomes. "Your drop-off data doesn't disappear when you upgrade. It goes back 90 days." Type of thing.
- Price transparency. Tell them what it costs. Don't make them click to find out.
- One line addressing the main objection: "If the setup gave you trouble or you didn't get to finish, reply here before your trial ends and we'll extend it 7 days."
- Single CTA. No secondary links cluttering the decision.

**CTA:** "Upgrade to Acme Analytics (from $79/month)"

**Send time:** Day 10, Tuesday through Thursday, 10am

**Length:** 300 to 400 words

---

## FLOW 2: CHURN SAVE BRANCH (FOR NON-CONVERTING TRIAL USERS)

**Trigger:** Trial expires without upgrade

**Timing:** Fires the day after trial ends

---

### Churn Save Email 1 (Day 11 | 1 DAY AFTER EXPIRY)

**Subject:** "Your trial ended. Can I ask one thing?"

**Goal:** Get a reply. Understand the real objection.

**Content:**
- Keep it short. Under 100 words.
- Ask a single direct question: "Was it the setup, the price, or just bad timing?"
- Three reply options they can click (using survey link or mailto trick)
- No desperation. Confident and curious tone.

**CTA:** "Tell me which one" (links to 1-question survey)

---

### Churn Save Email 2 (Day 14 | FINAL)

**Subject:** "Last one from us (and a small offer)"

**Goal:** Last-chance conversion with a time-limited incentive

**Content:**
- Acknowledge they haven't upgraded
- Offer something specific: 20% off first 3 months, or a free onboarding call, or a 14-day extension
- Give a hard deadline: "This offer expires Friday at midnight."
- One line: "If the timing is wrong, no hard feelings. You can restart your trial anytime."

**CTA:** "Claim Your Offer Before Friday"

---

## SEGMENTATION RECOMMENDATIONS

**Segment 1: Activated vs. Non-Activated**
Definition: Did they connect a data source within 48 hours?
Treatment: Activated users get the full sequence. Non-activated users get Branch A at Day 4 and a softer Day 5 follow-up nudge before rejoining the main track.

**Segment 2: Company Size (by self-reported seat count at signup)**
- Solo founders / teams under 5: Lean into the "fast, no-ops-team-required" angle
- Teams of 6 to 25: Emphasize collaboration features and shared dashboards
- Teams above 25: Trigger a sales-assist email from a rep on Day 7 instead of Email 4

**Segment 3: Trial Source**
- Organic / SEO signups: More education-heavy. They found you but may not know your core value yet.
- Paid ad signups: More conversion-aggressive. They responded to a specific promise. Hold them to it.
- Referral signups: Lead with community and social proof harder. They trust people, not brands.

**Segment 4: Engagement Score (based on email opens + product logins)**
- High engagement (opened 3+ emails, logged in 3+ times): Skip Email 4 and go straight to conversion.
- Low engagement (opened 0-1 emails, logged in once): Trigger a one-to-one "personal" email from the founder at Day 6.

---

## AUTOMATION TRIGGERS

| Behavior | Trigger | Action |
|---|---|---|
| Signup completed | Immediate | Fire Email 1 |
| Data source connected | Within 48 hrs of signup | Tag as "Activated." Suppress Branch A. |
| Data source NOT connected | 48 hrs after signup | Queue Branch A for Day 4 slot |
| Report run at least once | Any time during trial | Add to "Power User" tag. Queue advanced tips drip. |
| Trial expires without purchase | Day 10 end of day | Start Churn Save sequence |
| Churn Save survey completed | On click | Segment by response. Route to objection-specific reply. |
| Upgrade completed | Any point during trial | Stop all remaining trial emails immediately. Start post-purchase onboarding flow. |
| Email unsubscribed | Any point | Remove from all sequences. Flag in CRM. |

---

## KEY METRICS TO TRACK

**Welcome Sequence**
- Open rate target: above 50% for Email 1, above 35% for Emails 2 through 5
- Click rate target: above 20% for Email 1, above 12% for Emails 2 through 5
- Activation rate (data source connected within 48 hrs): target above 40%

**Trial Conversion**
- Trial-to-paid conversion rate: target 15% to 25% (industry benchmark for SaaS is 15%)
- Upgrade email click rate (Email 5): target above 8%

**Churn Save**
- Survey response rate: target above 15%
- Churn save conversion rate: target above 5%

**Health Metrics (watch weekly)**
- Unsubscribe rate: keep below 0.5% per email
- Spam complaint rate: keep below 0.08%
- Reply rate on personal emails (Day 2, Branch A, Churn Save Email 1): target above 3%

---

## SUBJECT LINE FORMULA CHEATSHEET

For this audience (SaaS founders, data-literate, skeptical of hype), these patterns work:

- **Specific number + outcome:** "How 47 SaaS teams cut churn by 28% in Q1"
- **Direct question:** "Why are users canceling without filing a ticket?"
- **Honest framing:** "The churn metric you're probably ignoring"
- **Time pressure without panic:** "4 days left in your trial"
- **Founder-to-founder directness:** "We built this after losing $18k MRR in 60 days"

Avoid: Emojis in subject lines for this audience. Avoid "free," "limited time," "exclusive" and anything that sounds like a Groupon.

---

## SEND TIME RECOMMENDATIONS

- Best days: Tuesday, Wednesday, Thursday
- Best times: 9am to 11am in recipient's local timezone
- Avoid: Monday mornings (buried in weekend backlog), Friday afternoons (mentally checked out), and any time within 2 hours of a major tech news cycle
- For the personal/story emails (Email 2, Churn Save Email 1): try 7:30am or 8am. Early morning reads feel more intimate and less "scheduled."