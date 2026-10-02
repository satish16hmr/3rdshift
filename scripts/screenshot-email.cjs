const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '../screenshots/final-verify');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 600, height: 900 } });
  const page = await ctx.newPage();

  // Load the actual digest HTML template from the cron code
  const { createClient } = require('@supabase/supabase-js');
  require('dotenv').config({ path: '.env.local' });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // Get actual suggestions for operator
  const { data: updates } = await supabase.from('team_updates')
    .select('worker_slug, preview_text, created_at')
    .eq('user_id', 'beb11849-c77e-4ba0-84a5-12c85e087162')
    .order('created_at', { ascending: false })
    .limit(5);

  const WORKER_META = {
    'lead-generator': { name: 'Lenny', avatar: 'https://3rdshift.ai/images/marketing/workers-figma/lenny.png' },
    'seo-strategist': { name: 'Kai', avatar: 'https://3rdshift.ai/images/marketing/workers-figma/kai.png' },
    'social-media-manager': { name: 'Ash', avatar: 'https://3rdshift.ai/images/marketing/workers-figma/ash.png' },
    'social-media-creator': { name: 'Ash', avatar: 'https://3rdshift.ai/images/marketing/workers-figma/ash.png' },
    'ad-copywriter': { name: 'Tate', avatar: 'https://3rdshift.ai/images/marketing/workers-figma/tate.png' },
    'email-copywriter': { name: 'Mira', avatar: 'https://3rdshift.ai/images/marketing/workers-figma/mira.png' },
    'content-writer': { name: 'Ava', avatar: 'https://3rdshift.ai/images/marketing/workers-figma/ava.png' },
    'long-form-article-writer': { name: 'Sam', avatar: 'https://3rdshift.ai/images/marketing/workers-figma/sam.png' },
  };

  const updateRows = (updates || []).slice(0, 3).map(u => {
    const meta = WORKER_META[u.worker_slug] || { name: u.worker_slug, avatar: null };
    const avatar = meta.avatar
      ? `<img src="${meta.avatar}" alt="${meta.name}" width="32" height="32" style="display:block;width:32px;height:32px;border-radius:999px;object-fit:cover;border:1px solid #e4e4e7;background:#f4f4f5;" />`
      : `<div aria-label="${meta.name}" style="width:32px;height:32px;border-radius:999px;background:#eef2ff;color:#2563eb;font-size:13px;font-weight:700;line-height:32px;text-align:center;border:1px solid #dbeafe;">${(meta.name || '?').charAt(0).toUpperCase()}</div>`;
    return `
      <tr><td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
        <table cellpadding="0" cellspacing="0" style="width:100%;"><tr>
          <td width="32" style="vertical-align:top;padding-right:12px;">${avatar}</td>
          <td style="vertical-align:top;">
            <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#111;">${meta.name}</p>
            <p style="margin:0 0 6px;font-size:13px;color:#52525b;line-height:1.5;">${u.preview_text}</p>
            <a href="https://3rdshift.ai/dashboard/workers/${u.worker_slug}?tab=chat" 
               style="font-size:12px;color:#2563eb;text-decoration:none;font-weight:600;">Reply in Team Chat →</a>
          </td>
        </tr></table>
      </td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);width:560px;margin:0 auto;">
    <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #f0f0f0;">
      <div style="font-size:24px;font-weight:800;color:#2563eb;margin-bottom:20px;">3rdShift</div>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111;">Your team checked in</h1>
      <p style="margin:0;font-size:14px;color:#71717a;">While you were away, your team had some ideas for you.</p>
    </td></tr>
    <tr><td style="padding:24px 40px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        ${updateRows}
      </table>
    </td></tr>
    <tr><td style="padding:0 40px 32px;">
      <a href="https://3rdshift.ai/dashboard" 
         style="display:inline-block;background:#2563eb;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;">
        Open 3rdShift →
      </a>
    </td></tr>
    <tr><td style="padding:24px 40px;border-top:1px solid #f0f0f0;background:#fafafa;">
      <p style="margin:0 0 8px;font-size:12px;color:#a1a1aa;">
        You're receiving this because you have Team Updates enabled in your 
        <a href="https://3rdshift.ai/dashboard/settings" style="color:#2563eb;">account settings</a>.
      </p>
      <p style="margin:0;font-size:12px;color:#a1a1aa;">
        <a href="https://3rdshift.ai/dashboard/settings" style="color:#a1a1aa;text-decoration:underline;">Unsubscribe from Team Update emails</a>
        &nbsp;·&nbsp; 3rdShift · Goat Labs LLC
      </p>
    </td></tr>
  </table>
</body></html>`;

  await page.setContent(html);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/ITEM1-A2-email-content.png`, fullPage: true });
  console.log('📸 ITEM1-A2-email-content');

  await browser.close();
}
main().catch(console.error);
