from playwright.sync_api import sync_playwright
import os

BASE_URL = 'https://3rdshift.ai'
EMAIL = 'test-roger@3rdshift.ai'
PASSWORD = '<SCREENSHOT_TEST_PASSWORD>'
OUT_DIR = '/Users/3rdshift/.openclaw/workspace/backup-pre-workspace-20260408/phase4-real'
os.makedirs(OUT_DIR, exist_ok=True)

results = []

def log(n, desc, passed, note=''):
    s = '✅ PASS' if passed else '❌ FAIL'
    results.append({'n': n, 'desc': desc, 'passed': passed, 'note': note})
    print(f'{s} — Test {n}: {desc}' + (f' | {note}' if note else ''))

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
    print('Logged in.')

    # Test 1: Login → default workspace loads → existing data visible
    try:
        page.screenshot(path=f'{OUT_DIR}/t01-dashboard.png')
        has_data = page.query_selector('text=Recent Tasks') or page.query_selector('text=Good morning') or page.query_selector('text=Good evening')
        log(1, 'Login → default workspace loads → existing data visible', bool(has_data))
    except Exception as e:
        log(1, 'Login → default workspace loads', False, str(e)[:80])

    # Test 2: Run a task → task created with workspace_id → appears in My Tasks
    try:
        page.goto(f'{BASE_URL}/dashboard/workers/content-writer', wait_until='networkidle')
        page.wait_for_timeout(2000)
        page.fill('textarea', 'Write one sentence about workspace collaboration.')
        page.click('button:has-text("Write Content")')
        page.wait_for_url('**/tasks/**', timeout=45000)
        page.wait_for_timeout(2000)
        page.screenshot(path=f'{OUT_DIR}/t02-task-result.png')
        task_url = page.url
        log(2, 'Run task → appears in tasks', 'tasks' in task_url, task_url[-60:])
    except Exception as e:
        log(2, 'Run task → appears in tasks', False, str(e)[:80])

    # Test 3: Settings → Brand Context + Integrations load
    try:
        page.goto(f'{BASE_URL}/dashboard/settings', wait_until='networkidle')
        page.wait_for_timeout(2000)
        page.screenshot(path=f'{OUT_DIR}/t03-settings.png')
        has_brand = page.query_selector('text=Brand Profile') or page.query_selector('text=Brand Context')
        has_integrations = page.query_selector('text=Integrations') or page.query_selector('text=Google')
        log(3, 'Settings → Brand Context + Integrations load', bool(has_brand and has_integrations))
    except Exception as e:
        log(3, 'Settings → Brand/Integrations', False, str(e)[:80])

    # Test 4: Settings → Team section visible
    try:
        has_team = page.query_selector('text=Team') or page.query_selector('text=Seat')
        page.screenshot(path=f'{OUT_DIR}/t04-settings-team.png')
        log(4, 'Settings → Team section visible', bool(has_team))
    except Exception as e:
        log(4, 'Settings → Team section', False, str(e)[:80])

    # Test 5: Workspace switcher in sidebar + "Create New Workspace" option
    try:
        page.goto(f'{BASE_URL}/dashboard', wait_until='networkidle')
        page.wait_for_timeout(1500)
        # Click workspace switcher
        ws_btn = page.query_selector('text=My Workspace') or page.query_selector('text=Workspace')
        if ws_btn:
            ws_btn.click()
            page.wait_for_timeout(500)
            page.screenshot(path=f'{OUT_DIR}/t05-ws-switcher.png')
            has_create = page.query_selector('text=Create New Workspace')
            log(5, 'Workspace switcher → "Create New Workspace" option visible', bool(has_create))
            # Close dropdown
            page.keyboard.press('Escape')
        else:
            log(5, 'Workspace switcher visible', False, 'Switcher not found')
    except Exception as e:
        log(5, 'Workspace switcher', False, str(e)[:80])

    # Test 6: Create New Workspace → modal opens → shows plan selector
    try:
        ws_btn = page.query_selector('text=My Workspace') or page.query_selector('text=Workspace')
        if ws_btn:
            ws_btn.click()
            page.wait_for_timeout(500)
            create_btn = page.query_selector('text=Create New Workspace')
            if create_btn:
                create_btn.click()
                page.wait_for_timeout(1000)
                page.screenshot(path=f'{OUT_DIR}/t06-create-ws-modal.png')
                has_modal = page.query_selector('text=Create New Workspace') and page.query_selector('input[type="text"]')
                has_plans = page.query_selector('text=Starter') and page.query_selector('text=Operator')
                log(6, 'Create Workspace modal → opens with plan selector', bool(has_modal and has_plans))
                # Close modal
                esc = page.query_selector('button:has-text("Cancel")') or page.query_selector('button:has-text("×")')
                if esc: esc.click()
            else:
                log(6, 'Create Workspace modal', False, 'Create button not found in dropdown')
        else:
            log(6, 'Create Workspace modal', False, 'Workspace switcher not found')
    except Exception as e:
        log(6, 'Create Workspace modal', False, str(e)[:80])

    # Test 7: Activity Dashboard page loads (Operator)
    try:
        page.goto(f'{BASE_URL}/dashboard/activity', wait_until='networkidle')
        page.wait_for_timeout(1500)
        page.screenshot(path=f'{OUT_DIR}/t07-activity.png')
        has_activity = page.query_selector('text=Activity Dashboard') or page.query_selector('text=Activity')
        log(7, 'Activity Dashboard page loads', bool(has_activity))
    except Exception as e:
        log(7, 'Activity Dashboard', False, str(e)[:80])

    # Test 8: Activity Dashboard → shows credits bars
    try:
        has_credits = page.query_selector('text=Credits') or page.query_selector('text=Heavy Credits')
        log(8, 'Activity Dashboard → credits bars visible', bool(has_credits))
    except Exception as e:
        log(8, 'Activity → credits', False, str(e)[:80])

    # Test 9: Activity Dashboard → shows members section
    try:
        has_members = page.query_selector('text=Members')
        log(9, 'Activity Dashboard → members section visible', bool(has_members))
    except Exception as e:
        log(9, 'Activity → members', False, str(e)[:80])

    # Test 10: Activity Dashboard → shows recent tasks feed
    try:
        has_feed = page.query_selector('text=Recent Activity') or page.query_selector('text=Activity')
        page.screenshot(path=f'{OUT_DIR}/t10-activity-feed.png')
        log(10, 'Activity Dashboard → recent activity feed visible', bool(has_feed))
    except Exception as e:
        log(10, 'Activity → feed', False, str(e)[:80])

    # Test 11: Activity sidebar link visible for Operator
    try:
        page.goto(f'{BASE_URL}/dashboard', wait_until='networkidle')
        page.wait_for_timeout(1500)
        activity_link = page.query_selector('a[href="/dashboard/activity"]') or page.query_selector('text=Activity')
        page.screenshot(path=f'{OUT_DIR}/t11-sidebar-activity.png')
        log(11, 'Activity link visible in sidebar', bool(activity_link))
    except Exception as e:
        log(11, 'Sidebar activity link', False, str(e)[:80])

    browser.close()

print('\n--- RESULTS ---')
passed = sum(1 for r in results if r['passed'])
print(f'{passed}/{len(results)} tests passed\n')
for r in results:
    s = '✅' if r['passed'] else '❌'
    print(f"  {s} Test {r['n']}: {r['desc']}" + (f' ({r["note"]})' if r['note'] else ''))
