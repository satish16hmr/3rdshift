from playwright.sync_api import sync_playwright
import os

BASE_URL = 'https://3rdshift.ai'
EMAIL = 'test-roger@3rdshift.ai'
PASSWORD = '<SCREENSHOT_TEST_PASSWORD>'
OUT_DIR = '/Users/3rdshift/.openclaw/workspace/backup-pre-workspace-20260408'

os.makedirs(OUT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    page = context.new_page()

    # Login
    print('Logging in...')
    page.goto(f'{BASE_URL}/login', wait_until='networkidle', timeout=30000)
    page.fill('input[type="email"]', EMAIL)
    page.fill('input[type="password"]', PASSWORD)
    page.click('button:has-text("Log in")')
    page.wait_for_url('**/dashboard**', timeout=20000)
    page.wait_for_timeout(2000)
    print(f'Logged in. URL: {page.url}')

    # 1. Dashboard home
    page.screenshot(path=f'{OUT_DIR}/01-dashboard-home.png', full_page=False)
    print('1. Dashboard home captured')

    # 2. Settings
    page.goto(f'{BASE_URL}/dashboard/settings', wait_until='networkidle')
    page.wait_for_timeout(1500)
    page.screenshot(path=f'{OUT_DIR}/02-settings.png', full_page=True)
    print('2. Settings captured')

    # 3. My Tasks
    page.goto(f'{BASE_URL}/dashboard/tasks', wait_until='networkidle')
    page.wait_for_timeout(1500)
    page.screenshot(path=f'{OUT_DIR}/03-my-tasks.png', full_page=False)
    print('3. My Tasks captured')

    # 4. Team/Workers grid
    page.goto(f'{BASE_URL}/dashboard/team', wait_until='networkidle')
    page.wait_for_timeout(1500)
    page.screenshot(path=f'{OUT_DIR}/04-team-workers.png', full_page=False)
    print('4. Team/Workers captured')

    # 5. Workflows
    page.goto(f'{BASE_URL}/dashboard/workflows', wait_until='networkidle')
    page.wait_for_timeout(1500)
    page.screenshot(path=f'{OUT_DIR}/05-workflows.png', full_page=False)
    print('5. Workflows captured')

    # 6. Task result page (click first task if exists)
    page.goto(f'{BASE_URL}/dashboard/tasks', wait_until='networkidle')
    page.wait_for_timeout(1500)
    first_task = page.query_selector('a[href*="/dashboard/tasks/"]')
    if first_task:
        first_task.click()
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(1500)
        page.screenshot(path=f'{OUT_DIR}/06-task-result.png', full_page=False)
        print('6. Task result captured')
    else:
        page.goto(f'{BASE_URL}/dashboard/team/content-writer', wait_until='networkidle')
        page.wait_for_timeout(1500)
        page.screenshot(path=f'{OUT_DIR}/06-worker-form-fallback.png', full_page=False)
        print('6. Worker form fallback captured')

    browser.close()
    print(f'\nDone. All screenshots in: {OUT_DIR}')
    files = os.listdir(OUT_DIR)
    print(f'Files: {sorted(files)}')
