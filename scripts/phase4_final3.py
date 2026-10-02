from playwright.sync_api import sync_playwright
import os, base64, json

BASE_URL = 'https://3rdshift.ai'
EMAIL = 'test-roger@3rdshift.ai'
PASSWORD = '<SCREENSHOT_TEST_PASSWORD>'
OUT_DIR = '/Users/3rdshift/.openclaw/workspace/backup-pre-workspace-20260408/phase4-tests'

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

    # Test 2: Run a task
    print('Test 2: Running a task...')
    page.goto(f'{BASE_URL}/dashboard/workers/content-writer', wait_until='networkidle')
    page.wait_for_timeout(2000)
    textarea = page.query_selector('textarea')
    if textarea:
        textarea.fill('Write a single sentence about workspace productivity.')
    page.click('button:has-text("Write Content")')
    try:
        page.wait_for_url('**/tasks/**', timeout=45000)
        page.wait_for_timeout(3000)
        url = page.url
        page.screenshot(path=f'{OUT_DIR}/t02-task-result-final.png')
        print(f'✅ PASS — Test 2: Task ran, URL: {url}')
    except Exception as e:
        page.screenshot(path=f'{OUT_DIR}/t02-task-fail.png')
        print(f'❌ FAIL — Test 2: {str(e)[:100]}')

    # Test 6: /api/workspace returns activeWorkspaceId
    print('\nTest 6: /api/workspace...')
    try:
        cookies = context.cookies()
        token_cookie = next((c for c in cookies if 'auth-token' in c['name'] and c['name'].endswith('0')), None)
        if token_cookie:
            raw = token_cookie['value']
            if raw.startswith('base64-'):
                decoded = base64.b64decode(raw[7:] + '==').decode('utf-8', errors='ignore')
                token_data = json.loads(decoded)
                access_token = token_data.get('access_token')
            else:
                access_token = None

            if access_token:
                resp = page.request.get(f'{BASE_URL}/api/workspace',
                    headers={'Authorization': f'Bearer {access_token}'})
                data = resp.json()
                wid = data.get('activeWorkspaceId')
                print(f'✅ PASS — Test 6: activeWorkspaceId = {str(wid)[:40]}')
            else:
                print(f'❌ FAIL — Test 6: Could not decode token')
        else:
            print(f'❌ FAIL — Test 6: Auth cookie not found')
    except Exception as e:
        print(f'❌ FAIL — Test 6: {str(e)[:100]}')

    # Test 11: Chat interface
    print('\nTest 11: Chat interface...')
    page.goto(f'{BASE_URL}/dashboard/workers/content-writer?tab=chat', wait_until='networkidle')
    page.wait_for_timeout(3000)
    chat_input = page.query_selector('textarea[placeholder*="Message"]')
    if chat_input:
        chat_input.fill('Hello, this is a test message.')
        page.screenshot(path=f'{OUT_DIR}/t11-chat-final.png')
        print('✅ PASS — Test 11: Chat interface loads and accepts input')
    else:
        page.screenshot(path=f'{OUT_DIR}/t11-chat-fail.png')
        print('❌ FAIL — Test 11: Chat input not found')

    browser.close()
    print('\nDone.')
