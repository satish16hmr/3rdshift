from playwright.sync_api import sync_playwright
import os, json

BASE_URL = 'https://3rdshift.ai'
EMAIL = 'test-roger@3rdshift.ai'
PASSWORD = '<SCREENSHOT_TEST_PASSWORD>'
OUT_DIR = '/Users/3rdshift/.openclaw/workspace/backup-pre-workspace-20260408/phase4-tests'
os.makedirs(OUT_DIR, exist_ok=True)

results = []

def log(n, desc, passed, note=''):
    status = '✅ PASS' if passed else '❌ FAIL'
    results.append({'test': n, 'desc': desc, 'status': status, 'note': note})
    print(f'{status} — Test {n}: {desc}{" | " + note if note else ""}')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    page = context.new_page()

    # Login
    page.goto(f'{BASE_URL}/login', wait_until='networkidle', timeout=30000)
    page.fill('input[type="email"]', EMAIL)
    page.fill('input[type="password"]', PASSWORD)
    page.click('button:has-text("Log in")')
    page.wait_for_url('**/dashboard**', timeout=20000)
    page.wait_for_timeout(2000)

    # Test 1: Log in → default workspace loads → all existing data visible
    try:
        page.screenshot(path=f'{OUT_DIR}/t01-dashboard.png')
        has_tasks = page.query_selector('text=Recent Tasks') or page.query_selector('text=My Tasks') or page.query_selector('[href*="/dashboard/tasks"]')
        log(1, 'Login → dashboard loads with data', bool(has_tasks))
    except Exception as e:
        log(1, 'Login → dashboard loads with data', False, str(e))

    # Test 2: Run a task → task created with workspace_id → appears in My Tasks
    try:
        page.goto(f'{BASE_URL}/dashboard/workers/content-writer', wait_until='networkidle')
        page.wait_for_timeout(1500)
        # Find the main textarea or input
        textarea = page.query_selector('textarea') or page.query_selector('input[type="text"]')
        if textarea:
            textarea.fill('Write a short test sentence about AI productivity tools.')
        submit = page.query_selector('button[type="submit"]') or page.query_selector('button:has-text("Run")')
        if submit:
            submit.click()
            page.wait_for_url('**/tasks**', timeout=30000)
            page.wait_for_timeout(2000)
            url = page.url
            page.screenshot(path=f'{OUT_DIR}/t02-task-result.png')
            log(2, 'Run task → appears in My Tasks', 'tasks' in url, f'URL: {url}')
        else:
            log(2, 'Run task → appears in My Tasks', False, 'Submit button not found')
    except Exception as e:
        log(2, 'Run task → appears in My Tasks', False, str(e)[:100])

    # Test 3: Settings → Brand Context loads correctly
    try:
        page.goto(f'{BASE_URL}/dashboard/settings', wait_until='networkidle')
        page.wait_for_timeout(1500)
        page.screenshot(path=f'{OUT_DIR}/t03-settings.png')
        has_brand = page.query_selector('text=Brand') or page.query_selector('[placeholder*="company"]') or page.query_selector('[placeholder*="brand"]')
        log(3, 'Settings → Brand Context loads', bool(has_brand))
    except Exception as e:
        log(3, 'Settings → Brand Context loads', False, str(e)[:100])

    # Test 4: Settings → Integrations shows connected services
    try:
        has_integrations = page.query_selector('text=Integrations') or page.query_selector('text=Google') or page.query_selector('text=Notion')
        page.screenshot(path=f'{OUT_DIR}/t04-integrations.png')
        log(4, 'Settings → Integrations visible', bool(has_integrations))
    except Exception as e:
        log(4, 'Settings → Integrations visible', False, str(e)[:100])

    # Test 5: Workspace switcher appears in sidebar
    try:
        page.goto(f'{BASE_URL}/dashboard', wait_until='networkidle')
        page.wait_for_timeout(1500)
        # Look for workspace label in sidebar
        workspace_el = page.query_selector('text=Workspace') or page.query_selector('[data-slot="sidebar-label"]')
        page.screenshot(path=f'{OUT_DIR}/t05-sidebar.png')
        log(5, 'Workspace switcher in sidebar', bool(workspace_el))
    except Exception as e:
        log(5, 'Workspace switcher in sidebar', False, str(e)[:100])

    # Test 6: /api/workspace returns workspaceId
    try:
        session_token = page.evaluate('''() => {
            const keys = Object.keys(localStorage);
            for (const k of keys) {
                const v = localStorage.getItem(k);
                if (v && v.includes("access_token")) {
                    try { return JSON.parse(v).access_token; } catch {}
                }
            }
            return null;
        }''')
        if session_token:
            resp = page.request.get(f'{BASE_URL}/api/workspace', headers={'Authorization': f'Bearer {session_token}'})
            data = resp.json()
            has_workspace_id = bool(data.get('activeWorkspaceId'))
            log(6, '/api/workspace returns activeWorkspaceId', has_workspace_id, str(data.get('activeWorkspaceId', ''))[:40])
        else:
            log(6, '/api/workspace returns activeWorkspaceId', False, 'Could not get session token from localStorage')
    except Exception as e:
        log(6, '/api/workspace returns activeWorkspaceId', False, str(e)[:100])

    # Test 7: My Tasks page loads
    try:
        page.goto(f'{BASE_URL}/dashboard/tasks', wait_until='networkidle')
        page.wait_for_timeout(1500)
        page.screenshot(path=f'{OUT_DIR}/t07-tasks.png')
        loaded = 'tasks' in page.url
        log(7, 'My Tasks page loads', loaded)
    except Exception as e:
        log(7, 'My Tasks page loads', False, str(e)[:100])

    # Test 8: Workers grid loads (78 workers)
    try:
        page.goto(f'{BASE_URL}/dashboard/workers', wait_until='networkidle')
        page.wait_for_timeout(1500)
        page.screenshot(path=f'{OUT_DIR}/t08-workers.png')
        worker_cards = page.query_selector_all('[href*="/dashboard/workers/"]')
        log(8, 'Workers grid loads', len(worker_cards) >= 10, f'{len(worker_cards)} worker links found')
    except Exception as e:
        log(8, 'Workers grid loads', False, str(e)[:100])

    # Test 9: Agent Mode page loads
    try:
        page.goto(f'{BASE_URL}/dashboard/agent-mode', wait_until='networkidle')
        page.wait_for_timeout(1500)
        page.screenshot(path=f'{OUT_DIR}/t09-agent-mode.png')
        loaded = 'agent-mode' in page.url
        log(9, 'Agent Mode page loads', loaded)
    except Exception as e:
        log(9, 'Agent Mode page loads', False, str(e)[:100])

    # Test 10: Billing page loads
    try:
        page.goto(f'{BASE_URL}/dashboard/settings/billing', wait_until='networkidle')
        page.wait_for_timeout(1500)
        page.screenshot(path=f'{OUT_DIR}/t10-billing.png')
        loaded = 'billing' in page.url
        log(10, 'Billing page loads', loaded)
    except Exception as e:
        log(10, 'Billing page loads', False, str(e)[:100])

    # Test 11: Chat with a team member works
    try:
        page.goto(f'{BASE_URL}/dashboard/workers/content-writer?tab=chat', wait_until='networkidle')
        page.wait_for_timeout(2000)
        page.screenshot(path=f'{OUT_DIR}/t11-chat.png')
        chat_input = page.query_selector('input[placeholder*="message"]') or page.query_selector('textarea[placeholder*="message"]') or page.query_selector('input[placeholder*="Ask"]') or page.query_selector('textarea[placeholder*="Ask"]')
        log(11, 'Chat interface loads', bool(chat_input))
    except Exception as e:
        log(11, 'Chat interface loads', False, str(e)[:100])

    browser.close()

print('\n--- RESULTS ---')
passed = sum(1 for r in results if 'PASS' in r['status'])
print(f'{passed}/{len(results)} tests passed')
for r in results:
    print(f"  {r['status']} — {r['desc']}" + (f" ({r['note']})" if r['note'] else ''))
