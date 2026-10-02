from playwright.sync_api import sync_playwright
import os, json

BASE_URL = 'https://3rdshift.ai'
EMAIL = 'test-roger@3rdshift.ai'
PASSWORD = '<SCREENSHOT_TEST_PASSWORD>'
OUT_DIR = '/Users/3rdshift/.openclaw/workspace/backup-pre-workspace-20260408/phase4-tests'
os.makedirs(OUT_DIR, exist_ok=True)

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

    # Test 2: Run a task — find the actual submit button
    page.goto(f'{BASE_URL}/dashboard/workers/content-writer', wait_until='networkidle')
    page.wait_for_timeout(2000)
    page.screenshot(path=f'{OUT_DIR}/t02-form.png')
    buttons = page.query_selector_all('button')
    print('Buttons on worker form:')
    for b in buttons:
        print(f'  type={b.get_attribute("type")} text="{b.inner_text()[:40]}"')

    # Test 6: /api/workspace — get token from cookie
    cookies = context.cookies()
    print('\nCookies:')
    for c in cookies:
        if 'access' in c['name'].lower() or 'token' in c['name'].lower() or 'supabase' in c['name'].lower():
            print(f'  {c["name"]}: {c["value"][:40]}...')

    # Try supabase session via JS evaluation
    session = page.evaluate('''() => {
        const keys = Object.keys(localStorage);
        for (const k of keys) {
            if (k.includes("auth-token") || k.includes("supabase")) {
                try {
                    const v = JSON.parse(localStorage.getItem(k));
                    return v?.access_token || v?.currentSession?.access_token || null;
                } catch {}
            }
        }
        return null;
    }''')
    print(f'\nSession token (first 40): {str(session)[:40] if session else "None"}')

    # Test 11: Chat — find actual input selector
    page.goto(f'{BASE_URL}/dashboard/workers/content-writer?tab=chat', wait_until='networkidle')
    page.wait_for_timeout(3000)
    page.screenshot(path=f'{OUT_DIR}/t11-chat-debug.png')
    inputs = page.query_selector_all('input, textarea')
    print('\nInputs on chat page:')
    for i in inputs:
        print(f'  tag={i.evaluate("el => el.tagName")} placeholder="{i.get_attribute("placeholder")}"')

    browser.close()
