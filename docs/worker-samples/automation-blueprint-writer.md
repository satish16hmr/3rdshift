# Sample output: automation-blueprint-writer — Automation Blueprint Writer

**Test input used:**
```json
{
  "process": "Lead nurturing after free trial signup",
  "tools": "HubSpot, Slack, Stripe",
  "trigger": "User signs up for free trial",
  "goal": "Convert trial to paid within 14 days"
}
```

**Generation time:** 72s
**Credits deducted:** 0
**Output tokens (estimated):** ~3205
**Output char count:** 12819

**Full output below:**

---

# Automation Blueprint: Free Trial Lead Nurturing → Paid Conversion
**Platform:** Make (formerly Integromat)
**Estimated Build Time:** 3–4 hours
**Trigger App:** HubSpot

---

## What This Does

When someone signs up for a free trial in HubSpot, this automation runs a 14-day nurturing sequence. It sends timed emails through HubSpot, alerts your team in Slack at key moments, and watches Stripe for a payment event to close the loop. If the user converts, the sequence stops and the team gets notified. If they don't, they get a final push on day 14.

---

## Before You Build

You need these things ready before touching Make:

- HubSpot: A contact property called `trial_start_date` (Date picker type). Also a lifecycle stage or deal stage that marks someone as a trial user. A workflow or form that sets this property on signup.
- Slack: A channel called `#trial-conversions` (or rename to match yours throughout this blueprint).
- Stripe: Webhook access enabled. You'll need your Stripe secret key and webhook signing secret.
- Make: Accounts connected to all three apps with the right permissions (HubSpot Marketing + CRM, Slack Bot, Stripe).

---

## Scenario 1: Trial Start — Immediate Slack Alert + Tag Contact

**Purpose:** The moment a trial starts, alert the team and tag the contact so the sequence can target them.

---

**Module 1**
- App: `HubSpot`
- Module type: `Watch Contacts`
- Trigger: `New Contact` — but filter by property. In the Filter field inside the module, set:
  - Property: `trial_start_date`
  - Condition: `Is Known`
  - Evaluation: `Only newly set` (toggle this on — it prevents re-triggering on existing contacts)
- Polling interval: `5 minutes`

---

**Module 2**
- App: `HubSpot`
- Module type: `Update a Contact`
- Connect to Module 1's output
- Contact ID field: map `{{1.id}}` (the contact ID from Module 1)
- Properties to update:
  - `hs_lead_status` → set value to `IN_PROGRESS`
  - `lifecycle_stage` → set value to `lead` (or your equivalent trial stage)
  - Custom property `trial_nurture_active` → set to `true` (create this boolean property in HubSpot first)

---

**Module 3**
- App: `Slack`
- Module type: `Create a Message`
- Channel: `#trial-conversions`
- Message text (paste this exactly, the dynamic fields will map automatically):

```
🚀 *New Trial Started*
*Name:* {{1.properties.firstname.value}} {{1.properties.lastname.value}}
*Email:* {{1.properties.email.value}}
*Company:* {{1.properties.company.value}}
*Trial Start Date:* {{1.properties.trial_start_date.value}}
*Owner:* {{1.properties.hubspot_owner_id.value}}

<14-day clock is running>
```

- Map each `{{1.properties...}}` field by clicking the field and selecting the corresponding output from Module 1.

---

## Scenario 2: Day 3 Check-In Email

**Purpose:** Trigger a personal-feeling check-in email on day 3 of the trial.

Create this as a **separate Make scenario** running on a schedule.

---

**Module 1**
- App: `Make — Schedule`
- Module type: `Basic Scheduling`
- Run every: `1 Day`
- Time: `9:00 AM` (your team's timezone)

---

**Module 2**
- App: `HubSpot`
- Module type: `Search Contacts`
- Filter:
  - Property: `trial_nurture_active` → equals → `true`
  - Property: `trial_start_date` → equals → `[TODAY minus 3 days]`
  - To set the date math: In the field value, use Make's date function: `{{formatDate(addDays(now; -3); "YYYY-MM-DD")}}`
- Max results: `100` (run paginated if your trial volume exceeds this)

---

**Module 3**
- App: `Make — Iterator`
- Module type: `Iterator`
- Array to iterate: map `{{2.results}}` (the array of contacts from Module 2)
- This splits the list so the next modules run once per contact.

---

**Module 4**
- App: `HubSpot`
- Module type: `Send a Single Send Email`
- To Email: map `{{3.properties.email.value}}`
- Email Name: select your pre-built HubSpot email named `Trial Day 3 - Check In` (build this email in HubSpot Marketing > Email first)
- Contact ID: map `{{3.id}}`

> **Email content guidance for your HubSpot template:** Subject: "Quick check — how's it going so far?" Body should ask one specific question about their use case, offer a 15-minute call link (Calendly or equivalent), and include your help doc URL. Keep it under 150 words. Send from the assigned owner's email address using HubSpot's "From" token.

---

**Module 5**
- App: `HubSpot`
- Module type: `Create a Note (Engagement)`
- Contact ID: map `{{3.id}}`
- Note body: `Automated Day 3 check-in email sent via Make.`
- Timestamp: `{{now}}`

---

## Scenario 3: Day 7 — Usage Check + Conditional Slack Alert

**Purpose:** On day 7, check engagement. If the contact has not opened any emails, fire a Slack alert to the owner. If they have, send a feature highlight email.

---

**Module 1**
- App: `Make — Schedule`
- Run every: `1 Day` at `9:00 AM`

---

**Module 2**
- App: `HubSpot`
- Module type: `Search Contacts`
- Filter:
  - `trial_nurture_active` → equals → `true`
  - `trial_start_date` → equals → `{{formatDate(addDays(now; -7); "YYYY-MM-DD")}}`

---

**Module 3**
- App: `Make — Iterator`
- Array: `{{2.results}}`

---

**Module 4**
- App: `Make — Router`
- Module type: `Router`
- This splits into two paths based on email engagement.

**Path A — Not Engaged (no email opens)**
- Filter condition on Path A:
  - Field: `{{3.properties.hs_email_open.value}}`
  - Condition: `Equal to` → `0`
  - (This property counts total email opens on the contact record)

> **Module 4A-1**
> - App: `Slack`
> - Module type: `Create a Message`
> - Channel: `#trial-conversions`
> - Message:
> ```
> ⚠️ *Day 7 - No Engagement Alert*
> *Contact:* {{3.properties.firstname.value}} {{3.properties.lastname.value}}
> *Email:* {{3.properties.email.value}}
> *Owner:* {{3.properties.hubspot_owner_id.value}}
>
> This trial user hasn't opened any emails. Manual outreach recommended today.
> ```

**Path B — Engaged (has opened at least one email)**
- Filter condition on Path B:
  - Field: `{{3.properties.hs_email_open.value}}`
  - Condition: `Greater than` → `0`

> **Module 4B-1**
> - App: `HubSpot`
> - Module type: `Send a Single Send Email`
> - Email Name: `Trial Day 7 - Feature Highlight`
> - To Email: map `{{3.properties.email.value}}`
> - Contact ID: map `{{3.id}}`

> **Email content guidance:** Subject: "You're halfway through — here's what most people miss." Body should spotlight one power feature they may not have used, include a short video or GIF, and have a single CTA button: "Upgrade Now" linking to your Stripe payment page.

---

## Scenario 4: Day 12 — Urgency Email

**Purpose:** Two days before trial ends, send a plain-text urgency email.

---

**Module 1**
- App: `Make — Schedule`
- Run every: `1 Day` at `9:00 AM`

---

**Module 2**
- App: `HubSpot`
- Module type: `Search Contacts`
- Filter:
  - `trial_nurture_active` → equals → `true`
  - `trial_start_date` → equals → `{{formatDate(addDays(now; -12); "YYYY-MM-DD")}}`

---

**Module 3**
- App: `Make — Iterator`
- Array: `{{2.results}}`

---

**Module 4**
- App: `HubSpot`
- Module type: `Send a Single Send Email`
- Email Name: `Trial Day 12 - Urgency`
- To Email: map `{{3.properties.email.value}}`
- Contact ID: map `{{3.id}}`

> **Email content guidance:** Subject: "Your trial ends in 2 days." Plain text format only — no images, no graphics. One paragraph that clearly states what they lose when the trial ends. One paragraph with a simple offer if applicable (e.g., "Start today and get your first month for $X"). One link: your upgrade page. Sign off from a real person's name.

---

## Scenario 5: Stripe Payment Detected — Stop Sequence + Celebrate

**Purpose:** When a user pays in Stripe, immediately halt nurturing and notify the team.

---

**Module 1**
- App: `Stripe`
- Module type: `Watch Events` (Webhook-based)
- Event to watch: `payment_intent.succeeded`
- In your Stripe dashboard: Go to Developers > Webhooks > Add Endpoint. Set the endpoint URL to the Make webhook URL this module generates. Select the event `payment_intent.succeeded`.

---

**Module 2**
- App: `Make — Tools`
- Module type: `Set Variable`
- Variable name: `customer_email`
- Variable value: `{{1.data.object.receipt_email}}`
- (This extracts the email from the Stripe payment object)

---

**Module 3**
- App: `HubSpot`
- Module type: `Search Contacts`
- Filter:
  - Property: `email`
  - Condition: `Equal to`
  - Value: `{{customer_email}}`

---

**Module 4**
- App: `Make — Filter` (add between Module 3 and Module 5)
- Label: `Contact found in HubSpot`
- Condition: `{{3.total}}` Greater than `0`
- This prevents the scenario from erroring if the Stripe email doesn't match any HubSpot contact.

---

**Module 5**
- App: `HubSpot`
- Module type: `Update a Contact`
- Contact ID: `{{3.results[].id}}` (map the first result's ID)
- Properties to update:
  - `trial_nurture_active` → `false`
  - `lifecycle_stage` → `customer`
  - `hs_lead_status` → `CONNECTED`

---

**Module 6**
- App: `HubSpot`
- Module type: `Create a Note (Engagement)`
- Contact ID: map from Module 5
- Note body: `Converted from trial to paid. Stripe payment confirmed. Nurture sequence stopped.`
- Timestamp: `{{now}}`

---

**Module 7**
- App: `Slack`
- Module type: `Create a Message`
- Channel: `#trial-conversions`
- Message:
```
💰 *Trial Converted — Paid Customer!*
*Email:* {{customer_email}}
*Amount:* ${{formatNumber(divide(1.data.object.amount; 100); 2)}} {{upper(1.data.object.currency)}}
*Payment ID:* {{1.data.object.id}}

HubSpot record updated. Nurture sequence stopped. Go close the loop! 🎉
```

> Note on the amount: Stripe returns the charge in cents. The `divide(1.data.object.amount; 100)` formula converts it to dollars. Adjust if you operate in a zero-decimal currency.

---

## Scenario 6: Day 14 — Trial Expired, No Conversion

**Purpose:** Final touchpoint for contacts who never paid.

---

**Module 1**
- App: `Make — Schedule`
- Run every: `1 Day` at `9:00 AM`

---

**Module 2**
- App: `HubSpot`
- Module type: `Search Contacts`
- Filter:
  - `trial_nurture_active` → equals → `true`
  - `trial_start_date` → equals → `{{formatDate(addDays(now; -14); "YYYY-MM-DD")}}`

---

**Module 3**
- App: `Make — Iterator`
- Array: `{{2.results}}`

---

**Module 4**
- App: `HubSpot`
- Module type: `Send a Single Send Email`
- Email Name: `Trial Day 14 - Last Chance`
- To Email: `{{3.properties.email.value}}`
- Contact ID: `{{3.id}}`

> **Email content guidance:** Subject: "Your trial has ended — here's the door if you want back in." Acknowledge the trial is over. No fake urgency. Give them a direct link to restart or upgrade. Offer a one-line reason to reply if they had issues (friction point capture).

---

**Module 5**
- App: `HubSpot`
- Module type: `Update a Contact`
- Contact ID: `{{3.id}}`
- Properties to update:
  - `trial_nurture_active` → `false`
  - `hs_lead_status` → `UNQUALIFIED`
  - Custom property `trial_outcome` → `expired_no_conversion` (create this single-line text property in HubSpot)

---

**Module 6**
- App: `Slack`
- Module type: `Create a Message`
- Channel: `#trial-conversions`
- Message:
```
🔴 *Trial Expired - No Conversion*
*Name:* {{3.properties.firstname.value}} {{3.properties.lastname.value}}
*Email:* {{3.properties.email.value}}
*Owner:* {{3.properties.hubspot_owner_id.value}}

Trial ended without converting. Final email sent. Contact marked as unqualified.
```

---

## Error Handling — Apply to Every Scenario

In Make, for each module in each scenario:

1. Right-click the module → `Set error handler`
2. Select `Ignore` for the HubSpot search modules (empty results should not stop the scenario)
3. Select `Break` for the HubSpot update and Slack modules (you want to know if these fail)
4. Turn on `Auto-commit` on each scenario so partial runs save progress
5. Enable email notifications for failed runs: Go to Make account settings → Notifications → check `Scenario errors`

---

## Testing Checklist

Run through these in order before going live:

- [ ] Create a test contact in HubSpot with `trial_start_date` set to today. Confirm Scenario 1 fires within 5 minutes and posts to Slack.
- [ ] Manually set `trial_start_date` to 3 days ago on the test contact. Run Scenario 2 manually (click Run Once). Confirm email sends and note is created.
- [ ] Set `trial_start_date` to 7 days ago. Set `hs_email_open` to 0. Run Scenario 3. Confirm Slack alert fires on Path A.
- [ ] Same as above but set `hs_email_open` to 1. Confirm email fires on Path B.
- [ ] Make a real $1.00 test payment in Stripe's test mode using the test contact's email. Confirm Scenario 5 fires, HubSpot updates, and Slack celebrates.
- [ ] Set `trial_start_date` to 14 days ago. Run Scenario 6 manually. Confirm final email sends and contact status updates to `UNQUALIFIED`.
- [ ] Verify that after Scenario 5 fires (paid), the day 14 scenario skips that contact because `trial