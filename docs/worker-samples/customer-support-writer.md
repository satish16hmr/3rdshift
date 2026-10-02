# Sample output: customer-support-writer — Cara · Customer Support Writer

**Test input used:**
```
Support type: Feature request response. Product: analytics dashboard. Customer request: CSV data export feature. Current status: on roadmap for Q3.
```

**Generation time:** 20s
**Credits deducted:** 0 (direct API call — bypassed task system for batch generation)
**Output tokens:** 991
**Output char count:** 3996

**Full output below:**

---

**Content Type not specified in your prompt** — but this is clearly an agent-facing response, so I'm treating it as a **Canned Response** and generating accordingly.

---

**Template 1: Feature Request — CSV Export (On Roadmap)**

**Subject:** Feature request acknowledged — CSV export, Q3 roadmap

**Body:**
Hi {{customer_name}},

Thanks for taking the time to share this — CSV export is genuinely one of the most requested features we hear about, and I'm glad you flagged it. The good news: it's already on our roadmap for Q3. I can't promise an exact launch date yet, but the team is actively working toward it. If you'd like a heads-up the moment it ships, just say the word and I'll make sure you're on the notification list.

Best,
{{agent_name}} | {{company_name}} Support

**When to use:** Customer has requested CSV export from the analytics dashboard and you need to confirm it's planned without committing to a specific date.

---

**Template 2: Feature Request — CSV Export (Power User / Data-Heavy Context)**

**Subject:** CSV export request — roadmap update + interim workaround

**Body:**
Hi {{customer_name}},

CSV export is already on our Q3 roadmap, so this is very much coming — you're not the only one asking for it. While you wait, you may be able to pull what you need through [insert any available workaround, e.g., manual export, API access, or filtered view]. I know that's not the same as a clean export, and I appreciate your patience while we get this across the finish line. Want me to add you to the early access or notification list for when it launches?

Best,
{{agent_name}} | {{company_name}} Support

**When to use:** Customer seems to need CSV export for a specific workflow or data task — they want a solution now, not just a promise.

---

**Template 3: Feature Request — CSV Export (Frustrated / Repeat Ask)**

**Subject:** CSV export — we hear you, here's where it stands

**Body:**
Hi {{customer_name}},

I completely understand the frustration — waiting on a feature you need for your day-to-day work is genuinely inconvenient, and I don't want to brush that off. CSV export is confirmed for our Q3 roadmap, so it is coming. I'll personally flag your ticket so you're among the first to know when it's live. In the meantime, if there's a specific report or dataset you're trying to get out of the dashboard, tell me more and I'll see if there's any way to help bridge the gap.

Best,
{{agent_name}} | {{company_name}} Support

**When to use:** Customer has asked about this before, expressed frustration, or made clear that the missing feature is blocking real work.

---

## Voice Reference — Analytics Dashboard Support

**Phrases to always use:**
- "Thanks for flagging this"
- "You're not the only one asking for it"
- "It's already on our roadmap"
- "I can't promise an exact date, but..."
- "Tell me more and I'll see what I can do"
- "I'll make sure you're on the notification list"
- "I don't want to brush that off"

**Phrases to never use:**
- "Unfortunately, we are unable to provide a timeline"
- "This has been noted and passed to the relevant team"
- "Per our product roadmap"
- "We appreciate your patience at this time"
- "I can assure you that your feedback has been heard"
- "This is outside my scope"
- "As per your request"

**How to open:** Acknowledge the specific feature they asked for before saying anything about roadmaps or timelines.

**How to apologize:** Validate the inconvenience once and move immediately to what's actually happening — don't dwell or over-apologize.

**How to close:** Always leave the door open for follow-up and offer something concrete, even if it's just a notification when the feature ships.

**Escalation triggers:**
- Customer indicates the missing feature is causing a business-critical failure or contract risk
- Customer asks to speak with a product manager or requests formal escalation
- Customer has raised the same request multiple times with no resolution path beyond "it's on the roadmap"