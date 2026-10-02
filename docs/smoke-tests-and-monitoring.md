# Smoke Tests & Monitoring

**Shipped:** April 28, 2026 | commit `5af4161`

## What's live

| Layer | What | Status |
|---|---|---|
| Health endpoint | `/api/health` — DB + env check, 200/503 | ✅ Live |
| Smoke tests | 18 Playwright tests — UI paths + API gates | ✅ 18/18 passing |
| GitHub Actions | `smoke-test.yml` — runs on deploy + manual trigger | ✅ Running |
| Telegram alerts | Pass/fail notification after each run | ⚠️ Needs secrets |
| Vercel deploy trigger | Auto-run after every prod deploy | ⚠️ Needs webhook |
| UptimeRobot | 5-min continuous uptime monitoring | ⏳ Not yet |

---

## Setup steps remaining

### 1. Telegram alert bot (GitHub → you)

Need a Telegram bot token and your personal chat ID so GitHub Actions can ping you.

**Create the bot:**
1. Message `@BotFather` on Telegram
2. `/newbot` → name it "3rdShift Deploys" or similar
3. Copy the bot token (format: `1234567890:ABCdef...`)
4. Start a chat with your new bot (send it any message)
5. Get your chat ID: `https://api.telegram.org/bot<TOKEN>/getUpdates` — look for `chat.id`

**Add to GitHub Secrets:**
```
gh secret set SMOKE_TELEGRAM_BOT_TOKEN --body "<token>" --repo rogertask/3rdshift-frontend
gh secret set SMOKE_TELEGRAM_CHAT_ID --body "<chat_id>" --repo rogertask/3rdshift-frontend
```

Or via GitHub UI: Settings → Secrets and variables → Actions → New repository secret.

**Test it:**
```bash
# Manually trigger the workflow
gh workflow run smoke-test.yml --repo rogertask/3rdshift-frontend --field base_url=https://3rdshift.ai
```

---

### 2. Vercel deploy webhook → GitHub Actions trigger

The `smoke-test.yml` workflow listens for `repository_dispatch` with type `vercel-deploy-success`.
Vercel needs to POST to the GitHub API after each production deploy.

**Option A — Vercel Deploy Hook + GitHub relay (recommended)**

1. **Create GitHub personal access token:**
   - github.com → Settings → Developer settings → Personal access tokens → Fine-grained
   - Repository: `rogertask/3rdshift-frontend`
   - Permissions: `Actions: Write` (to trigger `repository_dispatch`)
   - Copy the token

2. **Add GitHub token to Vercel:**
   - Vercel dashboard → Project `3rdshift-frontend` → Settings → Environment Variables
   - Add: `GITHUB_DISPATCH_TOKEN` = your PAT

3. **Create a Vercel serverless function as relay** (or use a GitHub Action deploy event):

Actually the cleanest approach for Next.js:

**Option B — Use `vercel.json` deploy hook callback**

In `vercel.json` (or Vercel project settings):
- Project → Settings → Git → Deploy Hooks
- Create hook named "Smoke Tests Trigger"
- This gives a URL — BUT Vercel deploy hooks are one-way (you POST to them to trigger a deploy, not the other way)

**Option C — GitHub Actions `deployment_status` event (simplest)**

Vercel already creates GitHub deployment events. Change `smoke-test.yml` trigger:

```yaml
on:
  deployment_status:
  workflow_dispatch:
    inputs:
      base_url:
        description: 'Target URL'
        required: false
        default: 'https://3rdshift.ai'
```

And in the job:
```yaml
    if: github.event.deployment_status.state == 'success' && github.event.deployment_status.environment == 'Production'
```

This is the right approach — Vercel already creates `deployment_status` events on your repo automatically. **Roger: update `smoke-test.yml` to use this trigger.**

---

### 3. UptimeRobot setup

**Go to:** https://uptimerobot.com → Create free account

**Create 4 monitors:**

| Monitor | URL | Type | Interval | Alert on |
|---|---|---|---|---|
| 3rdShift Homepage | `https://3rdshift.ai/` | HTTP | 5 min | 200 |
| 3rdShift Login | `https://3rdshift.ai/login` | HTTP | 5 min | 200 |
| 3rdShift Health | `https://3rdshift.ai/api/health` | HTTP + keyword | 5 min | 200 + `"db":"ok"` |
| 3rdShift Dashboard | `https://3rdshift.ai/dashboard` | HTTP | 5 min | 200 or 302 |

**Alert channels:**
- Email: your personal email
- Telegram: UptimeRobot has a built-in Telegram integration
  - UptimeRobot → My Settings → Alert Contacts → Add Alert Contact → Telegram
  - Create another bot via BotFather (or reuse smoke alert bot)

**Keyword monitor for `/api/health`:**
- Monitor type: "HTTP(s) - Keyword"
- Keyword: `"db":"ok"`
- Alert if keyword NOT present (catches DB down even when HTTP returns 200)

---

## Test accounts (for smoke tests)

| Account | Role | Password |
|---|---|---|
| test-roger@3rdshift.ai | Pro owner (WA) | `<SCREENSHOT_TEST_PASSWORD>` |

Stored in GitHub Secrets: `SMOKE_USER_EMAIL`, `SMOKE_USER_PASSWORD`

---

## File locations

| File | Purpose |
|---|---|
| `app/api/health/route.ts` | Health endpoint |
| `tests/smoke/critical-paths.spec.ts` | UI path smoke tests |
| `tests/smoke/api-routes.spec.ts` | API gate smoke tests |
| `playwright.config.ts` | Playwright configuration |
| `.github/workflows/smoke-test.yml` | CI workflow |

---

## Adding new smoke tests

Every new feature should add at least one test for the happy path.

```typescript
// In tests/smoke/critical-paths.spec.ts (for UI paths)
test('new feature page loads', async ({ page }) => {
  const res = await sharedPage.goto('/dashboard/new-feature');
  expect(res?.status()).toBe(200);
});

// In tests/smoke/api-routes.spec.ts (for new API routes)
{ method: 'POST', path: '/api/new-route' }, // add to protectedRoutes array
```

Run locally:
```bash
BASE_URL=https://3rdshift.ai SMOKE_USER_EMAIL=test-roger@3rdshift.ai SMOKE_USER_PASSWORD=<SCREENSHOT_TEST_PASSWORD> npx playwright test --config playwright.config.ts
```
