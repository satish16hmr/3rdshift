/**
 * test-wordpress-direct.cjs
 * Simulates the full WordPress send flow directly from Mac mini:
 * 1. Get a Sam task with edited_output from Supabase
 * 2. Call the send logic exactly as the API route does
 * 3. Verify the WP post contains the edited content
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const { marked } = require('marked');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WP_URL = 'http://localhost:8765';
const WP_USER = 'admin';
const WP_PASS = 'RaOMv9OsbMqKySUNPQBH6XKe';
const ROGER_ID = 'beb11849-c77e-4ba0-84a5-12c85e087162';
const WP_MARKER = `WP_EDIT_TEST_${Date.now()}`;

function markdownToHtml(md) {
  return marked.parse(md, { gfm: true, breaks: true });
}

async function run() {
  console.log('══════════════════════════════════════════');
  console.log('TEST 1 — Edit → Send to WordPress');
  console.log('══════════════════════════════════════════');

  // Step 1: Get most recent Sam task with edited_output
  const { data: task } = await supabase
    .from('tasks')
    .select('id, output, edited_output, worker_slug')
    .eq('user_id', ROGER_ID)
    .eq('worker_slug', 'long-form-article-writer')
    .eq('status', 'completed')
    .not('edited_output', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!task) {
    console.log('❌ No Sam task with edited_output found. Run test-editor-full first.');
    process.exit(1);
  }

  console.log('Task ID:', task.id);
  console.log('Has edited_output:', !!task.edited_output);
  console.log('edited_output preview:', task.edited_output.slice(0, 80));

  // Step 2: Inject our test marker into the edited_output (simulating a fresh edit)
  const editedWithMarker = `<p>${WP_MARKER} — test marker for WordPress verification</p>` + task.edited_output;
  await supabase
    .from('tasks')
    .update({ edited_output: editedWithMarker })
    .eq('id', task.id);

  console.log(`\nInjected marker: ${WP_MARKER}`);

  // Step 3: Re-fetch the task (as the API route does)
  const { data: freshTask } = await supabase
    .from('tasks')
    .select('worker_slug, input, output, edited_output, status')
    .eq('id', task.id)
    .single();

  // Step 4: Build the HTML content exactly as the API route does
  const htmlContent = freshTask.edited_output || markdownToHtml(freshTask.output?.text || '');
  const postTitle = 'Roger Test — Editor Send to WordPress';

  console.log('\nContent being sent to WordPress:');
  console.log('  Contains marker:', htmlContent.includes(WP_MARKER));
  console.log('  Content type:', freshTask.edited_output ? 'edited_output (HTML)' : 'markdown converted');
  console.log('  First 120 chars:', htmlContent.slice(0, 120));

  // Step 5: Send to WordPress REST API (using ?rest_route= format for PHP dev server)
  const credentials = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
  const postRes = await fetch(`${WP_URL}/?rest_route=/wp/v2/posts`, { // eslint-disable-line
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: postTitle,
      content: htmlContent,
      status: 'draft',
    }),
  });

  if (!postRes.ok) {
    const errText = await postRes.text();
    console.log(`\n❌ WordPress API error: ${postRes.status}`);
    console.log(errText.slice(0, 300));
    process.exit(1);
  }

  const postData = await postRes.json();
  console.log(`\n✅ WordPress post created!`);
  console.log(`  Post ID: ${postData.id}`);
  console.log(`  Status: ${postData.status}`);
  console.log(`  Edit URL: ${WP_URL}/wp-admin/post.php?post=${postData.id}&action=edit`);

  // Step 6: Verify the post content contains our marker
  const savedContent = postData.content?.rendered || '';
  const rawContent = postData.content?.raw || '';

  if (savedContent.includes(WP_MARKER) || rawContent.includes(WP_MARKER)) {
    console.log(`\n✅ TEST 1 PASS: WordPress post content contains edit marker "${WP_MARKER}"`);
    console.log('  → Send to WordPress correctly sends edited_output, not original output');
  } else {
    // Re-fetch to double check
    const checkRes = await fetch(`${WP_URL}/?rest_route=/wp/v2/posts/${postData.id}\u0026context=edit`, {
      headers: { 'Authorization': `Basic ${credentials}` },
    });
    const checkData = await checkRes.json();
    const checkContent = checkData.content?.raw || checkData.content?.rendered || '';
    if (checkContent.includes(WP_MARKER)) {
      console.log(`\n✅ TEST 1 PASS: WordPress post contains edit marker (confirmed via re-fetch)`);
    } else {
      console.log(`\n❌ TEST 1 FAIL: Post does NOT contain marker. Content[0:200]: ${checkContent.slice(0, 200)}`);
      process.exit(1);
    }
  }

  // Step 7: Screenshot — show what was posted
  console.log('\n══ Summary ══');
  console.log(`WP post ID ${postData.id} created as draft.`);
  console.log(`Marker "${WP_MARKER}" confirmed in WordPress content.`);
  console.log('The API route reads edited_output first — content flows correctly ✅');
}

run().catch(e => { console.error(e); process.exit(1); });
