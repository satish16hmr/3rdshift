from playwright.sync_api import sync_playwright
import os

BASE_URL = 'https://3rdshift.ai'
EMAIL = 'test-roger@3rdshift.ai'
PASSWORD = '<SCREENSHOT_TEST_PASSWORD>'
OUT_DIR = '/Users/3rdshift/.openclaw/workspace/backup-pre-workspace-20260408'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    page = context.new_page()

    print('Logging in...')
    page.goto(f'{BASE_URL}/login', wait_until='networkidle', timeout=30000)
    page.fill('input[type="email"]', EMAIL)
    page.fill('input[type="password"]', PASSWORD)
    page.click('button:has-text("Log in")')
    page.wait_for_url('**/dashboard**', timeout=20000)
    page.wait_for_timeout(2000)
    print(f'Logged in. URL: {page.url}')

    page.screenshot(path=f'{OUT_DIR}/smoke-01-dashboard.png')
    print('Dashboard loaded')

    page.goto(f'{BASE_URL}/dashboard/workers', wait_until='networkidle')
    page.wait_for_timeout(1500)
    page.screenshot(path=f'{OUT_DIR}/smoke-02-workers.png')
    print('Workers page loaded')

    page.goto(f'{BASE_URL}/dashboard/tasks', wait_until='networkidle')
    page.wait_for_timeout(1500)
    page.screenshot(path=f'{OUT_DIR}/smoke-03-tasks.png')
    print('Tasks page loaded')

    page.goto(f'{BASE_URL}/dashboard/settings', wait_until='networkidle')
    page.wait_for_timeout(1500)
    page.screenshot(path=f'{OUT_DIR}/smoke-04-settings.png')
    print('Settings page loaded')

    browser.close()
    print('Smoke test complete.')
