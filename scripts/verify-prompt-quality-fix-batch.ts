import { workers } from '../lib/workers/registry';
import { getWorkerPromptConfig, injectSharedPromptRules } from '../lib/workers/configs';
import { HUMAN_REVIEW_REQUIRED_DISCLAIMER, ensureHumanReviewDisclaimer } from '../lib/workers/disclaimers';
import { applyDefaultWorkerMode } from '../lib/workers/required-fields';
import fs from 'node:fs';

const fail = (msg: string): never => { throw new Error(msg); };
const read = (p: string) => fs.readFileSync(p, 'utf8');
const worker = (slug: string) => workers.find(w => w.slug === slug) ?? fail(`missing worker ${slug}`);

const tala = worker('content-translator');
if (!tala.workerModes?.some(m => m.id === 'short' && m.credits === 3 && m.badge === 'pro')) fail('Tala short mode card missing');
if (!tala.workerModes?.some(m => m.id === 'standard' && m.credits === 6 && m.badge === 'pro')) fail('Tala standard mode card missing');

for (const slug of ['presentation-builder','pitch-deck-writer','website-builder','site-auditor']) {
  if (worker(slug).chainCompatible !== false) fail(`${slug} must be chainCompatible false`);
}

const configs = read('lib/workers/configs.ts');
if (!configs.includes('[PLACEHOLDER: ...]') || !configs.includes('[UNKNOWN') || !configs.includes('[INFERRED')) fail('STYLE_RULES placeholder carve-out missing');
if (!configs.includes('Do not include handoff sections')) fail('global handoff ban missing');
if (!configs.includes('DUNCAN NO-FABRICATION')) fail('Duncan no-fabrication rule missing');

const tasksCreate = read('app/api/tasks/create/route.ts');
if (!tasksCreate.includes('applyDefaultWorkerMode(worker_slug')) fail('tasks/create does not apply default mode');
const defaulted = applyDefaultWorkerMode('content-translator', {});
if (defaulted.content_duration !== 'standard') fail('applyDefaultWorkerMode did not default Tala');

const humanizeRoute = read('app/api/humanize/route.ts');
if (humanizeRoute.includes("?? 'full'")) fail('humanize still fail-opens to full');
const resultPage = read('app/dashboard/tasks/result/page.tsx');
for (const slug of ['translator','grant-writer','social-media-creator','community-manager','competitor-analyst','audience-persona-builder','brand-strategist','case-study-writer','ad-campaign-strategist']) {
  if (!resultPage.includes(`'${slug}'`)) fail(`missing NON_HUMANIZABLE slug ${slug}`);
}

if (!HUMAN_REVIEW_REQUIRED_DISCLAIMER.includes('HUMAN REVIEW REQUIRED')) fail('shared disclaimer wording missing');
if (!ensureHumanReviewDisclaimer('body').startsWith(HUMAN_REVIEW_REQUIRED_DISCLAIMER)) fail('disclaimer enforcer does not prepend');
const legalPrompt = getWorkerPromptConfig('legal-document-drafter')?.systemPrompt ?? '';
if (!legalPrompt.includes('HUMAN REVIEW REQUIRED')) fail('Jude assembled prompt missing shared disclaimer');
const execute = read('app/api/execute-task/route.ts');
if (!execute.includes('enforceHighStakesDisclaimer') || !execute.includes('preserve it exactly')) fail('execute-task disclaimer enforcement/refine guard missing');
const knoxChat = read('lib/workers/chat-baseline.ts');
if (!knoxChat.includes('brief 3-4 sentence assessment OK only if it starts with the HUMAN REVIEW REQUIRED disclaimer')) fail('Knox chat disclaimer guard missing');

for (const [slug, expected] of [['product-naming-specialist',4], ['technical-writer',3], ['video-repurposer',3]] as const) {
  const paid = worker(slug).workerModes?.filter(m => (m.credits ?? 0) > 0 && m.badge === 'pro').length ?? 0;
  if (paid < expected) fail(`${slug} paid pro badges missing`);
}

const jarvis = read('app/api/jarvis/route.ts');
if (!jarvis.includes('Mack (Presentation Builder) — real PPTX files. 3 credits.')) fail('Jarvis Mack credit fact stale');
if (!jarvis.includes('ALL 78 ACTIVE TEAM MEMBERS') || !jarvis.includes('Design & Creative (9)') || !jarvis.includes('Social Media (6)')) fail('Jarvis counts stale');
if (jarvis.includes('Darcy (Ad Creative Generator) — describe your ad concept, pick a platform. 5 credits. Pro+. Tala')) fail('Darcy duplicate Tala sentence remains');
if (jarvis.includes('Kai builds an SEO brief → Sam writes the article')) fail('workflow example still routes Sam to articles');

const chat = read('lib/workers/chat-baseline.ts');
if (!chat.includes('Peyton builds Instagram strategies with 2026 algorithm discipline. Single mode, 1cr, Pro.')) fail('Peyton chat fact stale');
if (!chat.includes('Lyra builds Pinterest strategies with 2026 algorithm discipline. Single mode, 1 credit (Pro).')) fail('Lyra chat fact stale');
if (chat.includes('customer-review-responder')) fail('Nash customer-review-responder protocol remains');

const executeTask = read('app/api/execute-task/route.ts');
for (const term of ['appendContextPrompt(`You are Mack', 'const blairSystemPrompt = appendContextPrompt', "injectSharedPromptRules('website-builder'", 'system: appendContextPrompt(workerConfig.systemPrompt', 'system: appendContextPrompt(siteAuditorSystemPrompt', 'system: appendContextPrompt(workerConf.systemPrompt']) {
  if (!executeTask.includes(term)) fail(`brand bypass fix missing: ${term}`);
}
for (const p of ['app/api/website-builder/add-section/route.ts','app/api/website-builder/refine-section/route.ts']) {
  if (!read(p).includes("injectSharedPromptRules('website-builder', SILAS_SYSTEM_PROMPT)")) fail(`${p} missing shared prompt rules`);
}

for (const p of ['lib/workers/newsletter-writer/prompt.ts','lib/workers/landing-page-copywriter/prompt.ts','lib/workers/interview-question-writer/prompt.ts']) {
  const text = read(p);
  if (/append the handoff section|handoff CTA block/.test(text)) fail(`${p} still requires handoff output`);
}
const promptEngineer = read('lib/workers/prompt-engineer/prompt.ts');
if (/Suggested Next Steps \(Handoffs\)|Suggested handoffs to other 3rdShift workers/.test(promptEngineer)) fail('Pete prompt still requires handoff section');

const silas = injectSharedPromptRules('website-builder', 'SILAS');
if (!silas.includes('WRITING STYLE RULES') || !silas.includes('Do not include handoff sections')) fail('injectSharedPromptRules missing STYLE_RULES');

console.log('prompt-quality fix batch source checks passed');
