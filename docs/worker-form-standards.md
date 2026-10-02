# Worker Form Standards

Canonical reference for all worker form UI. Apply consistently on every new or retrofitted worker.

---

## Footer Text

Set via `footerText` in `WorkerFormConfig` (in `lib/workers/configs.ts` or per-worker prompt file).

| Worker type | Format |
|---|---|
| Heavy (credit-based) | `[N] credit(s) · Downloads as [FORMATS]` |
| Light (included) | `Included on all plans · Downloads as [FORMATS]` |

**Rules:**
- Never show remaining credit count in footer — that lives in topnav only.
- Use middle dot `·` (not dash or pipe) as separator.
- List formats in order: primary first. Example: `PDF + DOCX`, `PPTX + PDF`, `XLSX + PDF`.

---

## Submit Button Verbs

Set via `submitLabel` in `WorkerFormConfig`.

- **Format:** Action verb + deliverable noun + ` →` arrow. Never "Submit Task".
- **Examples:**

| Worker | Label |
|---|---|
| Ava (Content Writer) | Write Article → |
| Ash (Social Media Creator) | Create Posts → |
| Alice (Funnel Strategist) | Build Funnel → |
| Blair (Pitch Deck Writer) | Write Pitch Deck → |
| Bree (Creative Brief Writer) | Write Brief → |
| Brody (KPI Dashboard Writer) | Build KPI Framework → |
| Cade (Data Cleaner) | Clean Data → |
| Beck (Resume Writer) | Build Resume → |

---

## Placeholders

- Format: `e.g. [concrete example]`
- The **label** carries the question. The **placeholder** carries the example.
- Do NOT use question-prompt placeholders like "What painful problem does your company solve?" — move that to the label or add a `hint`.

---

## More Options (Collapsible Section)

- 3+ optional fields → collapse behind a "More options" expandable section.
- Required fields and primary-intent fields stay visible above the fold.
- Use `collapsed: true` on the section in `FormSection`.
- Label: `'More options'` (default) or a more specific label like `'Special handling'`.

---

## Templates (Pro+ Only)

Rendered by `<WorkerTemplateCards>` component, above the form card.

- **Only** add templates to workers with genuine archetype variations (e.g., Alice, Blair, Bree).
- Do NOT add to every worker.
- Registry: set `hasTemplates: true` and `templates: WorkerTemplate[]` on the `WorkerConfig`.
- Starter: sees locked cards (opacity 0.6, lock icon, upgrade modal on click).
- Pro / Operator: click pre-fills form fields and smooth-scrolls to form.
- Template card: title (13px, weight 500) + 1-line description (12px, secondary color).

---

## Dropdown vs Free Text

Use a `select` field when there are 4–8 known archetypes. Add `'Other (specify)'` as last option if users legitimately need free text. Reveal a follow-up text field when "Other" is selected (use `project_type_other` or `tone_other` pattern — render it always, user can ignore).

Current examples:
- Bree — Project Type: dropdown with 6 types + Other
- Bree — Tone and Style: dropdown with 6 tones + Other
- Bella — Business Type: dropdown with 8 types

---

## File Conventions

| Purpose | Location |
|---|---|
| Form config (inline) | `lib/workers/configs.ts` |
| Form config (complex worker) | `lib/workers/[slug]/prompt.ts` |
| Custom form component | `components/workers/[Name]Form.jsx` |
| Template data | `lib/workers/registry.ts` → `templates[]` on `WorkerConfig` |
| Template UI | `components/workers/WorkerTemplateCards.jsx` |

---

## 11. Per-template System Context (systemContextAddition)

For workers with templates (Alice, Blair, Bree), each template can include a `systemContextAddition` string.

**How it works:**
1. When user clicks a template card, `template.id` is stored as `selectedTemplateId` in form state
2. On submit, `_selected_template_id` is included in `task.input`
3. `execute-task` route reads it, looks up the template in registry, appends `systemContextAddition` to base system prompt as `\n\n### Template context:\n[text]`
4. Worker gets specialist context without user seeing it

**Rules:**
- Context is additive only — never overrides base system prompt rules
- Most-recently clicked template wins (switching templates clears old selection)
- If user never clicks a template: no context added, base prompt used
- Works even if user modifies form fields after clicking template

**Interface:**
```typescript
interface WorkerTemplate {
  id: string
  title: string
  description: string
  prefill: Record<string, any>
  systemContextAddition?: string  // Injected at server, invisible to user
}
```

## 12. Showwhen Conditional Fields

Fields that depend on another field's value use `showWhen`:
```typescript
{ showWhen: { field: 'project_type', value: 'Other (specify)' } }
```
- The `value` must match the exact option text (not a substring)
- Value is cleared when field is hidden (on parent field change)
- Handled in renderField + select onChange in page.jsx
