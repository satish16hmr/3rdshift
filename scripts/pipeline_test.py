from playwright.sync_api import sync_playwright
import os, json, base64

BASE_URL = 'https://3rdshift.ai'
EMAIL = 'test-roger@3rdshift.ai'
PASSWORD = '<SCREENSHOT_TEST_PASSWORD>'
OUT = '/Users/3rdshift/.openclaw/workspace/backup-pre-workspace-20260408/pipeline-tests'
os.makedirs(OUT, exist_ok=True)

TESTS = [
    {
        'name': 'Jude — Legal Document Drafter',
        'slug': 'legal-document-drafter',
        'inputs': {'document_type': 'Privacy Policy', 'parties': 'Acme Inc and its users', 'jurisdiction': 'California'},
        'expect': 'text',
        'label': 'jude'
    },
    {
        'name': 'Kai — SEO Writer',
        'slug': 'seo-writer',
        'inputs': {'topic': 'AI productivity tools for small business', 'keyword': 'AI tools for business'},
        'expect': 'text',
        'label': 'kai'
    },
]

results = []

def log(name, passed, note=''):
    s = '✅ PASS' if passed else '❌ FAIL'
    results.append({'name': name, 'passed': passed, 'note': note})
    print(f'{s} — {name}' + (f' | {note}' if note else ''))

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
    print('Logged in.\n')

    for test in TESTS:
        slug = test['slug']
        label = test['label']
        print(f'Testing {test["name"]}...')

        try:
            page.goto(f'{BASE_URL}/dashboard/workers/{slug}', wait_until='networkidle')
            page.wait_for_timeout(2000)

            # Fill inputs
            for field_name, value in test['inputs'].items():
                # Try select first, then text input, then textarea
                sel = page.query_selector(f'select[name="{field_name}"]')
                if sel:
                    sel.select_option(label=value)
                    continue
                inp = page.query_selector(f'input[name="{field_name}"]') or page.query_selector(f'textarea[name="{field_name}"]')
                if inp:
                    inp.fill(value)

            # Submit
            submit = page.query_selector('button[type="submit"]') or page.query_selector('button:has-text("Draft") or button:has-text("Write") or button:has-text("Generate") or button:has-text("Run") or button:has-text("→")')
            if not submit:
                # Find any non-nav submit button
                buttons = page.query_selector_all('button')
                for b in buttons:
                    txt = b.inner_text().strip()
                    if any(k in txt for k in ['→', 'Draft', 'Write', 'Generate', 'Run', 'Create', 'Build']):
                        submit = b
                        break

            if submit:
                submit.click()
                page.wait_for_url('**/tasks/**', timeout=60000)
                page.wait_for_timeout(3000)
                page.screenshot(path=f'{OUT}/{label}-result.png', full_page=False)

                # Check what kind of output
                url = page.url
                has_image = page.query_selector('img[src*="supabase"]') or page.query_selector('img[src*="storage"]')
                has_text = page.query_selector('.prose') or page.query_selector('pre') or page.query_selector('[class*="output"]') or page.query_selector('p')
                has_download = page.query_selector('button:has-text("Download")')

                output_type = 'image' if has_image and not has_text else 'text'
                expected = test['expect']
                passed = output_type == expected
                log(test['name'], passed, f'got={output_type} expected={expected} url={url[-50:]}')
            else:
                page.screenshot(path=f'{OUT}/{label}-no-submit.png')
                log(test['name'], False, 'Submit button not found')

        except Exception as e:
            page.screenshot(path=f'{OUT}/{label}-error.png')
            log(test['name'], False, str(e)[:100])

    browser.close()

print(f'\n--- RESULTS ---')
passed = sum(1 for r in results if r['passed'])
print(f'{passed}/{len(results)} passed')
for r in results:
    s = '✅' if r['passed'] else '❌'
    print(f"  {s} {r['name']}" + (f' ({r["note"]})' if r['note'] else ''))
