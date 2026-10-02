# Sample output: ad-campaign-strategist — Ad Campaign Strategist

**Test input used:**
```json
{
  "business_name": "3rdShift",
  "what_promoting": "Free analytics trial",
  "ad_platforms": [
    "Google",
    "Meta (Facebook/Instagram)"
  ],
  "monthly_budget": "$3,000",
  "target_audience": "small business owners running service businesses",
  "campaign_goal": "Generate Leads"
}
```

**Generation time:** 86s
**Credits deducted:** 0
**Output tokens (estimated):** ~3745
**Output char count:** 14979

**Full output below:**

---

# 3rdShift Free Analytics Trial — Ad Campaign Blueprint

**Campaign Goal:** Lead Generation
**Monthly Budget:** $3,000
**Flight:** 30 days, rolling optimization

---

## BUDGET ALLOCATION

| Platform | Monthly | Daily |
|---|---|---|
| Google Search | $1,500 | $50 |
| Meta (FB/IG) | $1,050 | $35 |
| LinkedIn | $450 | $15 |
| **Total** | **$3,000** | **$100** |

**Rationale:** Search captures active intent (people searching for analytics/business tools right now). Meta scales reach cost-effectively for small business owners. LinkedIn adds a layer of professional targeting at a smaller budget since CPL will be higher there — we're testing the channel, not betting on it.

---

## PLATFORM 1: GOOGLE SEARCH

### Audience Targeting

**Campaign Type:** Search

**Keywords (Exact + Phrase Match):**
- [small business analytics tool]
- [business reporting software]
- "analytics for service businesses"
- "track business performance"
- [business dashboard software]
- "small business KPI tracking"
- "client reporting tool small business"
- [google analytics alternative small business]
- "business metrics software"
- [service business software]

**Broad Match (budget-capped, for discovery):**
- business performance tracking
- small business data tools
- service business reporting

**Negative Keywords:**
- enterprise
- large company
- free forever (intent mismatch)
- student
- DIY
- tutorial
- Wikipedia
- Tableau (feature mismatch signal)
- PowerBI (same)
- jobs / careers / hiring

**Demographics:**
- Age: 25–54
- Exclude: under 18, Students (where targetable)

**Bid Strategy:** Maximize Conversions (switch to Target CPA at $45 once 30+ conversions logged)

---

### Google Search Ad Copy — 5 Variations

All ads route to a dedicated landing page with one CTA: Start Free Trial.

---

**Ad Variation 1 — Lead with the Free Trial**

*Headline 1:* Free Analytics Trial for Your Business
*Headline 2:* Know Exactly What's Working
*Headline 3:* No Credit Card. No Commitment.
*Description 1:* 3rdShift gives service business owners clear, simple analytics — without hiring a data team. See your numbers the way they should be seen.
*Description 2:* Start your free trial today and know where your revenue is actually coming from.
*CTA:* Start Free Trial

---

**Ad Variation 2 — Lead with the Pain Point**

*Headline 1:* Still Guessing How Your Business Is Doing?
*Headline 2:* 3rdShift Shows You the Real Numbers
*Headline 3:* Free Trial — Start in Minutes
*Description 1:* Most service business owners are making decisions on gut feel. 3rdShift gives you actual data — jobs, revenue, clients — in one clean dashboard.
*Description 2:* Try it free. No setup fees, no IT department required.
*CTA:* Try It Free

---

**Ad Variation 3 — Lead with Simplicity**

*Headline 1:* Business Analytics That Don't Require a PhD
*Headline 2:* Built for Service Business Owners
*Headline 3:* Free Trial Available Now
*Description 1:* 3rdShift turns your business data into straightforward insights you can actually act on. No spreadsheets. No confusion.
*Description 2:* Join service business owners who finally know their numbers. Start free today.
*CTA:* Get Started Free

---

**Ad Variation 4 — Lead with Speed**

*Headline 1:* See Your Business Data in Under 10 Minutes
*Headline 2:* 3rdShift Analytics — Free Trial
*Headline 3:* Simple Setup. Real Insights.
*Description 1:* Connect your tools, see your dashboard, make better decisions. 3rdShift is built so you can get up and running fast — not after a two-week onboarding call.
*Description 2:* Start your free trial and have real data working for you today.
*CTA:* Start Now

---

**Ad Variation 5 — Lead with Authority/Social Proof angle**

*Headline 1:* The Analytics Tool Built for Service Businesses
*Headline 2:* Finally Know Where Your Money Is Going
*Headline 3:* Try 3rdShift Free
*Description 1:* Service businesses are different. Your analytics tool should understand that. 3rdShift is purpose-built for how you actually operate.
*Description 2:* Stop running your business blind. Try 3rdShift free — no card required.
*CTA:* Claim Free Trial

---

### Creative Direction — Google Search

No display creative needed for Search. Ensure landing page headline matches ad message exactly. If running Performance Max alongside Search, use the visual direction from Meta below.

---

### Google Search KPIs

| Metric | Target |
|---|---|
| CTR | ≥ 5% |
| CPC | ≤ $4.00 |
| Conversion Rate (trial signup) | ≥ 8% |
| CPL (Cost per Lead) | ≤ $35 |
| Monthly Leads from Search | ≥ 25 |

---

## PLATFORM 2: META (FACEBOOK + INSTAGRAM)

### Audience Targeting

**Geographic:** United States (start national, narrow to top-performing DMAs at day 15)

**Age:** 28–54

**Gender:** All

**Detailed Targeting — Interests & Behaviors:**

*Business Interests:*
- Small business owners (Facebook behavior)
- Business management
- Entrepreneurship
- Business software
- QuickBooks (users likely running a real service business)
- Square, Jobber, ServiceTitan (service business tool users)
- Business analytics

*Service Business Signals:*
- Home services
- Cleaning services
- Landscaping
- Plumbing/HVAC (interests)
- Consulting
- Freelancing
- Professional services

*Behaviors:*
- Small business owners (Meta's own classification)
- Engaged shoppers (remove — not relevant)
- Business page admins

**Exclusions:**
- Job titles: Employee, Intern, Student
- Interests: Job searching, College
- Lookalike suppression: existing customers (upload list)

**Custom Audiences:**
- Website visitors (pixel) — retargeting with separate ad set
- Email list upload — suppression

**Lookalike Audiences (launch at day 10 if conversions allow):**
- 1% LAL from trial signups
- 1% LAL from website visitors 60-day

**Placements:** Advantage+ Placements ON — let Meta optimize. Manual fallback: Facebook Feed, Instagram Feed, Instagram Stories, Reels.

**Ad Set Budget Split:**
- Cold Audience: $25/day
- Retargeting (site visitors): $10/day

---

### Meta Ad Copy — 5 Variations

---

**Ad Variation 1 — Static Image / Carousel (Feed)**

*Headline:* You're Running a Real Business. Start Seeing Real Numbers.
*Primary Text:* Most service business owners are making their biggest decisions based on nothing but gut instinct and a bank balance check.

3rdShift changes that. Connect your tools, see your data, understand your business — in one clean dashboard built specifically for service businesses.

No data analyst needed. No complicated setup. Just clarity.

👉 Try it free for [X] days — no credit card required.
*CTA Button:* Start Free Trial

---

**Ad Variation 2 — Problem/Solution (Feed)**

*Headline:* Stop Running Your Business Blind
*Primary Text:* Here's the truth: if you don't know which services are most profitable, which clients are worth keeping, and where your revenue actually comes from — you're guessing.

3rdShift gives service business owners a clear view of their numbers without the spreadsheet nightmare.

Free trial. No card. No catch.
*CTA Button:* Try It Free

---

**Ad Variation 3 — Short & Punchy (Reels / Stories)**

*Headline:* Your Business Has Data. Are You Using It?
*Primary Text:* 3rdShift turns your business numbers into decisions you can actually make.

Built for service business owners. Free trial available now.
*CTA Button:* Get Started

---

**Ad Variation 4 — Specific Scenario (Feed)**

*Headline:* Which of Your Services Actually Makes You Money?
*Primary Text:* Most service business owners have a feeling about what's working. 3rdShift gives you the actual answer.

See your revenue by service, track your best clients, and finally know where to focus — all from one dashboard.

Start your free trial today.
*CTA Button:* Start Free Trial

---

**Ad Variation 5 — Direct Offer Focus (Retargeting)**

*Headline:* You Visited. You Haven't Started Yet. Here's Why to Go Back.
*Primary Text:* The free trial is still waiting for you. No credit card. No obligation. Just a clearer picture of how your business is actually performing.

You've already got the hardest part covered — running the business. Let 3rdShift handle making sense of the numbers.
*CTA Button:* Claim Your Free Trial

*(Note: Variation 5 is retargeting only — do not run to cold audiences)*

---

### Creative Direction — Meta

**Visual Concept for Variations 1–4 (Cold Traffic):**

- **Option A — Dashboard Mockup:** Clean, bright screenshot or stylized mockup of the 3rdShift dashboard on a laptop. Show real-looking (but not sensitive) data — revenue charts, client counts, job completion rates. Background should be minimal — light grey or white. No clutter. The visual should communicate "this is simple and professional."

- **Option B — Business Owner in Context:** Real photo (not stock-looking) of a service business owner — plumber at their truck looking at a phone, cleaning business owner reviewing a tablet at end of day, landscaper in their office. Overlay a subtle dashboard graphic. Human + data = the message.

- **Video/Reels (Variation 3):** 15-second cut. First 3 seconds: text on screen — *"Do you actually know which part of your business makes the most money?"* Seconds 4–12: fast dashboard walkthrough. Second 13–15: *"Try 3rdShift free."* No voiceover needed — on-screen text with upbeat background track.

**Design Rules:**
- Use 3rdShift brand colors throughout
- Headlines on creative should match or echo the ad headline
- Avoid generic stock photos of people pointing at charts
- Aspect ratios: 1:1 for Feed, 9:16 for Stories/Reels

---

### Meta KPIs

| Metric | Target |
|---|---|
| CPM | ≤ $18 |
| CTR (Link) | ≥ 1.5% |
| CPC (Link) | ≤ $2.50 |
| Landing Page CVR | ≥ 6% |
| CPL | ≤ $40 |
| Monthly Leads from Meta | ≥ 15 |

---

## PLATFORM 3: LINKEDIN

### Audience Targeting

**Campaign Type:** Lead Gen Form (keeps users on LinkedIn — higher completion rate than sending to external page for this audience)

**Geographic:** United States

**Job Titles (include):**
- Owner
- Founder
- Co-Founder
- Principal
- Managing Director
- President
- Sole Proprietor
- CEO (company size filtered)

**Company Size:** 1–10 employees, 11–50 employees

**Industries:**
- Construction
- Facilities Services
- Consumer Services
- Accounting (solo/small firm)
- Marketing & Advertising (small agency)
- Real Estate
- Staffing and Recruiting (small firms)
- Health, Wellness and Fitness (solo practitioners, small clinics)
- IT and Services (small shops)

**Exclude:**
- Company size: 201+ employees
- Job functions: Students, Entry Level
- Enterprise software companies (they already have tools)

**Budget:** $15/day — this will generate limited volume but validates the channel. CPL on LinkedIn for B2B SMB typically runs $60–100+. We're watching.

---

### LinkedIn Ad Copy — 5 Variations

**Campaign Type:** Single Image Ads driving to Lead Gen Form

---

**Ad Variation 1 — Direct Value**

*Headline:* Free Analytics Trial for Service Business Owners
*Introductory Text:* Running a service business means you're focused on delivery, clients, and keeping everything moving. What often gets ignored: actually knowing which parts of your business are performing.

3rdShift gives small service business owners a clear, simple analytics dashboard — no data team needed. Try it free.
*CTA:* Start Free Trial

*Lead Gen Form Headline:* Start Your Free 3rdShift Trial
*Lead Gen Form Description:* We'll set up your account and you'll have a clear view of your business performance in minutes.

---

**Ad Variation 2 — Question Hook**

*Headline:* Do You Know Which Service You Offer Is Most Profitable?
*Introductory Text:* Most service business owners don't — and that's not a criticism. When you're running the operation, there's no time to dig into the data.

That's exactly what 3rdShift is built for. Connect your existing tools and get a clear dashboard that shows you exactly where your business stands.

Free trial. No commitment. No credit card.
*CTA:* Try It Free

---

**Ad Variation 3 — Efficiency Angle**

*Headline:* Spend 10 Minutes Setting This Up. Save Hours Every Month.
*Introductory Text:* 3rdShift pulls your business data into one dashboard so you're not manually piecing together reports from three different apps.

Built for service business owners who want answers, not more complexity.

Start your free trial today.
*CTA:* Get Started Free

---

**Ad Variation 4 — Credibility/Authority**

*Headline:* Analytics Built Specifically for Service Businesses
*Introductory Text:* Generic analytics tools are built for everyone — which means they're optimized for no one in particular.

3rdShift is built around how service businesses actually operate: recurring clients, job-based revenue, seasonal patterns, and team performance. See the difference with a free trial.
*CTA:* Claim Free Trial

---

**Ad Variation 5 — Soft Challenge**

*Headline:* Your Competitors Are Starting to Use Data. Are You?
*Introductory Text:* The service businesses pulling ahead right now aren't necessarily better operators — they just know their numbers better.

3rdShift makes that possible for small service businesses without an analytics budget. Free trial available now — no card required.
*CTA:* Start Free Trial

---

### Creative Direction — LinkedIn

- **Visual:** Professional, clean. Show the 3rdShift dashboard on a laptop or desktop monitor. Background: dark or neutral office setting or pure white. Minimal text on the image itself — let the ad copy carry the message.
- **Avoid:** Anything that looks like a stock photo ad. LinkedIn audiences are skeptical and professional — keep it clean and direct.
- **Aspect Ratio:** 1.91:1 for single image ads
- **Logo:** 3rdShift logo clearly visible in top corner of creative

---

### LinkedIn KPIs

| Metric | Target |
|---|---|
| CTR | ≥ 0.45% |
| CPL (Lead Gen Form) | ≤ $80 |
| Lead Form Completion Rate | ≥ 10% |
| Monthly Leads from LinkedIn | ≥ 4 |

---

## A/B TESTING PLAN

Run tests sequentially — one variable at a time. Do not test everything at once.

---

### Week 1–2: Headline Angle Test (All Platforms)

**What we're testing:** Which message hook drives the most trial signups

| Test Cell | Angle | Example |
|---|---|---|
| A | Pain Point | "Stop Running Your Business Blind" |
| B | Free Offer | "Free Analytics Trial — No Card Required" |

**Winner criteria:** Whichever produces lower CPL with statistical significance at 90%+ confidence after 200+ impressions per variant. On Meta, wait for at minimum 50 link clicks per variant before calling it.

---

### Week 2–3: Creative Format Test (Meta Only)

**What we're testing:** Dashboard mockup vs. real business owner photo

| Test Cell | Creative |
|---|---|
| A | Clean dashboard screenshot on device |
| B | Photo of service business owner with phone/tablet |

**Winner criteria:** Higher CTR and lower CPL after 500+ impressions each.

---

### Week 3–4: CTA Button Text Test (Meta + Google)

**What we're testing:** Which CTA drives more conversions

| Test Cell | CTA |