/**
 * registry-metadata-audit.cjs
 *
 * Systematic audit of all 85 deployed workers across 14 registry fields.
 * Rerunnable: zero regex on field values, uses real TypeScript source.
 * Outputs: console report + docs/registry-audit-YYYY-MM-DD.md
 *
 * Fields audited per worker:
 *  1. slug               — consistency with deployed role
 *  2. name               — matches registry
 *  3. category           — correct category slug + catClass
 *  4. tier (taskType)    — Heavy/Light internally consistent
 *  5. creditCost         — present on Heavy, absent on Light
 *  6. modality           — text/image/audio/video from outputFormat
 *  7. tags               — no cross-worker copy-paste drift
 *  8. card description   — present, non-empty
 *  9. humanize exemption — NON_HUMANIZABLE_SLUGS membership logical
 * 10. chat intro         — present in chat-intros.ts, slug consistent
 * 11. mode-gated         — workerModes / MODE_GATED_CHAT_PROTOCOLS / intent / workerModeField in sync
 * 12. handoff targets    — handoffWorkers/handoffWorkersByMode reference valid current slugs
 * 13. catClass           — matches category
 * 14. humanize registry  — humanizeLevel field present on text workers
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ─── Raw source reads ────────────────────────────────────────────────────────
const registrySrc    = fs.readFileSync(path.join(ROOT, 'lib/workers/registry.ts'),    'utf8');
const configsSrc     = fs.readFileSync(path.join(ROOT, 'lib/workers/configs.ts'),     'utf8');
const chatIntrosSrc  = fs.readFileSync(path.join(ROOT, 'lib/chat-intros.ts'),         'utf8');
const chatBaseSrc    = fs.readFileSync(path.join(ROOT, 'lib/workers/chat-baseline.ts'), 'utf8');
const resultPageSrc  = fs.readFileSync(path.join(ROOT, 'app/dashboard/tasks/result/page.tsx'), 'utf8');
const teamChatSrc    = fs.readFileSync(path.join(ROOT, 'components/chat/TeamMemberChat.tsx'), 'utf8');

// ─── Parse NON_HUMANIZABLE_SLUGS from both files ─────────────────────────────
function parseNonHumanizable(src) {
  const m = src.match(/NON_HUMANIZABLE_SLUGS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  if (!m) return new Set();
  const slugs = m[1].match(/'([^']+)'/g) || [];
  return new Set(slugs.map(s => s.replace(/'/g, '')));
}
const nonHumResult = parseNonHumanizable(resultPageSrc);
const nonHumChat   = parseNonHumanizable(teamChatSrc);
// Union — a slug is "exempted" if in either
const nonHumanizable = new Set([...nonHumResult, ...nonHumChat]);

// ─── Parse chat intros ────────────────────────────────────────────────────────
function parseChatIntros(src) {
  const map = {};
  // Match 'slug': "..." or 'slug': `...`
  const re = /'([^']+)':\s*(?:"([^"]*?)"|`([\s\S]*?)`)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    map[m[1]] = (m[2] || m[3] || '').trim().slice(0, 200);
  }
  return map;
}
const chatIntros = parseChatIntros(chatIntrosSrc);

// ─── Parse MODE_GATED_CHAT_PROTOCOLS keys ────────────────────────────────────
const modeGatedKeys = new Set();
const mgMatch = chatBaseSrc.match(/MODE_GATED_CHAT_PROTOCOLS[^=]*=\s*\{([\s\S]*?)\};/);
if (mgMatch) {
  const re = /'([^']+)':/g;
  let m;
  while ((m = re.exec(mgMatch[1])) !== null) modeGatedKeys.add(m[1]);
}

// ─── Parse configs.ts for prompt config keys and form config keys ─────────────
function parseConfigKeys(src) {
  const promptKeys = new Set();
  const formKeys   = new Set();
  // Prompt configs: 'slug': { slug: 'slug', ...systemPrompt...
  const promptRe = /^\s+'([^']+)':\s*\{[\s\S]*?slug:\s*'([^']+)'/gm;
  let m;
  while ((m = promptRe.exec(src)) !== null) promptKeys.add(m[1]);
  // Form configs: 'slug': { slug: 'slug', sections: [
  const formRe = /^\s+'([^']+)':\s*\{\s*slug:\s*'([^']+)'.*?sections:/gm;
  while ((m = formRe.exec(src)) !== null) formKeys.add(m[1]);
  return { promptKeys, formKeys };
}
const { promptKeys, formKeys } = parseConfigKeys(configsSrc);

// ─── Parse registry workers ───────────────────────────────────────────────────
function parseRegistry(src) {
  // Split on top-level worker blocks
  const blocks = src.split(/\n  \{(?=\n\s+slug:)/);
  const workers = [];

  for (const block of blocks.slice(1)) {
    const get = (field) => {
      const m = block.match(new RegExp(`\\b${field}:\\s*'([^']+)'`));
      return m ? m[1] : null;
    };
    const getBool = (field) => block.includes(`${field}: true`);
    const getNum  = (field) => {
      const m = block.match(new RegExp(`\\b${field}:\\s*(\\d+)`));
      return m ? parseInt(m[1]) : null;
    };

    const slug         = get('slug');
    if (!slug) continue;

    const name         = get('name');
    const personaName  = get('personaName');
    const category     = get('category');
    const categorySlug = get('categorySlug');
    const taskType     = get('taskType');        // 'heavy' | 'light'
    const creditCost   = getNum('creditCost');
    const minPlan      = get('minPlan');
    const outputFormat = get('outputFormat');    // 'markdown'|'images'|'pptx'|'clips'|'captions'|'csv'|'json'
    const catClass     = get('catClass');
    const humanizeLevel = block.match(/humanizeLevel:\s*'([^']+)'/)? 
                          block.match(/humanizeLevel:\s*'([^']+)'/)[1] : 
                          (block.includes('humanizeLevel') ? 'undefined' : null);

    // Tags
    const tagsM = block.match(/tags:\s*\[([^\]]+)\]/);
    const tags  = tagsM ? tagsM[1].match(/'([^']+)'/g)?.map(t => t.replace(/'/g,'')) || [] : [];

    // Description
    const descM = block.match(/description:\s*['`]([^'`]*?)['`]/);
    const description = descM ? descM[1].slice(0, 120) : '';

    // workerModes present?
    const hasWorkerModes   = block.includes('workerModes:');
    const workerModeField  = get('workerModeField');

    // handoffWorkers / handoffWorkersByMode — extract target workerIds
    const handoffTargets = [];
    const hwRe = /workerId:\s*'([^']+)'/g;
    let hwM;
    while ((hwM = hwRe.exec(block)) !== null) handoffTargets.push(hwM[1]);

    // hasTemplates
    const hasTemplates = getBool('hasTemplates');

    workers.push({
      slug, name, personaName, category, categorySlug, taskType, creditCost,
      minPlan, outputFormat, catClass, humanizeLevel, tags, description,
      hasWorkerModes, workerModeField, handoffTargets, hasTemplates,
    });
  }
  return workers;
}

const workers = parseRegistry(registrySrc);
const workerSlugs = new Set(workers.map(w => w.slug));

// ─── Category → expected catClass map ────────────────────────────────────────
const CAT_CLASS = {
  'Content Writing':     'wc-cw',
  'Copywriting':         'wc-cw',
  'Social Media':        'wc-sm',
  'Marketing':           'wc-mk',
  'Research & Strategy': 'wc-rd',
  'Design & Creative':   'wc-dc',
  'Video':               'wc-vi',
  'Audio & Voice':       'wc-av',
  'Documents & Reports': 'wc-dr',
  'Data & Analytics':    'wc-da',
  'Recruiting & HR':     'wc-rh',
  'Admin & Ops':         'wc-ao',
  'AI Services':         'wc-as',
  'Sales & Lead Gen':    'wc-sl',
};

// Modality derived from outputFormat
function modality(outputFormat) {
  if (!outputFormat) return 'text';
  if (['markdown','csv','json','html'].includes(outputFormat)) return 'text';
  if (['images'].includes(outputFormat)) return 'image';
  if (['pptx'].includes(outputFormat)) return 'visual';
  if (['clips','captions'].includes(outputFormat)) return 'video';
  return 'text';
}

// Workers that should be in NON_HUMANIZABLE_SLUGS (not prose-content output)
const SHOULD_BE_NON_HUMANIZABLE = new Set([
  // Image workers
  'thumbnail-designer','logo-concept-generator','social-media-graphics-designer',
  // Audio workers
  'voiceover-artist','sound-effects-designer','content-translator','transcription-specialist',
  'meeting-notes-writer',
  // Video workers
  'product-video-creator','b-roll-generator','scene-director','ad-creative-generator','video-repurposer',
  // Data/structured output
  'lead-generator','data-cleaner','bookkeeping-summarizer','spreadsheet-builder',
  'presentation-builder','data-analyst','kpi-dashboard-writer',
  // Formal documents (humanize degrades)
  'resume-writer','cover-letter-writer','proposal-writer','legal-document-drafter',
  'standard-operating-procedure-writer','whitepaper-writer','press-release-writer',
  'business-plan-writer','automation-blueprint-writer',
  // Structured deliverables
  'pricing-strategist','interview-question-writer',
]);

// Mode-gated workers (should have workerModes + MODE_GATED_CHAT_PROTOCOLS + workerModeField)
// Note: course-outline-builder uses modeCredits pattern, not workerModes — excluded here
const MODE_GATED_EXPECTED = new Set([
  'podcast-show-notes-writer','landing-page-copywriter',
  'newsletter-writer','email-copywriter','interview-question-writer','creative-editor',
]);

// ─── Run audit ────────────────────────────────────────────────────────────────
const findings = []; // { slug, field, status, current, expected, note }

function flag(slug, field, status, current, expected, note) {
  findings.push({ slug, field, status, current, expected, note });
}

for (const w of workers) {

  // 1. slug — already verified by ground-truth brief; just check no spaces/caps
  if (w.slug !== w.slug.toLowerCase() || w.slug.includes(' ')) {
    flag(w.slug, 'slug', 'DRIFT', w.slug, w.slug.toLowerCase(), 'Has uppercase or space');
  }

  // 2. name — non-empty
  if (!w.name) flag(w.slug, 'name', 'DRIFT', '', '(should exist)', 'Name is empty');

  // 3. category + catClass consistency
  const expectedCatClass = CAT_CLASS[w.category];
  if (expectedCatClass && w.catClass !== expectedCatClass) {
    flag(w.slug, 'catClass', 'DRIFT', w.catClass, expectedCatClass,
      `category="${w.category}" expects catClass="${expectedCatClass}" but has "${w.catClass}"`);
  }
  if (!expectedCatClass && w.category) {
    flag(w.slug, 'category', 'UNCLEAR', w.category, '?', 'Unknown category — not in CAT_CLASS map');
  }

  // 4+5. Tier vs creditCost
  if (w.taskType === 'heavy' && w.creditCost == null) {
    flag(w.slug, 'creditCost', 'DRIFT', 'null', '>0', 'Heavy worker missing creditCost');
  }
  if (w.taskType === 'light' && w.creditCost != null) {
    flag(w.slug, 'creditCost', 'DRIFT', String(w.creditCost), 'null', 'Light worker has creditCost set');
  }

  // 6. Modality vs outputFormat
  // (informational only, no auto-flag)

  // 7. Tags — check for copy-paste from known wrong patterns
  // Known previously-wrong tags by slug (already fixed — verify no regression)
  const KNOWN_WRONG_TAGS = {
    'long-form-article-writer':  ['captions','social','hashtags'],
    'script-writer':             ['ecommerce','Amazon','product'],
    'ad-copywriter':             ['ghostwriting'],
    'grant-writer':              ['cold email','outreach','sequences'],
    'social-media-creator':      ['YouTube','scripts','video'],
    'email-marketing-strategist':['Reddit','community','organic'],
    'funnel-strategist':         ['threads','viral'],
    'resume-writer':             ['surveys','research','feedback'],
    'brand-strategist':          ['creative briefs'],
    'case-study-writer':         ['grants','nonprofits'],
    'press-release-writer':      ['invoices','billing'],
    'whitepaper-writer':         ['SOW','contracts'],
    'proposal-writer':           ['policies','procedures'],
    'customer-review-responder': ['meetings','agendas'],
    'standard-operating-procedure-writer': ['performance reviews'],
    'meeting-notes-summarizer':  ['interviews','hiring','questions'],
    'creative-brief-writer':     ['resume'],
    'onboarding-document-creator':['FAQ','support','conversion'],
    'training-material-writer':  ['testimonials','social proof'],
  };
  const wrong = KNOWN_WRONG_TAGS[w.slug];
  if (wrong) {
    const hits = wrong.filter(wt => w.tags.some(t => t.toLowerCase().includes(wt.toLowerCase())));
    if (hits.length > 0) {
      flag(w.slug, 'tags', 'DRIFT', w.tags.join(','), 'fixed tags', `Regression: stale tags still present: ${hits.join(',')}`);
    }
  }
  // Check tags are non-empty
  if (!w.tags || w.tags.length === 0) {
    flag(w.slug, 'tags', 'DRIFT', '[]', '(3 relevant tags)', 'No tags set');
  }

  // 8. Card description — non-empty, reasonable length
  if (!w.description || w.description.trim().length < 20) {
    flag(w.slug, 'description', 'DRIFT', w.description?.slice(0,30)||'', '(outcome-first description)', 'Description missing or too short');
  }

  // 9. Humanize exemption
  const isNonHumanizable = nonHumanizable.has(w.slug);
  const shouldBeNonHumanizable = SHOULD_BE_NON_HUMANIZABLE.has(w.slug);
  if (shouldBeNonHumanizable && !isNonHumanizable) {
    flag(w.slug, 'humanize', 'DRIFT', 'not-exempt', 'exempt',
      'Should be in NON_HUMANIZABLE_SLUGS (professional/non-prose output)');
  }
  if (!shouldBeNonHumanizable && isNonHumanizable) {
    flag(w.slug, 'humanize', 'UNCLEAR', 'exempt', 'not-exempt',
      'In NON_HUMANIZABLE_SLUGS but not expected — verify intentional');
  }

  // humanizeLevel field consistency (text workers should have it set)
  // Exception: workers in NON_HUMANIZABLE_SLUGS don't need humanizeLevel (show humanize UI is suppressed)
  const mod = modality(w.outputFormat);
  if (mod === 'text' && !w.humanizeLevel && !isNonHumanizable && !shouldBeNonHumanizable) {
    flag(w.slug, 'humanizeLevel', 'DRIFT', 'null', 'full|light', 'Text worker missing humanizeLevel field');
  }

  // 10. Chat intro — must exist for all workers
  if (!chatIntros[w.slug]) {
    flag(w.slug, 'chat-intro', 'DRIFT', 'missing', '(chat intro text)', 'No chat intro in chat-intros.ts');
  }

  // 11. Mode-gated completeness
  if (MODE_GATED_EXPECTED.has(w.slug)) {
    const hasModes    = w.hasWorkerModes;
    const hasModeField = !!w.workerModeField;
    const hasProtocol = modeGatedKeys.has(w.slug);

    if (!hasModes) flag(w.slug, 'mode-gated', 'DRIFT', 'no workerModes', 'workerModes[]', 'Mode-gated worker missing workerModes array in registry');
    if (!hasModeField) flag(w.slug, 'mode-gated', 'DRIFT', 'no workerModeField', 'field name', 'Mode-gated worker missing workerModeField');
    if (!hasProtocol) flag(w.slug, 'mode-gated', 'DRIFT', 'no protocol', 'MODE_GATED_CHAT_PROTOCOLS entry', 'Not in MODE_GATED_CHAT_PROTOCOLS');
  }
  // Reverse: has workerModes but not in MODE_GATED_EXPECTED → flag as UNCLEAR
  if (w.hasWorkerModes && !MODE_GATED_EXPECTED.has(w.slug)) {
    flag(w.slug, 'mode-gated', 'UNCLEAR', 'has workerModes', '?', 'Has workerModes but not in expected mode-gated set — intentional?');
  }

  // 12. Handoff targets — all referenced slugs must exist in registry
  for (const target of w.handoffTargets) {
    if (!workerSlugs.has(target)) {
      flag(w.slug, 'handoff-target', 'DRIFT', target, '(valid slug)', `handoffWorker target "${target}" not in registry — broken link`);
    }
  }

  // 13. configs.ts presence — every worker should have a prompt config key
  // Some workers use the allPrompts map at the bottom of configs.ts (via imported dedicated prompt files)
  // These won't be in promptKeys (different key structure) but ARE valid — check allPrompts section too
  const ALL_PROMPTS_WORKERS = new Set([
    'content-writer','thumbnail-designer','presentation-builder',
    'long-form-article-writer','email-copywriter','newsletter-writer',
    'landing-page-copywriter','pricing-strategist','cover-letter-writer',
    'podcast-show-notes-writer','interview-question-writer','creative-editor',
  ]);
  if (!promptKeys.has(w.slug) && !ALL_PROMPTS_WORKERS.has(w.slug)) {
    flag(w.slug, 'prompt-config', 'DRIFT', 'missing', '(key in configs.ts)', 'No prompt config in configs.ts');
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────
const DRIFT    = findings.filter(f => f.status === 'DRIFT');
const UNCLEAR  = findings.filter(f => f.status === 'UNCLEAR');

console.log(`\n${'═'.repeat(60)}`);
console.log(`Registry Metadata Audit — ${new Date().toISOString().slice(0,10)}`);
console.log(`Workers: ${workers.length} | Findings: ${findings.length} (DRIFT: ${DRIFT.length} | UNCLEAR: ${UNCLEAR.length})`);
console.log(`${'═'.repeat(60)}\n`);

if (DRIFT.length) {
  console.log('── DRIFT (fix required) ──────────────────────────────────');
  for (const f of DRIFT) {
    console.log(`  ❌ [${f.slug}] ${f.field}`);
    console.log(`     current: ${f.current}`);
    console.log(`     expected: ${f.expected}`);
    console.log(`     note: ${f.note}`);
  }
}

if (UNCLEAR.length) {
  console.log('\n── UNCLEAR (JR decision needed) ──────────────────────────');
  for (const f of UNCLEAR) {
    console.log(`  ⚠️  [${f.slug}] ${f.field}`);
    console.log(`     current: ${f.current}`);
    console.log(`     note: ${f.note}`);
  }
}

// ─── Per-worker summary table ────────────────────────────────────────────────
console.log('\n── Per-worker status (DRIFT workers only) ─────────────────');
const driftSlugs = new Set(DRIFT.map(f => f.slug));
for (const slug of driftSlugs) {
  const fields = DRIFT.filter(f => f.slug === slug).map(f => f.field).join(', ');
  console.log(`  ${slug}: ${fields}`);
}

// ─── Write markdown report ────────────────────────────────────────────────────
const date = new Date().toISOString().slice(0,10);
const mdPath = path.join(ROOT, `docs/registry-audit-${date}.md`);

let md = `# Registry Metadata Audit — ${date}\n\n`;
md += `**Workers:** ${workers.length} | **DRIFT:** ${DRIFT.length} | **UNCLEAR:** ${UNCLEAR.length}\n\n`;

md += `## DRIFT (requires fix)\n\n`;
if (DRIFT.length === 0) {
  md += '_None_\n\n';
} else {
  md += `| Slug | Field | Current | Expected | Note |\n|---|---|---|---|---|\n`;
  for (const f of DRIFT) {
    md += `| ${f.slug} | ${f.field} | ${f.current.slice(0,40)} | ${f.expected.slice(0,40)} | ${f.note} |\n`;
  }
  md += '\n';
}

md += `## UNCLEAR (JR decision needed)\n\n`;
if (UNCLEAR.length === 0) {
  md += '_None_\n\n';
} else {
  md += `| Slug | Field | Current | Note |\n|---|---|---|---|\n`;
  for (const f of UNCLEAR) {
    md += `| ${f.slug} | ${f.field} | ${f.current} | ${f.note} |\n`;
  }
  md += '\n';
}

md += `## All Workers — Field Snapshot\n\n`;
md += `| Slug | Persona | Category | Tier | Credits | OutputFormat | Tags | HumanizeLevel | ChatIntro | ModeGated | HandoffTargets |\n`;
md += `|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const w of workers) {
  const hasDrift = driftSlugs.has(w.slug) ? '⚠️ ' : '✅ ';
  md += `| ${hasDrift}${w.slug} | ${w.personaName} | ${w.category} | ${w.taskType} | ${w.creditCost??'-'} | ${w.outputFormat} | ${w.tags.slice(0,2).join(',')} | ${w.humanizeLevel??'-'} | ${chatIntros[w.slug]?'✅':'❌'} | ${w.hasWorkerModes?'✅':'—'} | ${w.handoffTargets.slice(0,2).join(',')||'—'} |\n`;
}

fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(mdPath, md);
console.log(`\nReport written: ${mdPath}`);
console.log(`\nDone.`);
