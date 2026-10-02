# CI Runbook — How to Investigate a Failing CI Check

## Overview

3rdShift runs two CI jobs on every PR and push to `main`:

| Job | What it checks | Blocks merge? |
|-----|---------------|---------------|
| `typecheck` | `tsc --noEmit` — TypeScript type errors | ✅ Yes |
| `lint` | ESLint on `app/`, `lib/`, `components/` — errors only | ✅ Yes |

CI runs on GitHub Actions (free tier — ~2K min/month, well under limit).

---

## How to See CI Status

1. Go to the PR or commit on GitHub
2. Look for the ✅/❌ status checks at the bottom of the PR
3. Click "Details" on a failing check to open the GitHub Actions run log

Or: `https://github.com/rogertask/3rdshift-frontend/actions`

---

## Investigating a TypeScript Failure (`typecheck` job)

### Step 1 — Read the error

In the Actions log, scroll to the `npx tsc --noEmit` step. The error format is:

```
app/path/to/file.ts(line,col): error TS2345: [message]
```

### Step 2 — Reproduce locally

```bash
cd /Users/3rdshift/.openclaw/workspace/3rdshift-frontend
npx tsc --noEmit
```

This shows all errors. Fix them until output is clean (no output = passing).

### Step 3 — Common TS error patterns

| Error | Cause | Fix |
|-------|-------|-----|
| `TS2304: Cannot find name 'X'` | Missing import or typo | Add import or fix name |
| `TS2307: Cannot find module 'X'` | Missing package or wrong path | `npm install X` or fix path |
| `TS2345: Argument of type X is not assignable` | Type mismatch | Fix types or add cast |
| `TS2339: Property X does not exist` | Wrong property name or type | Check the interface/type |
| `TS18046: X is of type unknown` | Need to narrow the type | Add type guard or cast |

### Step 4 — If you can't fix immediately

Add a `// @ts-expect-error` comment above the line with a note explaining why. This is better than `@ts-ignore` (TypeScript will warn if the error disappears).

---

## Investigating an ESLint Failure (`lint` job)

### Step 1 — Read the error

```
app/path/to/file.tsx
  42:5  error  [rule-name]  description
```

Only **errors** (not warnings) block the merge.

### Step 2 — Reproduce locally

```bash
cd /Users/3rdshift/.openclaw/workspace/3rdshift-frontend
npx eslint app/ lib/ components/ --ext .ts,.tsx,.js,.jsx
```

### Step 3 — Common ESLint errors that block

| Rule | Meaning | Fix |
|------|---------|-----|
| `no-unused-vars` | Variable declared but never used | Remove or use it |
| `no-undef` | Variable used before declaration | Add import or fix name |
| `react-hooks/exhaustive-deps` | Missing useEffect dependency | Add dep or use `// eslint-disable-next-line` with justification |
| `@next/next/no-img-element` | Using `<img>` instead of Next Image | Use `<Image>` from `next/image` |

### Step 4 — Disabling a rule for one line

```ts
// eslint-disable-next-line rule-name -- reason why this is intentional
someCode();
```

---

## Branch Protection Status

⚠️ **Branch protection is not enabled** — requires GitHub Pro or a public repo (private free plan limitation).

Until then: CI runs on every push to main and every PR. **Do not merge PRs with red CI checks.** This is enforced by convention, not enforcement.

To enable in future: upgrade to GitHub Pro ($4/mo) or contact Josh to decide if repo should be public after launch.

---

## What NOT to Do

- **Don't skip CI** by adding `--no-verify` to git commits — that bypasses the pre-push hook but CI still runs on GitHub
- **Don't add `@ts-ignore`** — use `@ts-expect-error` instead (it fails if the error disappears)
- **Don't disable entire rule files** — disable line-by-line with a comment explaining why
- **Don't merge a PR with failing CI** — branch protection is enabled on `main`

---

## Emergency: CI Broken on Main

If a commit to main broke CI (shouldn't happen with branch protection, but could happen via direct push):

1. **Don't panic** — Vercel deploys continue (they're independent of CI)
2. Fix the error in a new branch, open a PR, merge
3. Or: revert the breaking commit via `git revert <SHA>` and push

---

## Viewing Historical Runs

All CI run history: `https://github.com/rogertask/3rdshift-frontend/actions`

Filter by workflow: click "CI" in the left sidebar.
