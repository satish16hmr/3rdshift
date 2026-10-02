/**
 * Dex specialist rebuild — 7 platform test scenarios
 * Tests all 7 platform modes with distinct products
 */
'use strict';

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://auth.3rdshift.ai';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.PROD_SVC_KEY;
if (!SUPABASE_KEY) throw new Error('Missing Supabase key env for SUPABASE_KEY');
const TEST_EMAIL = 'test-roger@3rdshift.ai';
const TEST_PASSWORD = '<SCREENSHOT_TEST_PASSWORD>';
const BASE_URL = 'https://3rdshift.ai';
const TODAY = new Date().toISOString().split('T')[0];

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const TESTS = [
  {
    name: 'Test 1 — Shopify / DTC',
    input: {
      product_name: 'Merino Wool T-Shirt',
      hero_benefit: 'Feels like your softest tee from day one, stays that way after 100 washes.',
      features: '100% merino wool, 180 GSM, machine washable cold, sweat-wicking, odor-resistant, available in 12 colors.',
      target_customer: "A 38-year-old who travels for work 3 days a week and hates packing multiple shirts because they smell or wrinkle. He's tried both the cheap stuff and the $200 Patagonia options.",
      platform: 'Shopify / DTC site',
      tone: 'Warm & conversational',
      length: 'Standard (~150\u2013300 words)',
      price_point: '$85',
      beats: 'Cheap synthetic fabrics that trap odor, Patagonia capilene that runs too technical-looking for the office',
    },
    checks: {
      platform: 'shopify',
      minWords: 150,
      maxWords: 300,
      shouldNotContain: ['Elevate your everyday', 'premium quality', 'high-quality', 'crafted with'],
      shouldContain: [],
    },
  },
  {
    name: 'Test 2 — Amazon TFSD',
    input: {
      product_name: '32oz Stainless Steel Water Bottle',
      hero_benefit: 'Coffee still hot at 3pm. Ice water still cold the next morning.',
      features: 'Triple-wall vacuum insulation, 18/8 food-grade stainless steel, BPA-free lid, leak-proof, fits car cupholders, 32oz capacity.',
      target_customer: "Someone who fills their water bottle once in the morning and needs it to stay cold all day — no refilling, no warm water by noon.",
      platform: 'Amazon',
      tone: 'Direct & punchy',
      length: 'Standard (~150\u2013300 words)',
      price_point: '$28',
    },
    checks: {
      platform: 'amazon',
      shouldContain: ['TITLE', '\u2022', 'DESCRIPTION'],
      shouldNotContain: ['Elevate', 'premium quality', 'game-changing', 'best-in-class'],
    },
  },
  {
    name: 'Test 3 — Etsy',
    input: {
      product_name: 'Handmade Ceramic Mug',
      hero_benefit: 'One-of-a-kind mug that makes your morning ritual feel like it matters.',
      features: 'Hand-thrown stoneware, food-safe glaze, dishwasher safe, 12oz, slight variations in each piece are intentional, each signed by maker.',
      target_customer: "Someone buying a birthday gift for a friend who is tired of mass-produced stuff. She wants something that looks considered and personal, not expensive-for-the-sake-of-it.",
      platform: 'Etsy',
      tone: 'Warm & conversational',
      length: 'Standard (~150\u2013300 words)',
      price_point: '$32',
    },
    checks: {
      platform: 'etsy',
      minWords: 150,
      maxWords: 250,
      shouldNotContain: ['Elevate', 'premium quality', 'crafted with meticulous'],
    },
  },
  {
    name: 'Test 4 — TikTok Shop',
    input: {
      product_name: 'LED Ring Light with Phone Mount',
      hero_benefit: "Studio lighting that fits in your bag. No more bad lighting ruining content you spent an hour filming.",
      features: '10-inch ring, 3 color modes, 10 brightness levels, flexible phone mount, USB powered, foldable tripod stand.',
      target_customer: "A 23-year-old content creator posting daily on TikTok who's sick of uploading dark videos because their bedroom lighting is terrible.",
      platform: 'TikTok Shop / Instagram Shop',
      tone: 'Playful & irreverent',
      length: 'Short (~50\u2013100 words)',
      price_point: '$45',
    },
    checks: {
      platform: 'tiktok',
      maxChars: 600,
      shouldNotContain: ['Elevate', 'premium quality', 'In today\'s fast-paced'],
    },
  },
  {
    name: 'Test 5 — Walmart',
    input: {
      product_name: 'Cordless Handheld Vacuum Cleaner',
      hero_benefit: "Quick spot cleanups without dragging out the big vacuum.",
      features: '22V lithium battery, 25-min runtime, 2-speed suction, includes crevice tool and brush attachment, charging dock included, 0.5L dust cup.',
      target_customer: "Parents who need to clean up cereal spills and pet hair between full vacuuming sessions.",
      platform: 'Walmart / big-box marketplace',
      tone: 'Direct & punchy',
      length: 'Standard (~150\u2013300 words)',
      price_point: '$59',
    },
    checks: {
      platform: 'walmart',
      minWords: 100,
      maxWords: 250,
      shouldNotContain: ['Elevate', 'irreverent', 'game-changing'],
    },
  },
  {
    name: 'Test 6 — Wholesale / B2B catalog',
    input: {
      product_name: 'Commercial Stainless Steel Mixing Bowl Set',
      hero_benefit: 'NSF-certified kitchen-grade bowls built for high-volume prep environments.',
      features: '18/10 stainless steel, NSF certified, 5-piece set (3qt, 5qt, 8qt, 13qt, 20qt), rolled rim for non-slip grip, stackable, dishwasher safe, scratch-resistant finish.',
      target_customer: "Food service purchasing managers at restaurants and hotel kitchens ordering in bulk for prep stations.",
      platform: 'Wholesale / catalog',
      tone: 'Authoritative & technical',
      length: 'Standard (~150\u2013300 words)',
      price_point: '$14.99/unit wholesale, MOQ 12-piece case',
    },
    checks: {
      platform: 'wholesale',
      shouldContain: [],
      shouldNotContain: ['Elevate', 'story', 'journey', 'feel'],
    },
  },
  {
    name: 'Test 7 — DTC long-form website',
    input: {
      product_name: 'Arc\'teryx Beta AR Jacket',
      hero_benefit: "The last rain jacket you'll buy for a decade.",
      features: 'GORE-TEX Pro 3-layer construction, waterproof/breathable/windproof, Cohaesive hood system, underarm zips, helmet-compatible, pit zips, packable, lifetime repair guarantee.',
      target_customer: "A weekend alpine climber who's been burned by jackets that leaked at mile 12, bulked up when wet, or had hoods that blew off in wind. She's done buying cheap and buying again.",
      platform: 'Website product page (long-form)',
      tone: 'Premium & understated',
      length: 'Long (~400\u2013600 words)',
      price_point: '$850',
      beats: 'Budget outdoor jackets that delaminate after 2 seasons, technical jackets that look like garbage bags',
    },
    checks: {
      platform: 'long-form',
      minWords: 400,
      maxWords: 650,
      shouldNotContain: ['Elevate', 'premium quality', 'game-changing', 'crafted with meticulous'],
    },
  },
];

async function runTest(t, token, userId, workspaceId) {
  // Insert task
  const { data: taskData, error: insertErr } = await sb.from('tasks').insert({
    user_id: userId,
    workspace_id: workspaceId,
    worker_slug: 'product-description-writer',
    category: 'design-creative',
    task_type: 'light',
    status: 'pending',
    input: t.input,
  }).select('id').single();

  if (insertErr || !taskData) {
    return { name: t.name, status: 'FAIL', error: `Insert error: ${insertErr?.message}` };
  }

  const taskId = taskData.id;

  // Execute
  const res = await fetch(`${BASE_URL}/api/execute-task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-workspace-id': workspaceId },
    body: JSON.stringify({ taskId }),
  });

  if (!res.ok) {
    return { name: t.name, status: 'FAIL', error: `Execute-task ${res.status}` };
  }

  // Poll for completion
  let result;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const { data } = await sb.from('tasks').select('status, output, output_status').eq('id', taskId).single();
    if (data?.status === 'completed' || data?.status === 'failed') {
      result = data;
      break;
    }
  }

  if (!result || result.status === 'failed') {
    return { name: t.name, status: 'FAIL', taskId, error: result?.output?.error || 'Timeout or failure' };
  }

  const text = result.output?.text || '';
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const charCount = text.length;
  const failures = [];

  // Run checks
  if (t.checks.minWords && wordCount < t.checks.minWords) failures.push(`Too short: ${wordCount} words (min ${t.checks.minWords})`);
  if (t.checks.maxWords && wordCount > t.checks.maxWords) failures.push(`Too long: ${wordCount} words (max ${t.checks.maxWords})`);
  if (t.checks.maxChars && charCount > t.checks.maxChars) failures.push(`Too many chars: ${charCount} (max ${t.checks.maxChars})`);

  const BANNED = ['Crafted with meticulous attention', 'Elevate your everyday', 'Premium quality', 'Unleash the power of',
    'Experience the difference', 'Take your', 'to the next level', 'In today\'s fast-paced world',
    'Designed with you in mind', 'Say goodbye to', 'Look no further'];
  for (const banned of BANNED) {
    if (text.toLowerCase().includes(banned.toLowerCase())) {
      failures.push(`Banned phrase found: "${banned}"`);
    }
  }
  for (const phrase of (t.checks.shouldNotContain || [])) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) failures.push(`Should not contain: "${phrase}"`);
  }

  const preview = text.substring(0, 200).replace(/\n/g, ' ');
  return {
    name: t.name,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    taskId,
    wordCount,
    charCount,
    outputStatus: result.output_status,
    failures,
    preview,
  };
}

(async () => {
  const { data: signIn } = await sb.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  const token = signIn?.session?.access_token;
  const userId = signIn?.user?.id;
  const { data: member } = await sb.from('workspace_members').select('workspace_id').eq('user_id', userId).single();
  const workspaceId = member?.workspace_id;
  console.log('Auth OK, userId:', userId?.substring(0, 8));

  const results = [];
  for (const t of TESTS) {
    process.stdout.write(`Running ${t.name}... `);
    const r = await runTest(t, token, userId, workspaceId);
    results.push(r);
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${r.wordCount || r.charCount || '?'} words/chars | ${r.failures?.length || 0} failures`);
    if (r.failures?.length > 0) r.failures.forEach(f => console.log(`   ⚠️  ${f}`));
    if (r.preview) console.log(`   Preview: ${r.preview.substring(0, 100)}...`);
  }

  const passed = results.filter(r => r.status === 'PASS').length;
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Dex Tests: ${passed}/${results.length} passed`);
  console.log(results.map(r => `  ${r.status === 'PASS' ? '✅' : '❌'} ${r.name}`).join('\n'));

  // Write results
  const out = { date: TODAY, results, passed, total: results.length };
  fs.writeFileSync(path.join(__dirname, `dex-test-results-${TODAY}.json`), JSON.stringify(out, null, 2));
  console.log(`\nResults saved: scripts/dex-test-results-${TODAY}.json`);
})();
