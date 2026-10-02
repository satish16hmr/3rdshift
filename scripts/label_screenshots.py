from playwright.sync_api import sync_playwright
import os

BASE_URL = 'https://3rdshift.ai'
EMAIL = 'test-roger@3rdshift.ai'
PASSWORD = '<SCREENSHOT_TEST_PASSWORD>'
OUT = '/Users/3rdshift/.openclaw/workspace/backup-pre-workspace-20260408/label-cleanup'
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    page = context.new_page()

    page.goto(f'{BASE_URL}/login', wait_until='networkidle', timeout=30000)
    page.fill('input[type="email"]', EMAIL)
    page.fill('input[type="password"]', PASSWORD)
    page.click('button:has-text("Log in")')
    page.wait_for_url('**/dashboard**', timeout=20000)
    page.wait_for_timeout(2000)

    # 1. Sidebar — Team Members + Usage
    page.screenshot(path=f'{OUT}/01-sidebar.png', full_page=False)
    print('1. Sidebar captured')

    # 2. Settings — Seats section
    page.goto(f'{BASE_URL}/dashboard/settings', wait_until='domcontentloaded', timeout=30000)
    page.wait_for_timeout(3000)
    page.evaluate('''() => {
        const els = Array.from(document.querySelectorAll('*'));
        const el = els.find(e => e.textContent.trim() === 'Seats' && e.tagName.match(/H[1-6]|STRONG/i));
        if (el) el.scrollIntoView({ behavior: "instant", block: "center" });
    }''')
    page.wait_for_timeout(500)
    page.screenshot(path=f'{OUT}/02-settings-seats.png', full_page=False)
    print('2. Settings Seats captured')

    # 3. Usage page
    page.goto(f'{BASE_URL}/dashboard/activity', wait_until='domcontentloaded', timeout=30000)
    page.wait_for_timeout(5000)
    page.screenshot(path=f'{OUT}/03-usage-page.png', full_page=False)
    print('3. Usage page captured')

    browser.close()
    print('Done.')
