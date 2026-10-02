from playwright.sync_api import sync_playwright
import os

BASE_URL = 'https://3rdshift.ai'
EMAIL = 'test-roger@3rdshift.ai'
PASSWORD = '<SCREENSHOT_TEST_PASSWORD>'
OUT_DIR = '/Users/3rdshift/.openclaw/workspace/backup-pre-workspace-20260408/phase4-real'

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

    page.goto(f'{BASE_URL}/dashboard/settings', wait_until='networkidle')
    page.wait_for_timeout(2000)

    # Scroll to bottom
    page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
    page.wait_for_timeout(1000)
    page.screenshot(path=f'{OUT_DIR}/settings-bottom.png', full_page=False)
    print('Settings bottom screenshot taken')

    # Also try scrolling to team section
    page.evaluate('''() => {
        const el = Array.from(document.querySelectorAll("*")).find(e => e.textContent.trim() === "Team");
        if (el) el.scrollIntoView({ behavior: "instant", block: "center" });
    }''')
    page.wait_for_timeout(500)
    page.screenshot(path=f'{OUT_DIR}/settings-team-section.png', full_page=False)
    print('Team section screenshot taken')

    browser.close()
