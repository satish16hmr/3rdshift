const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto('https://3rdshift.ai');
  await page.evaluate(() => { document.cookie = 'sidebar_state=true; path=/; max-age=604800'; });
  await page.goto('https://3rdshift.ai/login');
  await page.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Log in")');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(10000);

  const info = await page.evaluate(() => {
    // Find all elements with data-team-updates-bell
    const myBell = document.querySelector('[data-team-updates-bell="true"]');
    
    // Find all visible elements at top of sidebar
    const sidebar = document.querySelector('[data-sidebar="sidebar"]');
    const sidebarHeader = sidebar?.querySelector('[data-sidebar="header"]') || 
                          document.querySelector('[class*="SidebarHeader"]') ||
                          document.querySelector('aside header') ||
                          document.querySelector('.px-4.py-3');
    
    // Get all elements in the first 60px vertical of screen
    const allVisible = [];
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top < 60 && r.height > 0 && r.width > 0 && r.top >= 0) {
        const cls = typeof el.className === 'string' ? el.className?.slice(0, 50) : '';
        allVisible.push({ tag: el.tagName, class: cls, top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) });
      }
    });
    
    return {
      myBellFound: !!myBell,
      myBellRect: myBell ? myBell.getBoundingClientRect() : null,
      myBellParentClass: myBell?.parentElement?.className?.slice(0, 100),
      myBellGrandparentClass: myBell?.parentElement?.parentElement?.className?.slice(0, 100),
      sidebarHeaderFound: !!sidebarHeader,
      sidebarHeaderClass: sidebarHeader?.className?.slice(0, 100),
      sidebarHeaderRect: sidebarHeader ? sidebarHeader.getBoundingClientRect() : null,
      sidebarDataState: document.querySelector('[data-sidebar="sidebar"]')?.dataset?.state,
      sidebarDataCollapsible: document.querySelector('[data-sidebar="sidebar"]')?.dataset?.collapsible,
      topElements: allVisible.slice(0, 15),
    };
  });

  console.log(JSON.stringify(info, null, 2));
  
  await page.screenshot({ path: '/tmp/bell-debug-v2.png' });
  await browser.close();
}
main().catch(console.error);
