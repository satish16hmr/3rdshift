# Sample output: bookkeeping-summarizer — Bookkeeping Summarizer

**Test input used:**
```json
{
  "transactions": "Date, Description, Amount\n2026-04-01, AWS, -$127\n2026-04-03, Stripe Payout, +$3240\n2026-04-05, Anthropic API, -$89\n2026-04-10, Vercel, -$20\n2026-04-15, Stripe Payout, +$2890",
  "time_period": "April 1-15 2026",
  "business_type": "SaaS"
}
```

**Generation time:** 8s
**Credits deducted:** 0
**Output tokens (estimated):** ~326
**Output char count:** 1304

**Full output below:**

---

## 1. Key Observations

Software/SaaS is the sole expense driver this period, totaling $236.00 across three vendors (AWS, Anthropic API, and Vercel). Spend in this category is entirely routine for a SaaS operation and shows no unusual concentration in any single vendor. Net margin comes in strong at 94.3%, reflecting minimal overhead against healthy client revenue in this two-week window.

---

## 2. Revenue Summary

| Date | Description | Amount |
| --- | --- | --- |
| 2026-04-03 | Stripe Payout | +$3,240.00 |
| 2026-04-15 | Stripe Payout | +$2,890.00 |
| **Total** | | **+$6,130.00** |

---

## 3. Expense Summary

**Software/SaaS** -- 100% of total spend

| Date | Description | Amount |
| --- | --- | --- |
| 2026-04-01 | AWS | -$127.00 |
| 2026-04-05 | Anthropic API | -$89.00 |
| 2026-04-10 | Vercel | -$20.00 |
| Subtotal | | -$236.00 |

| Category | Subtotal | % of Spend |
| --- | --- | --- |
| Software/SaaS | -$236.00 | 100% |
| Total Expenses | -$236.00 | 100% |

---

## 4. Net Income Statement

| | |
| --- | --- |
| Total Revenue | +$6,130.00 |
| Total Expenses | -$236.00 |
| Net Income | +$5,894.00 |
| Net Margin | 96.1% |

**Verification:** $6,130.00 - $236.00 = $5,894.00 - Net Margin: ($5,894.00 / $6,130.00) x 100 = 96.1%

### Flagged Items

No anomalies detected this period.