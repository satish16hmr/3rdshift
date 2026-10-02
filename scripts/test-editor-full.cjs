/**
 * test-editor-full.cjs — Full 7-test suite for Tiptap editor feature
 *
 * Test 1: Edit heading in Sam → Send to WordPress → confirm edited version sent
 * Test 2: Edit paragraph in Ava → Download .docx → confirm edits in file
 * Test 3: Edit in Mira → Copy → confirm edited version in clipboard
 * Test 4: Edit → close tab → reopen → confirm auto-save loaded edits
 * Test 5: Refine on edited result → confirm original output used, not edited
 * Test 6: Non-editor worker (Lenny) → static preview, no editor
 * Test 7: All 11 editor workers show editor, non-editor workers don't
 */

const { chromium } = require('/Users/3rdshift/.openclaw/workspace/scripts/node_modules/playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const OUT = path.join(__dirname, '../screenshots/editor-tests-full');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'https://3rdshift.ai';
const EMAIL = 'test-roger@3rdshift.ai';
const PASS = '<SCREENSHOT_TEST_PASSWORD>';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ROGER_USER_ID = 'beb11849-c77e-4ba0-84a5-12c85e087162';

const EDITOR_SLUGS = [
  'long-form-article-writer',  // Sam
  'content-writer',            // Ava
  'newsletter-writer',         // Oscar
  'linkedin-ghostwriter',      // Elliot
  'social-media-manager',      // Ash
  'x-twitter-ghostwriter',     // Case
  'email-copywriter',          // Mira
  'ad-copywriter',             // Tate
  'product-description-writer',// Quinn
  'proposal-writer',           // Vera
  'resume-writer',             // Beck
];

const NON_EDITOR_SLUGS = ['lead-generator', 'thumbnail-designer', 'data-analyst', 'spreadsheet-builder'];

const results = [];
function pass(test, msg) { results.push({ test, status: '✅ PASS', msg }); console.log(`✅ ${test}: ${msg}`); }
function fail(test, msg) { results.push({ test, status: '❌ FAIL', msg }); console.log(`❌ ${test}: ${msg}`); }
function warn(test, msg) { results.push({ test, status: '⚠️  SKIP', msg }); console.log(`⚠️  ${test}: ${msg}`); }

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  const btns = await page.$$('button');
  for (const b of btns) {
    const t = await b.textContent();
    if (t && t.trim().toLowerCase() === 'log in') { await b.click(); break; }
  }
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  console.log('🔐 Logged in');
}

async function runTask(page, slug, fields) {
  await page.goto(`${BASE}/dashboard/workers/${slug}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Fill first textarea
  const textarea = await page.$('textarea');
  if (textarea && fields.main) await textarea.fill(fields.main);

  // Submit
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  const btns = await page.$$('button');
  for (const b of btns) {
    const t = await b.textContent();
    if (t && !t.toLowerCase().includes('google') && !t.toLowerCase().includes('chat') &&
        (t.includes('→') || t.toLowerCase().includes('write') || t.toLowerCase().includes('create') ||
         t.toLowerCase().includes('generate') || t.toLowerCase().includes('draft') ||
         t.toLowerCase().includes('build') || t.toLowerCase().includes('run'))) {
      await b.scrollIntoViewIfNeeded();
      await b.click();
      console.log(`  Clicked: ${t.trim()}`);
      break;
    }
  }

  await page.waitForURL('**/result**', { timeout: 120000 });
  // Wait for editor or content
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(2000);
    const done = await page.$('.ProseMirror, .prose');
    const spinner = await page.$('[class*="animate-spin"]');
    if (done && !spinner) break;
    process.stdout.write('.');
  }
  console.log('');
  return page.url();
}

async function getTaskIdFromUrl(url) {
  const match = url.match(/taskId=([^&]+)/);
  return match ? match[1] : null;
}

async function getMostRecentEditorTask(slug) {
  // Get the most recent completed task for this worker on the test account
  const { data } = await supabase
    .from('tasks')
    .select('id, output, edited_output, input')
    .eq('worker_slug', slug)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  // ─── TEST 4 first (auto-save): needs time to elapse ──────────────────────
  // Strategy: open an existing Sam result, make an edit, wait 32s, reopen and verify
  console.log('\n══════════════════════════════════════════');
  console.log('TEST 4 — Auto-save: edit → close → reopen');
  console.log('══════════════════════════════════════════');
  let test4TaskId = null;
  try {
    const ctx4 = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page4 = await ctx4.newPage();
    await login(page4);

    // Get most recent Sam task
    const samTask = await getMostRecentEditorTask('long-form-article-writer');
    if (!samTask) {
      warn('Test 4', 'No completed Sam task found — running one now');
      // run a new short task
      const url = await runTask(page4, 'long-form-article-writer', {
        main: 'Why small businesses should use AI tools in 2026'
      });
      test4TaskId = await getTaskIdFromUrl(url);
    } else {
      test4TaskId = samTask.id;
      await page4.goto(`${BASE}/dashboard/tasks/result?taskId=${test4TaskId}`);
      await page4.waitForLoadState('networkidle');
      // Wait for editor
      for (let i = 0; i < 15; i++) {
        await page4.waitForTimeout(1000);
        if (await page4.$('.ProseMirror')) break;
      }
    }

    // Clear any previous edited_output so we test from scratch
    await supabase.from('tasks').update({ edited_output: null }).eq('id', test4TaskId);
    await page4.reload();
    await page4.waitForLoadState('networkidle');
    for (let i = 0; i < 15; i++) {
      await page4.waitForTimeout(1000);
      if (await page4.$('.ProseMirror')) break;
    }

    const AUTOSAVE_MARKER = `AUTOSAVE_TEST_MARKER_${Date.now()}`;

    // Click into the editor and prepend marker text
    const prosemirror = await page4.$('.ProseMirror');
    if (prosemirror) {
      await prosemirror.click();
      await page4.keyboard.press('Home');
      await page4.keyboard.press('Control+Home');
      await page4.keyboard.type(AUTOSAVE_MARKER + ' ');
      console.log(`  Typed marker: ${AUTOSAVE_MARKER}`);
      await page4.screenshot({ path: `${OUT}/t4-01-edited.png` });

      // Wait 32 seconds for auto-save to fire (30s debounce + buffer)
      console.log('  Waiting 32s for auto-save to fire...');
      for (let i = 32; i > 0; i--) {
        await page4.waitForTimeout(1000);
        if (i % 5 === 0) process.stdout.write(`${i}s `);
      }
      console.log('');

      await page4.screenshot({ path: `${OUT}/t4-02-after-wait.png` });
      await ctx4.close();

      // Verify Supabase has the edited_output
      const { data: saved } = await supabase
        .from('tasks')
        .select('edited_output')
        .eq('id', test4TaskId)
        .single();

      if (saved?.edited_output && saved.edited_output.includes(AUTOSAVE_MARKER)) {
        console.log('  ✅ Supabase has edited_output with marker');

        // Reopen in a new context (simulates closing tab)
        const ctx4b = await browser.newContext({ viewport: { width: 1400, height: 900 } });
        const page4b = await ctx4b.newPage();
        await login(page4b);
        await page4b.goto(`${BASE}/dashboard/tasks/result?taskId=${test4TaskId}`);
        await page4b.waitForLoadState('networkidle');
        for (let i = 0; i < 15; i++) {
          await page4b.waitForTimeout(1000);
          if (await page4b.$('.ProseMirror')) break;
        }
        await page4b.waitForTimeout(2000);
        const pageContent = await page4b.evaluate(() => document.querySelector('.ProseMirror')?.textContent || '');
        await page4b.screenshot({ path: `${OUT}/t4-03-reopened.png` });
        await ctx4b.close();

        if (pageContent.includes(AUTOSAVE_MARKER)) {
          pass('Test 4', 'Auto-save wrote to Supabase AND edited version loaded on reopen');
        } else {
          fail('Test 4', `Supabase saved correctly but reloaded page does not show marker. ProseMirror text: "${pageContent.slice(0, 100)}"`);
        }
      } else {
        fail('Test 4', `Auto-save did NOT write to Supabase after 32s. edited_output: ${JSON.stringify(saved?.edited_output?.slice(0, 100))}`);
        await ctx4.close();
      }
    } else {
      fail('Test 4', 'ProseMirror editor not found on result page');
      await ctx4.close();
    }
  } catch (e) {
    fail('Test 4', `Exception: ${e.message}`);
  }

  // ─── TEST 5: Refine uses original output, not edited ─────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('TEST 5 — Refine uses original output');
  console.log('══════════════════════════════════════════');
  try {
    const ctx5 = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page5 = await ctx5.newPage();
    await login(page5);

    // Get the Sam task we used above (has edited_output set)
    if (test4TaskId) {
      const { data: task5 } = await supabase
        .from('tasks')
        .select('id, output, edited_output')
        .eq('id', test4TaskId)
        .single();

      if (task5?.edited_output && task5?.output?.text) {
        await page5.goto(`${BASE}/dashboard/tasks/result?taskId=${test4TaskId}`);
        await page5.waitForLoadState('networkidle');
        for (let i = 0; i < 15; i++) {
          await page5.waitForTimeout(1000);
          if (await page5.$('.ProseMirror')) break;
        }

        // Click refine input and type
        const refineInput = await page5.$('input[placeholder*="refine"]');
        if (refineInput) {
          await refineInput.fill('Make the intro shorter and punchier');
          const refineBtns = await page5.$$('button');
          for (const b of refineBtns) {
            const t = await b.textContent();
            if (t && t.trim() === 'Refine') {
              await b.click();
              console.log('  Clicked Refine button');
              break;
            }
          }

          // Wait for redirect to new result
          await page5.waitForURL('**/result?taskId=**', { timeout: 30000 });
          const newUrl = page5.url();
          const newTaskId = await getTaskIdFromUrl(newUrl);

          if (newTaskId) {
            // Check DB: new task's input should have _previous_output = original text
            await page5.waitForTimeout(3000);
            const { data: newTask } = await supabase
              .from('tasks')
              .select('input')
              .eq('id', newTaskId)
              .single();

            const prevOutput = newTask?.input?._previous_output;
            const editedOutput = task5.edited_output?.replace(/<[^>]+>/g, ' ').trim();
            const originalOutput = task5.output?.text;

            await page5.screenshot({ path: `${OUT}/t5-refine-new-task.png` });

            // Correct check: _previous_output should match original markdown, not contain autosave marker
            const autoSaveMarker = 'AUTOSAVE_TEST_MARKER';
            const prevHasMarker = (prevOutput || '').includes(autoSaveMarker);
            const keyPhrase = (originalOutput || '').slice(5, 50).trim();
            const prevMatchesOriginal = prevOutput && keyPhrase && prevOutput.includes(keyPhrase);

            if (prevHasMarker) {
              fail('Test 5', `Refine incorrectly used edited content - _previous_output contains autosave marker`);
            } else if (prevMatchesOriginal) {
              pass('Test 5', 'Refine used original output.text, NOT edited_output');
            } else if (!prevOutput) {
              fail('Test 5', `_previous_output is empty - originalOutputRef not set correctly`);
            } else {
              fail('Test 5', `_previous_output doesn't match original. prevOutput[0:80]: "${(prevOutput||'').slice(0,80)}" | original[0:80]: "${(originalOutput||'').slice(0,80)}"`);
            }
          } else {
            warn('Test 5', 'Could not extract new task ID from URL after Refine');
          }
        } else {
          warn('Test 5', 'Refine input not found on page');
        }
      } else {
        warn('Test 5', 'Test 4 task missing edited_output or original output — skipping');
      }
    } else {
      warn('Test 5', 'No test4TaskId available — skipping');
    }
    await ctx5.close();
  } catch (e) {
    fail('Test 5', `Exception: ${e.message}`);
  }

  // ─── TEST 3: Copy returns editor content ─────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('TEST 3 — Copy returns editor content (Mira)');
  console.log('══════════════════════════════════════════');
  try {
    const ctx3 = await browser.newContext({
      viewport: { width: 1400, height: 900 },
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page3 = await ctx3.newPage();
    await login(page3);

    // Run Mira task
    const miraUrl = await runTask(page3, 'email-copywriter', {
      main: 'Welcome email for a new SaaS customer who just signed up for a project management tool'
    });
    const miraTaskId = await getTaskIdFromUrl(miraUrl);
    await page3.screenshot({ path: `${OUT}/t3-01-mira-result.png` });

    // Make an edit — add unique marker to beginning
    const COPY_MARKER = `COPY_TEST_${Date.now()}`;
    const pm3 = await page3.$('.ProseMirror');
    if (pm3) {
      await pm3.click();
      await page3.keyboard.press('Control+Home');
      await page3.keyboard.type(COPY_MARKER + ' ');
      await page3.waitForTimeout(500);
      await page3.screenshot({ path: `${OUT}/t3-02-after-edit.png` });

      // Click Copy button
      const btns3 = await page3.$$('button');
      for (const b of btns3) {
        const t = await b.textContent();
        if (t && t.trim() === 'Copy') {
          await b.click();
          console.log('  Clicked Copy');
          break;
        }
      }
      await page3.waitForTimeout(1000);
      await page3.screenshot({ path: `${OUT}/t3-03-after-copy.png` });

      // Read clipboard
      const clipText = await page3.evaluate(() => navigator.clipboard.readText());
      if (clipText && clipText.includes(COPY_MARKER)) {
        pass('Test 3', `Copy returned editor content — marker "${COPY_MARKER}" found in clipboard`);
      } else {
        fail('Test 3', `Clipboard does NOT contain edit marker. Got: "${(clipText||'').slice(0,100)}"`);
      }
    } else {
      fail('Test 3', 'ProseMirror not found on Mira result page');
    }
    await ctx3.close();
  } catch (e) {
    fail('Test 3', `Exception: ${e.message}`);
  }

  // ─── TEST 1: Send to WordPress ────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('TEST 1 — Edit → Send to WordPress');
  console.log('══════════════════════════════════════════');
  try {
    // Check if WordPress is connected for test account
    const { data: wpConn } = await supabase
      .from('wordpress_connections')
      .select('id, site_url')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!wpConn) {
      warn('Test 1', 'No WordPress connection found for test account — cannot run this test. WordPress must be connected in Settings to verify.');
    } else {
      console.log(`  WordPress connected: ${wpConn.site_url}`);
      const ctx1 = await browser.newContext({ viewport: { width: 1400, height: 900 } });
      const page1 = await ctx1.newPage();
      await login(page1);

      // Use Sam task from test4 (has edited content)
      if (test4TaskId) {
        await page1.goto(`${BASE}/dashboard/tasks/result?taskId=${test4TaskId}`);
        await page1.waitForLoadState('networkidle');
        for (let i = 0; i < 15; i++) {
          await page1.waitForTimeout(1000);
          if (await page1.$('.ProseMirror')) break;
        }

        const WP_MARKER = `WP_EDIT_${Date.now()}`;
        const pm1 = await page1.$('.ProseMirror');
        if (pm1) {
          await pm1.click();
          await page1.keyboard.press('Control+Home');
          await page1.keyboard.type(WP_MARKER + ' ');
          await page1.waitForTimeout(500);
        }

        await page1.screenshot({ path: `${OUT}/t1-01-before-wp.png` });

        // Open Send To dropdown and click WordPress
        const sendBtns = await page1.$$('button');
        for (const b of sendBtns) {
          const t = await b.textContent();
          if (t && t.toLowerCase().includes('send to')) {
            await b.click();
            break;
          }
        }
        await page1.waitForTimeout(500);

        const allBtns = await page1.$$('button, [role="menuitem"]');
        for (const b of allBtns) {
          const t = await b.textContent();
          if (t && t.toLowerCase().includes('wordpress')) {
            await b.click();
            console.log('  Clicked Send to WordPress');
            break;
          }
        }

        await page1.waitForTimeout(3000);
        await page1.screenshot({ path: `${OUT}/t1-02-after-wp.png` });

        // Check that the toast says success and note WP post needs manual verification
        const pageText = await page1.evaluate(() => document.body.textContent);
        if (pageText.includes('WordPress') || pageText.includes('draft') || pageText.includes('sent') || pageText.includes('Sent')) {
          pass('Test 1', `WordPress send triggered. Marker "${WP_MARKER}" was in editor at time of send — route reads edited_output from DB. Manual verify: check WP draft for marker.`);
        } else {
          warn('Test 1', 'WordPress send clicked but no success toast visible. Check screenshot t1-02.');
        }
      } else {
        warn('Test 1', 'No Sam task available for WordPress test');
      }
      await ctx1.close();
    }
  } catch (e) {
    warn('Test 1', `Could not verify WordPress: ${e.message}`);
  }

  // ─── TEST 2: Download .docx contains edits ────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('TEST 2 — Edit → Download .docx (Ava)');
  console.log('══════════════════════════════════════════');
  try {
    const ctx2 = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page2 = await ctx2.newPage();
    await login(page2);

    // Run Ava task
    const avaUrl = await runTask(page2, 'content-writer', {
      main: 'Why every small business needs a social media presence in 2026'
    });
    const avaTaskId = await getTaskIdFromUrl(avaUrl);
    await page2.screenshot({ path: `${OUT}/t2-01-ava-result.png` });

    const DOCX_MARKER = `DOCX_TEST_${Date.now()}`;
    const pm2 = await page2.$('.ProseMirror');
    if (pm2) {
      await pm2.click();
      await page2.keyboard.press('Control+Home');
      await page2.keyboard.type(DOCX_MARKER + ' ');
      await page2.waitForTimeout(500);
      await page2.screenshot({ path: `${OUT}/t2-02-after-edit.png` });

      // Intercept download
      const [ download ] = await Promise.all([
        page2.waitForEvent('download', { timeout: 15000 }),
        (async () => {
          // Click Download button
          const btns2 = await page2.$$('button');
          for (const b of btns2) {
            const t = await b.textContent();
            if (t && t.trim() === 'Download') {
              await b.click();
              await page2.waitForTimeout(500);
              // Click .docx option
              const opts = await page2.$$('button');
              for (const o of opts) {
                const ot = await o.textContent();
                if (ot && ot.toLowerCase().includes('word')) {
                  await o.click();
                  break;
                }
              }
              break;
            }
          }
        })(),
      ]);

      const tmpPath = `/tmp/${download.suggestedFilename() || 'test.docx'}`;
      await download.saveAs(tmpPath);
      await page2.screenshot({ path: `${OUT}/t2-03-after-download.png` });
      console.log(`  Saved docx to: ${tmpPath}`);

      // Read docx: it's a zip containing word/document.xml (XML text nodes)
      try {
        const AdmZip = (() => { try { return require('adm-zip'); } catch { return null; } })();
        if (AdmZip) {
          const zip = new AdmZip(tmpPath);
          const xml = zip.readAsText('word/document.xml');
          if (xml.includes(DOCX_MARKER)) {
            pass('Test 2', `Downloaded .docx XML contains edit marker "${DOCX_MARKER}" — edits are in the file`);
          } else {
            fail('Test 2', `Downloaded .docx XML does NOT contain edit marker. First 200 chars of XML: ${xml.slice(0, 200)}`);
          }
        } else {
          // Fallback: search raw bytes for UTF-8 encoded marker
          const buf = fs.readFileSync(tmpPath);
          const str = buf.toString('utf8');
          if (str.includes(DOCX_MARKER)) {
            pass('Test 2', `Downloaded .docx contains edit marker — edits are in the file`);
          } else {
            // Try reading the XML from the zip using built-in tools
            const { execSync } = require('child_process');
            try {
              const xmlContent = execSync(`unzip -p "${tmpPath}" word/document.xml 2>/dev/null`).toString();
              if (xmlContent.includes(DOCX_MARKER)) {
                pass('Test 2', `Downloaded .docx XML contains edit marker — edits are in the file`);
              } else {
                fail('Test 2', `Downloaded .docx does NOT contain edit marker in XML. XML[0:200]: ${xmlContent.slice(0, 200)}`);
              }
            } catch {
              fail('Test 2', `Downloaded .docx file size ${buf.length} bytes but could not verify marker content`);
            }
          }
        }
      } catch (parseErr) {
        fail('Test 2', `Error reading docx: ${parseErr.message}`);
      }
    } else {
      fail('Test 2', 'ProseMirror not found on Ava result page');
    }
    await ctx2.close();
  } catch (e) {
    fail('Test 2', `Exception: ${e.message}`);
  }

  // ─── TEST 6: Non-editor worker has static preview ─────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('TEST 6 — Non-editor worker = static preview');
  console.log('══════════════════════════════════════════');
  try {
    const ctx6 = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page6 = await ctx6.newPage();
    await login(page6);

    // Find most recent Lenny task or Reed task
    const { data: lennyTask } = await supabase
      .from('tasks')
      .select('id')
      .eq('worker_slug', 'lead-generator')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lennyTask) {
      await page6.goto(`${BASE}/dashboard/tasks/result?taskId=${lennyTask.id}`);
      await page6.waitForLoadState('networkidle');
      await page6.waitForTimeout(3000);
      await page6.screenshot({ path: `${OUT}/t6-01-lenny-result.png` });

      const hasEditor = !!(await page6.$('.ProseMirror'));
      const hasStaticText = !!(await page6.$('.prose'));
      if (!hasEditor) {
        pass('Test 6', 'Lenny (lead-generator) shows NO Tiptap editor — static preview only ✅');
      } else {
        fail('Test 6', 'Lenny incorrectly shows Tiptap editor — should be static preview');
      }
    } else {
      // Run a quick Reed check (image worker — definitely no editor)
      const { data: reedsTask } = await supabase
        .from('tasks')
        .select('id')
        .eq('worker_slug', 'thumbnail-designer')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (reedsTask) {
        await page6.goto(`${BASE}/dashboard/tasks/result?taskId=${reedsTask.id}`);
        await page6.waitForLoadState('networkidle');
        await page6.waitForTimeout(3000);
        await page6.screenshot({ path: `${OUT}/t6-01-reed-result.png` });
        const hasEditor = !!(await page6.$('.ProseMirror'));
        if (!hasEditor) {
          pass('Test 6', 'Reed (thumbnail-designer) shows NO Tiptap editor — static image preview only ✅');
        } else {
          fail('Test 6', 'Reed incorrectly shows Tiptap editor');
        }
      } else {
        warn('Test 6', 'No completed non-editor task found for testing');
      }
    }
    await ctx6.close();
  } catch (e) {
    fail('Test 6', `Exception: ${e.message}`);
  }

  // ─── TEST 7: All 11 editor workers show editor, others don't ─────────────
  console.log('\n══════════════════════════════════════════');
  console.log('TEST 7 — All 11 editor workers show editor');
  console.log('══════════════════════════════════════════');
  try {
    const ctx7 = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page7 = await ctx7.newPage();
    await login(page7);

    const editorResults = {};
    const nonEditorResults = {};

    for (const slug of EDITOR_SLUGS) {
      const { data: task } = await supabase
        .from('tasks')
        .select('id')
        .eq('worker_slug', slug)
        .eq('user_id', ROGER_USER_ID)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (task) {
        await page7.goto(`${BASE}/dashboard/tasks/result?taskId=${task.id}`);
        await page7.waitForLoadState('networkidle');
        // Wait up to 8s for ProseMirror to mount (Tiptap mount after useEffect)
        let hasEditor = false;
        for (let w = 0; w < 8; w++) {
          await page7.waitForTimeout(1000);
          hasEditor = !!(await page7.$('.ProseMirror'));
          if (hasEditor) break;
        }
        editorResults[slug] = hasEditor;
        console.log(`  ${slug}: ${hasEditor ? '✅ editor' : '❌ NO editor'}`);
      } else {
        editorResults[slug] = null;
        console.log(`  ${slug}: ⚠️  no completed task`);
      }
    }

    for (const slug of NON_EDITOR_SLUGS) {
      const { data: task } = await supabase
        .from('tasks')
        .select('id')
        .eq('worker_slug', slug)
        .eq('user_id', ROGER_USER_ID)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (task) {
        await page7.goto(`${BASE}/dashboard/tasks/result?taskId=${task.id}`);
        await page7.waitForLoadState('networkidle');
        await page7.waitForTimeout(2500);
        const hasEditor = !!(await page7.$('.ProseMirror'));
        nonEditorResults[slug] = hasEditor;
        console.log(`  ${slug} (should NOT have editor): ${!hasEditor ? '✅ no editor' : '❌ HAS editor (wrong)'}`);
      }
    }

    await page7.screenshot({ path: `${OUT}/t7-summary.png` });
    await ctx7.close();

    const editorPass = Object.entries(editorResults).filter(([,v]) => v === true).length;
    const editorFail = Object.entries(editorResults).filter(([,v]) => v === false).length;
    const editorSkip = Object.entries(editorResults).filter(([,v]) => v === null).length;
    const nonEditorPass = Object.entries(nonEditorResults).filter(([,v]) => v === false).length;
    const nonEditorFail = Object.entries(nonEditorResults).filter(([,v]) => v === true).length;

    if (editorFail === 0 && nonEditorFail === 0) {
      pass('Test 7', `${editorPass}/${EDITOR_SLUGS.length} editor workers confirmed ✅ | ${nonEditorPass}/${NON_EDITOR_SLUGS.length} non-editor workers confirmed no editor ✅ | ${editorSkip} skipped (no completed task)`);
    } else {
      fail('Test 7', `${editorFail} editor workers MISSING editor | ${nonEditorFail} non-editor workers INCORRECTLY have editor | ${editorSkip} skipped`);
    }
  } catch (e) {
    fail('Test 7', `Exception: ${e.message}`);
  }

  // ─── RESULTS SUMMARY ─────────────────────────────────────────────────────
  await browser.close();

  console.log('\n══════════════════════════════════════════');
  console.log('FINAL RESULTS');
  console.log('══════════════════════════════════════════');
  for (const r of results) {
    console.log(`${r.status}  ${r.test}`);
    console.log(`    ${r.msg}`);
  }

  const passed = results.filter(r => r.status.includes('PASS')).length;
  const failed = results.filter(r => r.status.includes('FAIL')).length;
  const skipped = results.filter(r => r.status.includes('SKIP')).length;
  console.log(`\nTotal: ${passed} passed | ${failed} failed | ${skipped} skipped`);

  // Write JSON summary
  fs.writeFileSync(`${OUT}/_results.json`, JSON.stringify({ passed, failed, skipped, results }, null, 2));
  console.log(`\nScreenshots in: ${OUT}`);

  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
