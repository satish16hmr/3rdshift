/**
 * Test isSkipResponse() with all 9 required cases from the brief
 */

function isSkipResponse(response) {
  if (!response || typeof response !== 'string') return true;
  const trimmed = response.trim();
  if (trimmed.length < 50) return true;
  if (trimmed.toUpperCase().startsWith('SKIP')) return true;
  const rejectPatterns = [
    'i need more context',
    'i need more information',
    "i don't have enough",
    'i need to be honest',
    "i'm not able to",
    'i cannot provide',
    "i'm unable to",
    'without more details',
    'without more information',
    'without knowing more',
    'i would need to know',
    "i'd need more",
    'hard to suggest',
    'difficult to recommend',
    'not enough data',
    'not enough information',
    "i'm not sure what",
    'could you provide',
    'could you share',
    'can you tell me',
    'let me know more',
    'please provide',
    'please share',
  ];
  const lower = trimmed.toLowerCase();
  for (const pattern of rejectPatterns) {
    if (lower.includes(pattern)) return true;
  }
  return false;
}

const tests = [
  { input: 'SKIP', expectedSkip: true, label: '1. "SKIP" — explicit' },
  { input: 'SKIP — not enough context to give a useful suggestion here.', expectedSkip: true, label: '2. "SKIP — not enough context..."' },
  { input: 'skip', expectedSkip: true, label: '3. "skip" — lowercase' },
  { input: "I need to be honest here, your content heavily covers AI topics but I don't have your specific brand context to recommend something targeted.", expectedSkip: true, label: '4. "I need to be honest here..."' },
  { input: 'Could you share more about your target audience and what competitors you\'re watching? That would help me give you a better suggestion.', expectedSkip: true, label: '5. "Could you share more..."' },
  { input: 'Hi', expectedSkip: true, label: '6. "Hi" — too short' },
  { input: '', expectedSkip: true, label: '7. "" — empty string' },
  { input: null, expectedSkip: true, label: '8. null' },
  {
    input: "Your last article on AI replacing freelancers is your strongest piece. A follow-up angle — the cost-per-task breakdown comparing AI workers vs VA rates — fills a gap none of your competitors have addressed. Want me to structure that piece?",
    expectedSkip: false,
    label: '9. Real good suggestion — specific, actionable, 50+ chars',
  },
];

let passed = 0, failed = 0;
console.log('=== isSkipResponse() Test Results ===\n');

for (const t of tests) {
  const got = isSkipResponse(t.input);
  const ok = got === t.expectedSkip;
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? '✅' : '❌'} ${t.label}`);
  console.log(`   expected isSkip=${t.expectedSkip}, got=${got}`);
  if (!ok) console.log(`   INPUT: "${String(t.input).slice(0, 80)}"`);
  console.log();
}

console.log(`Result: ${passed}/9 passed, ${failed} failed`);
if (failed > 0) process.exit(1);
