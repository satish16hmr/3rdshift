# Sample output: standard-operating-procedure-writer — Flynn · Standard Operating Procedure Writer

**Test input used:**
```
Process: Customer support ticket handling. Department: Customer Success. Create a step-by-step SOP.
```

**Generation time:** 34s
**Credits deducted:** 0 (direct API call — bypassed task system for batch generation)
**Output tokens:** 1834
**Output char count:** 7218

**Full output below:**

---

# SOP: Customer Support Ticket Handling
**Department:** Customer Success
**Document ID:** CS-001
**Version:** 1.0

---

## Purpose

This SOP ensures every customer support ticket is handled consistently, resolved efficiently, and documented accurately. Any Customer Success team member should be able to follow this process from start to finish.

---

## Scope

Applies to all incoming support tickets regardless of channel — email, chat, web form, or phone-to-ticket conversion.

---

## Roles and Accountability

| Role | Responsibility |
|---|---|
| **Support Agent** | First response, triage, resolution, and documentation |
| **Team Lead** | Escalation review, quality checks, SLA oversight |
| **Subject Matter Expert (SME)** | Technical or specialized resolution support |
| **Customer Success Manager** | High-priority and escalation ownership |

---

## SLA Response Targets

| Priority | First Response | Resolution Target |
|---|---|---|
| Critical (P1) | 1 hour | 4 hours |
| High (P2) | 4 hours | 24 hours |
| Medium (P3) | 8 hours | 3 business days |
| Low (P4) | 24 hours | 5 business days |

---

## Step-by-Step Process

### Step 1 — Receive and Acknowledge the Ticket

1. Log into the ticketing system at the start of each shift.
2. Open the unassigned ticket queue.
3. Select the oldest unassigned ticket first, unless a priority flag overrides the order.
4. Send an acknowledgment reply to the customer within the SLA window for that ticket's priority. Use the acknowledgment template below.

> **Acknowledgment Template:**
> *"Hi [Name], thank you for reaching out. We've received your request and a member of our team is looking into it now. Your ticket number is [#]. We'll follow up by [date/time]."*

5. Assign the ticket to yourself in the system.

---

### Step 2 — Review and Categorize

1. Read the full ticket before doing anything else. Do not skim.
2. Check for any prior tickets from the same customer. Review their history.
3. Assign the correct **category** from the approved list in the ticketing system (e.g., Billing, Technical, Account Access, General Inquiry).
4. Assign the correct **priority level** using this decision tree:

```
Is the customer fully unable to use the product or service?
    YES → Is this affecting multiple users or accounts?
              YES → P1 (Critical)
              NO  → P2 (High)
    NO  → Is there a significant feature or function impacted?
              YES → P3 (Medium)
              NO  → P4 (Low)
```

5. Add relevant tags to the ticket for reporting purposes.
6. If the ticket was miscategorized by an automated system, correct it before proceeding.

---

### Step 3 — Investigate the Issue

1. Reproduce or verify the issue if possible before responding with a solution.
2. Check the internal knowledge base for known issues or existing solutions.
3. Check current system status dashboards for active incidents or outages.
4. If a known solution exists, move directly to Step 4.
5. If the issue is unclear, request clarification from the customer. Be specific about what you need.

> **Clarification Template:**
> *"Hi [Name], to help resolve this quickly, could you provide [specific detail]? Once we have that, we'll move forward right away."*

6. While waiting on clarification, set a follow-up reminder for 24 hours. Do not let the ticket sit without action.

---

### Step 4 — Resolve or Escalate

**If you can resolve the ticket:**

1. Apply the solution.
2. Test the fix where applicable.
3. Document the steps taken in the internal ticket notes.
4. Move to Step 5.

**If the ticket requires escalation:**

1. Determine the correct escalation path:
   - **Technical issue beyond agent scope** → Assign to SME queue
   - **Billing dispute or account exception** → Assign to Customer Success Manager
   - **Bug or product defect** → Log in the bug tracker and link to the ticket, then assign to Team Lead
   - **Legal or compliance concern** → Notify Team Lead immediately, do not respond to customer without approval

2. Add detailed internal notes before transferring. Include:
   - What you already tried
   - What the customer was told
   - Why you are escalating

3. Notify the customer that their ticket is being escalated.

> **Escalation Notification Template:**
> *"Hi [Name], we want to make sure this gets the right attention. I'm connecting you with [team/specialist] who will follow up by [date/time]. Your ticket number remains [#]."*

4. Do not close the ticket. Leave it open and monitor until the escalated team updates it.

---

### Step 5 — Communicate the Resolution

1. Contact the customer with a clear explanation of what the issue was and what was done to fix it.
2. Use plain language. Avoid technical jargon unless the customer has demonstrated they prefer it.
3. Include any steps the customer needs to take on their end, if applicable.
4. Ask the customer to confirm the issue is resolved before closing.

> **Resolution Template:**
> *"Hi [Name], I wanted to let you know that [brief description of resolution]. Please give it a try and let us know if everything is working as expected. If you have any questions, we're here to help."*

---

### Step 6 — Close and Document

1. Wait for customer confirmation before closing. If no response is received within **48 hours**, send one follow-up.
2. If there is still no response after the follow-up, close the ticket and note "Closed — no customer response after follow-up."
3. Before closing, complete all required fields in the ticketing system:
   - [ ] Resolution summary written in internal notes
   - [ ] Correct category and priority confirmed
   - [ ] Time spent logged
   - [ ] Tags updated
   - [ ] Related tickets linked, if applicable
   - [ ] Knowledge base article created or updated, if a new issue was encountered

4. Set ticket status to **Closed**.

---

### Step 7 — Post-Resolution Review (P1 and P2 tickets only)

1. Within 24 hours of closing a Critical or High priority ticket, complete a brief post-resolution review.
2. Document the following in the ticket:
   - Root cause of the issue
   - How it was resolved
   - Whether it could have been resolved faster
   - Any process or product improvements to flag

3. Share findings with the Team Lead during the next team standup or via the designated review channel.

---

## Escalation Path Summary

```
Agent
  ↓ (technical limitation)
SME
  ↓ (account/billing/relationship)
Customer Success Manager
  ↓ (product defect)
Team Lead → Bug Tracker
  ↓ (legal/compliance)
Team Lead (immediate notification, no independent response)
```

---

## Quality Standards

- Every ticket gets a personal response. No auto-close without agent review.
- Internal notes must be written clearly enough for any team member to pick up the ticket mid-process.
- Customer-facing language must be professional, warm, and jargon-free.
- SLA breaches must be flagged to the Team Lead immediately — do not wait until end of shift.

---

## Related Documents

- CS-002: Escalation Policy
- CS-003: Knowledge Base Maintenance
- CS-004: Customer Communication Style Guide
- Ticketing System User Guide (internal wiki)

---

*Owner: Customer Success Team Lead | Review cycle: Quarterly | Last reviewed: [Date]*