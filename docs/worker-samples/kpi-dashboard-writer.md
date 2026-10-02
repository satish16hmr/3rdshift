# Sample output: kpi-dashboard-writer — Brody · KPI Dashboard Writer

**Test input used:**
```
Business type: SaaS. Metrics: MRR, churn rate, DAU, NPS, CAC, LTV. Reporting period: Monthly. Audience: executive team.
```

**Generation time:** 67s
**Credits deducted:** 0 (direct API call — bypassed task system for batch generation)
**Output tokens:** 3994
**Output char count:** 14716

**Full output below:**

---

# KPI Dashboard Framework
**Prepared by Brody, KPI Dashboard Writer @ 3rdShift**

---

## 1. Executive Summary

This framework is built for a SaaS business presenting to an executive team on a monthly cadence. Given the metrics provided, the focus is on revenue health, retention efficiency, and growth sustainability — the three levers executives need to make capital allocation and go-to-market decisions. The framework reorders your six requested metrics into a causal hierarchy so your dashboard tells a story, not just a scorecard.

---

## 2. North Star Metric

**Net Revenue Retention (NRR)**

NRR is the single metric that captures whether your existing customer base is growing, shrinking, or holding. It compounds MRR, churn, expansion, and contraction into one number that reflects the true health of the business engine. For an executive team, NRR answers the question that matters most: *if we stopped acquiring new customers tomorrow, would this business grow or shrink?*

MRR was not chosen as the North Star because MRR can grow while the business quietly deteriorates — if new logo revenue is masking high churn, MRR hides the rot. NRR exposes it.

Industry standard: NRR above 100% signals that existing customers are expanding faster than they churn. NRR below 100% means the bucket has a hole.

**Target:** TBD — set after 30 days of baseline data. Benchmark reference: best-in-class SaaS companies sustain NRR of 120%+; healthy baseline is 100–110%.

---

## 3. Input Metrics
*Leading indicators that drive NRR upward or downward.*

1. Daily Active Users (DAU)
2. Net Promoter Score (NPS)
3. Customer Acquisition Cost (CAC)
4. New MRR Added (New Logo MRR)

---

## 4. Output Metrics
*Lagging indicators produced by a healthy or unhealthy NRR.*

1. Monthly Recurring Revenue (MRR) — total
2. Customer Lifetime Value (LTV)
3. LTV:CAC Ratio
4. Gross Revenue Churn Rate

---

## 5. Guardrail Metrics
*Metrics to monitor so you don't break the business chasing NRR growth.*

1. Gross Margin
2. CAC Payback Period
3. Support Ticket Volume per Customer

---

## 6. Per-Metric Cards

---

**Net Revenue Retention (NRR)**
The percentage of recurring revenue retained from existing customers over a period, including expansion and contraction, excluding new logos. Formula: ((MRR at start of period + expansion MRR − contraction MRR − churned MRR) ÷ MRR at start of period) × 100. Data source: billing system (Stripe, Chargebee, or equivalent). Frequency: monthly. Target: TBD — set after 30 days of baseline data; benchmark 100–120%+.

---

**Daily Active Users (DAU)**
The count of unique users who complete at least one meaningful product action in a given day, averaged across the reporting month. Formula: sum of daily unique active users ÷ number of days in the month. Data source: product analytics (Mixpanel, Amplitude, or equivalent). Frequency: reviewed daily, reported monthly trend. Target: TBD — set after establishing 30-day baseline; directional goal is month-over-month growth.

---

**Net Promoter Score (NPS)**
A measure of customer willingness to recommend the product, calculated from periodic survey responses. Formula: % Promoters (score 9–10) − % Detractors (score 0–6). Data source: NPS survey tool (Delighted, Typeform, or equivalent). Frequency: surveyed quarterly, reviewed monthly for trend movement. Target: TBD — set after first full survey cycle; SaaS industry median sits around 30–40, best-in-class exceeds 50.

---

**Customer Acquisition Cost (CAC)**
The fully loaded cost to acquire one new paying customer in a given period. Formula: (total sales + marketing spend) ÷ number of new customers acquired. Data source: finance system + CRM. Frequency: monthly. Target: TBD — set after 30 days of baseline; evaluated in context of LTV:CAC ratio, not in isolation.

---

**New MRR Added (New Logo MRR)**
Recurring revenue generated exclusively from customers who signed in the current period. Formula: sum of first-month MRR from all new customers acquired in the period. Data source: billing system + CRM. Frequency: monthly. Target: TBD — set based on growth rate targets once baseline is established.

---

**Monthly Recurring Revenue (MRR)**
The normalized, predictable revenue the business generates in a given month from all active subscriptions. Formula: sum of (active customers × monthly plan value) at end of period. Data source: billing system. Frequency: monthly. Target: TBD — set from financial model or board plan.

---

**Customer Lifetime Value (LTV)**
The projected total revenue a customer generates over their full relationship with the business. Formula: Average MRR per customer ÷ monthly churn rate. Data source: billing system. Frequency: monthly. Target: TBD — evaluated against CAC; minimum healthy ratio is LTV:CAC ≥ 3:1.

---

**LTV:CAC Ratio**
The return the business earns on each dollar spent acquiring a customer. Formula: LTV ÷ CAC. Data source: derived from billing system + finance system. Frequency: monthly. Target: ≥ 3:1 is the widely cited SaaS industry standard for sustainable unit economics; >5:1 may indicate underinvestment in growth.

---

**Gross Revenue Churn Rate**
The percentage of MRR lost from cancellations and downgrades in a given period, before accounting for expansion. Formula: (churned MRR + contraction MRR) ÷ MRR at start of period × 100. Data source: billing system. Frequency: monthly. Target: TBD — best-in-class SaaS targets below 1% monthly gross churn; anything above 2% monthly warrants immediate investigation.

---

**Gross Margin**
The percentage of revenue remaining after subtracting the direct cost of delivering the product (hosting, infrastructure, support headcount directly tied to delivery). Formula: (Revenue − Cost of Goods Sold) ÷ Revenue × 100. Data source: finance system. Frequency: monthly. Target: SaaS businesses with healthy unit economics typically sustain 70–80%+ gross margins; below 60% is a structural problem.

---

**CAC Payback Period**
The number of months required to recover the cost of acquiring a customer through their recurring payments. Formula: CAC ÷ (Average MRR per customer × Gross Margin %). Data source: billing system + finance system. Frequency: monthly. Target: TBD — under 12 months is strong for SMB SaaS; under 18 months is acceptable for mid-market; enterprise can extend to 24 months.

---

**Support Ticket Volume per Customer**
The average number of support tickets generated per active customer in the period. Formula: total support tickets opened ÷ total active customers. Data source: support platform (Zendesk, Intercom, or equivalent). Frequency: monthly. Target: TBD — directional goal is flat or declining as product matures; spikes signal product issues that will precede churn.

---

## 7. Dashboard Layout

**Home View — Executive Monthly Snapshot**
This is the single page executives see first. It contains four elements only: NRR (North Star, prominently placed), MRR total with month-over-month delta, LTV:CAC Ratio, and Gross Revenue Churn Rate. These four tell the complete story of revenue health in under 30 seconds. Every number on the home view shows current period value, prior period value, and directional arrow.

**Tier 1 Drill-Down — Growth Engine**
One click from the home view. Contains: New MRR Added, CAC, CAC Payback Period, and DAU monthly trend. This view answers: *is the growth engine working efficiently?*

**Tier 2 Drill-Down — Retention & Satisfaction**
One click from the home view. Contains: NPS trend, Gross Revenue Churn Rate breakdown (by segment or plan if available), and Support Ticket Volume per Customer. This view answers: *are we keeping the customers we have?*

**Tier 3 Drill-Down — Unit Economics**
Accessed from either Tier 1 or Tier 2. Contains: LTV, Gross Margin, full LTV:CAC build. This view answers: *is the business model structurally sound?*

**Reporting Cadence**
Monthly executive review covers home view + tier summaries. Tier 1 (growth engine) metrics should be reviewed weekly by the relevant function leads — do not wait until month-end to discover CAC spiked. NRR and churn are lagging; DAU and new MRR are leading, so operational teams should track those on a tighter loop.

---

## 8. Tool-Specific Build Notes

*No Dashboard Tool was provided. This section has been omitted. Resubmit with your preferred tool (e.g., Looker, Tableau, Notion, Google Sheets, Metabase) to receive concrete build instructions.*

---

## 9. Vanity Metrics to Avoid

**Total Signups**
Signups without activation context are meaningless. A user who creates an account and never returns costs you infrastructure and skews DAU if your "active" definition is loose. Replace with Activated Users — those who complete a defined activation milestone.

**Total Registered Users / Seat Count**
Seat count looks good in a board slide and lies in a retention conversation. Track paying active seats, not total seats ever provisioned.

**Page Views and Logins**
Logging in is not engagement. Define a meaningful product action (core feature used, report generated, workflow completed) and gate your DAU definition on that action — not on a session start.

**Gross MRR Without Churn Context**
MRR without NRR or churn rate alongside it is a vanity number for an executive audience. A business adding $50K new MRR while losing $60K churned MRR looks fine on the MRR line if you don't show the components.

**NPS as a Standalone Score**
A single NPS number without trend line and without verbatim theme analysis tells executives nothing actionable. Always show NPS as a trend and pair it with the top 2–3 reasons from detractor responses.

---

## 10. Next Steps

**Action 1 — Audit your "active" definition within 48 hours.**
Before any dashboard is built, align the executive team on what constitutes an "active" user for DAU. Pull three examples of user sessions from your product analytics tool and test your current definition against them. Document the agreed definition in writing. Every metric downstream of engagement is only as good as this definition.

**Action 2 — Pull 3 months of billing data and calculate baseline NRR, churn, and LTV:CAC by Day 7.**
Do not set targets before you have a baseline. Export monthly billing data for the last 90 days, calculate NRR and gross churn for each month, and compute your current LTV:CAC. These three numbers will immediately tell you whether you have a retention problem, a unit economics problem, or neither — and will set realistic targets for the next 90 days.

**Action 3 — Map every metric to a data owner before Day 14.**
Assign one named person as the data owner for each metric category: billing metrics (finance or RevOps), product metrics (product or engineering), customer metrics (CS or CX), and cost metrics (finance). A dashboard with no owner becomes a dashboard no one trusts. Each owner is responsible for data accuracy, not for hitting the number — keep those roles separate.

---

```json
{
  "dashboard_framework": {
    "business_type": "SaaS",
    "reporting_period": "Monthly",
    "audience": "Executive Team",
    "north_star": {
      "name": "Net Revenue Retention (NRR)",
      "formula": "((MRR_start + expansion_MRR - contraction_MRR - churned_MRR) / MRR_start) * 100",
      "data_source": "Billing system",
      "frequency": "Monthly",
      "target": "TBD - set after 30 days of baseline data; benchmark 100-120%+"
    },
    "input_metrics": [
      {
        "name": "Daily Active Users (DAU)",
        "formula": "Sum of daily unique active users / number of days in month",
        "data_source": "Product analytics platform",
        "frequency": "Daily tracked, monthly reported",
        "target": "TBD - set after 30-day baseline; goal is MoM growth"
      },
      {
        "name": "Net Promoter Score (NPS)",
        "formula": "% Promoters (9-10) - % Detractors (0-6)",
        "data_source": "NPS survey tool",
        "frequency": "Surveyed quarterly, reviewed monthly",
        "target": "TBD - after first survey cycle; SaaS median ~30-40"
      },
      {
        "name": "Customer Acquisition Cost (CAC)",
        "formula": "(Total sales spend + total marketing spend) / new customers acquired",
        "data_source": "Finance system + CRM",
        "frequency": "Monthly",
        "target": "TBD - evaluated in context of LTV:CAC ratio"
      },
      {
        "name": "New MRR Added (New Logo MRR)",
        "formula": "Sum of first-month MRR from all new customers in period",
        "data_source": "Billing system + CRM",
        "frequency": "Monthly",
        "target": "TBD - set from growth rate targets"
      }
    ],
    "output_metrics": [
      {
        "name": "Monthly Recurring Revenue (MRR)",
        "formula": "Sum of (active customers x monthly plan value) at end of period",
        "data_source": "Billing system",
        "frequency": "Monthly",
        "target": "TBD - set from financial model or board plan"
      },
      {
        "name": "Customer Lifetime Value (LTV)",
        "formula": "Average MRR per customer / monthly churn rate",
        "data_source": "Billing system",
        "frequency": "Monthly",
        "target": "TBD - evaluated against CAC; LTV:CAC >= 3:1 minimum"
      },
      {
        "name": "LTV:CAC Ratio",
        "formula": "LTV / CAC",
        "data_source": "Billing system + Finance system",
        "frequency": "Monthly",
        "target": ">= 3:1 (SaaS industry standard); >5:1 may signal underinvestment"
      },
      {
        "name": "Gross Revenue Churn Rate",
        "formula": "(Churned MRR + contraction MRR) / MRR at start of period * 100",
        "data_source": "Billing system",
        "frequency": "Monthly",
        "target": "TBD - best-in-class <1% monthly; >2% monthly requires immediate action"
      }
    ],
    "guardrail_metrics": [
      {
        "name": "Gross Margin",
        "formula": "(Revenue - COGS) / Revenue * 100",
        "data_source": "Finance system",
        "frequency": "Monthly",
        "target": "70-80%+ for healthy SaaS unit economics; <60% is structural concern"
      },
      {
        "name": "CAC Payback Period",
        "formula": "CAC / (Average MRR per customer * Gross Margin %)",
        "data_source": "Billing system + Finance system",
        "frequency": "Monthly",
        "target": "TBD - <12 months SMB, <18 months mid-market, <24 months enterprise"
      },
      {
        "name": "Support Ticket Volume per Customer",
        "formula": "Total support tickets opened / total active customers",
        "data_source": "Support platform",
        "frequency": "Monthly",
        "target": "TBD - directional goal is flat or declining as product matures"
      }
    ]
  }
}
```