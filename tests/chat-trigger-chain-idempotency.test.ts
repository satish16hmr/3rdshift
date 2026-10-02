// @ts-nocheck
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

async function importTriggerChainRoute() {
  const root = process.cwd();
  const tempDir = join(tmpdir(), `trigger-chain-route-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const routeDir = join(tempDir, 'app', 'api', 'chat', 'trigger-chain');
  const mocksDir = join(routeDir, 'mocks');
  await mkdir(mocksDir, { recursive: true });

  const routeSource = (await readFile(join(root, 'app', 'api', 'chat', 'trigger-chain', 'route.ts'), 'utf8'))
    .replace("import { NextRequest, NextResponse } from 'next/server';", "import { NextResponse } from './mocks/next-server.ts';")
    .replace("import { requireAuth, supabaseAdmin } from '@/lib/api-auth';", "import { requireAuth, supabaseAdmin } from './mocks/api-auth.ts';")
    .replace("import { requireWorkspaceRole } from '@/lib/auth/require-workspace-role';", "import { requireWorkspaceRole } from './mocks/require-workspace-role.ts';")
    .replace("import { getWorkspaceOwnerPlan } from '@/lib/workspace';", "import { getWorkspaceOwnerPlan } from './mocks/workspace.ts';")
    .replace("import { callAI } from '@/lib/ai/callAI';", "import { callAI } from './mocks/callAI.ts';")
    .replace("import { getWorkerBySlug } from '@/lib/workers/registry';", "import { getWorkerBySlug } from './mocks/registry.ts';")
    .replace("import { getWorkerPromptConfig } from '@/lib/workers/configs';", "import { getWorkerPromptConfig } from './mocks/configs.ts';")
    .replace("import { buildChatChainStepPrompt } from '@/lib/agent-mode/chat-chain-prompt';", "import { buildChatChainStepPrompt } from './mocks/chat-chain-prompt.ts';")
    .replace("import { getWorkerCreditCost } from '@/lib/agent-mode/types';", "import { getWorkerCreditCost } from './mocks/types.ts';")
    .replace("import { debitCredits, refundCredits } from '@/lib/credits/ledger';", "import { debitCredits, refundCredits } from './mocks/ledger.ts';");

  await writeFile(join(routeDir, 'route.ts'), routeSource);
  await writeFile(join(mocksDir, 'next-server.ts'), `
export class NextResponse {
  status: number;
  body: unknown;
  constructor(body: unknown, init: { status?: number } = {}) {
    this.body = body;
    this.status = init.status ?? 200;
  }
  static json(body: unknown, init: { status?: number } = {}) {
    return new NextResponse(body, init);
  }
}
`);
  await writeFile(join(mocksDir, 'api-auth.ts'), `
class Query {
  table: string;
  op: string;
  constructor(table: string, op = 'select') { this.table = table; this.op = op; }
  select() { return this; }
  eq() { return this; }
  update() { return this; }
  insert() { return this; }
  async single() {
    if (this.table === 'profiles') return { data: { brand_context: 'Brand context' }, error: null };
    if (this.table === 'tasks') return { data: { id: 'task-id' }, error: null };
    return { data: null, error: null };
  }
  then(resolve: any) { return Promise.resolve({ data: null, error: null }).then(resolve); }
}
export async function requireAuth() { return { userId: 'user-1', workspaceId: 'workspace-1' }; }
export const supabaseAdmin = { from(table: string) { return new Query(table); } };
`);
  await writeFile(join(mocksDir, 'require-workspace-role.ts'), `export async function requireWorkspaceRole() { return { ok: true }; }\n`);
  await writeFile(join(mocksDir, 'workspace.ts'), `export async function getWorkspaceOwnerPlan() { return 'operator'; }\n`);
  await writeFile(join(mocksDir, 'callAI.ts'), `export async function callAI() { return { content: 'step output' }; }\n`);
  await writeFile(join(mocksDir, 'registry.ts'), `
export function getWorkerBySlug(slug: string) {
  return { slug, active: true, personaName: slug, name: slug, category: 'Test' };
}
`);
  await writeFile(join(mocksDir, 'configs.ts'), `export function getWorkerPromptConfig() { return { systemPrompt: 'system' }; }\n`);
  await writeFile(join(mocksDir, 'chat-chain-prompt.ts'), `export function buildChatChainStepPrompt() { return 'user prompt'; }\n`);
  await writeFile(join(mocksDir, 'types.ts'), `export function getWorkerCreditCost() { return { light: 0, heavy: 1 }; }\n`);
  await writeFile(join(mocksDir, 'ledger.ts'), `
export const state = { seen: new Set<string>(), debitedAmount: 0, references: [] as string[] };
export async function debitCredits({ amount, referenceId }: { amount: number; referenceId: string }) {
  state.references.push(referenceId);
  if (!state.seen.has(referenceId)) {
    state.seen.add(referenceId);
    state.debitedAmount += amount;
  }
  return { ok: true };
}
export async function refundCredits() { return { ok: true }; }
`);

  const route = await import(pathToFileURL(join(routeDir, 'route.ts')).href);
  const ledger = await import(pathToFileURL(join(mocksDir, 'ledger.ts')).href);
  return { POST: route.POST, ledger };
}

function requestWithBody(body: unknown) {
  return { json: async () => JSON.parse(JSON.stringify(body)) };
}

test('retries of the same chat-trigger chain debit heavy credits once', async () => {
  const { POST, ledger } = await importTriggerChainRoute();
  const body = {
    member_id: 'seo-strategist',
    context: 'Retry-safe chain context',
    chain: [{ worker_id: 'seo-strategist' }],
  };

  const first = await POST(requestWithBody(body));
  const second = await POST(requestWithBody(body));

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(ledger.state.references.length, 2, 'retry should attempt the same reservation reference again');
  assert.equal(ledger.state.references[0], ledger.state.references[1], 'retry must reuse a deterministic debit reference');
  assert.equal(ledger.state.debitedAmount, 1, 'ledger idempotency should charge only the first reservation');
});
