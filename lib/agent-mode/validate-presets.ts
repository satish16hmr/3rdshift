/**
 * lib/agent-mode/validate-presets.ts
 *
 * Agent Mode preset launch-blocker validator.
 *
 * Validates active Playbook presets against the current worker registry/form schemas.
 * This intentionally checks launch blockers only:
 * - non-existent worker slug
 * - form_settings field not present on that worker's schema
 * - invalid/missing worker mode for mode-priced workers
 * - heavy worker missing from the static Agent Mode cost table
 * - worker marked chainCompatible: false
 * - stored preset credit totals diverging from runtime cost calculation
 *
 * It does NOT fail on user-fillable required fields; those are allowed placeholders
 * and are handled by the Chain Builder before run/schedule.
 *
 * Usage:
 *   npx tsx lib/agent-mode/validate-presets.ts --source=db
 *   npx tsx lib/agent-mode/validate-presets.ts --source=migrations
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { workers as registry, type WorkerConfig, type WorkerModeDefinition } from '../workers/registry';
import { getWorkerFormConfig, type FormSection, type FormField } from '../workers/configs';
import { calcChainCostPerRun, HEAVY_WORKER_CREDITS, type WorkerInChain } from './types';

const workerBySlug = new Map(registry.map(w => [w.slug, w]));

interface PresetForValidation {
  id: string;
  name: string;
  workers: Array<{
    position?: number;
    step?: number;
    worker_id: string;
    form_settings?: Record<string, unknown>;
    config?: Record<string, unknown>;
  }>;
  heavy_credits_per_run?: number | null;
  light_tasks_per_run?: number | null;
}

interface ValidationIssue {
  preset_id: string;
  preset_name: string;
  step: number;
  worker_id: string;
  issue: string;
}

function getModeValues(slug: string): Set<string> {
  const w = workerBySlug.get(slug) as WorkerConfig | undefined;
  if (!w) return new Set();
  if (w.modeCredits) return new Set(Object.keys(w.modeCredits));
  if (w.workerModes) return new Set(w.workerModes.map((m: WorkerModeDefinition) => m.id).filter(Boolean));
  return new Set();
}

function isPlaceholderValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.includes('[STORAGE_PATH:') || trimmed.includes('[FILE:') || trimmed.includes('[FIELD:')) {
    return false;
  }
  return /^\[.*\]$/.test(trimmed) || /^\{.*\}$/.test(trimmed) || /^<.*>$/.test(trimmed);
}

function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function isConcreteValue(value: unknown): boolean {
  return isPresent(value) && !isPlaceholderValue(value);
}

function isConcreteModeValue(value: unknown): boolean {
  return isConcreteValue(value);
}

function getDefaultMode(slug: string): string | null {
  const w = workerBySlug.get(slug) as WorkerConfig | undefined;
  return w?.workerModesDefault ?? w?.workerModes?.[0]?.id ?? null;
}

export function validatePresets(presets: PresetForValidation[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const preset of presets) {
    const normalizedWorkers = (preset.workers ?? []).map((step, index) => ({
      ...step,
      position: step.position ?? step.step ?? index + 1,
      form_settings: step.form_settings ?? step.config ?? {},
    }));

    for (const step of normalizedWorkers) {
      const stepNum = step.position ?? 0;
      const slug = step.worker_id;
      const fsMap = step.form_settings ?? {};

      const w = workerBySlug.get(slug) as WorkerConfig | undefined;
      if (!w || !w.active) {
        issues.push({
          preset_id: preset.id,
          preset_name: preset.name,
          step: stepNum,
          worker_id: slug,
          issue: `Worker "${slug}" not found in active registry`,
        });
        continue;
      }

      if (w.chainCompatible === false) {
        issues.push({
          preset_id: preset.id,
          preset_name: preset.name,
          step: stepNum,
          worker_id: slug,
          issue: `Worker "${slug}" is marked chain-incompatible`,
        });
      }

      if (w.taskType === 'heavy' && !w.modeCredits && HEAVY_WORKER_CREDITS[slug] === undefined) {
        issues.push({
          preset_id: preset.id,
          preset_name: preset.name,
          step: stepNum,
          worker_id: slug,
          issue: `Heavy worker "${slug}" missing from HEAVY_WORKER_CREDITS`,
        });
      }

      const form = getWorkerFormConfig(slug);
      const formFields = new Set((form?.sections ?? []).flatMap((s: FormSection) => s.fields.map((f: FormField) => f.name)));
      const modeField = w.workerModeField ?? null;
      const modeValues = getModeValues(slug);

      for (const field of (form?.sections ?? []).flatMap((s: FormSection) => s.fields)) {
        if (!field.required || field.defaultValue === undefined) continue;
        if (!isConcreteValue(fsMap[field.name])) {
          issues.push({
            preset_id: preset.id,
            preset_name: preset.name,
            step: stepNum,
            worker_id: slug,
            issue: `Required default-backed field "${field.name}" is not explicitly saved in form_settings. Default should be ${JSON.stringify(field.defaultValue)}`,
          });
        }
      }

      if (modeField && !isConcreteModeValue(fsMap[modeField])) {
        issues.push({
          preset_id: preset.id,
          preset_name: preset.name,
          step: stepNum,
          worker_id: slug,
          issue: `Missing required mode field "${modeField}". Default should be "${getDefaultMode(slug) ?? 'first worker mode'}"`,
        });
      }

      for (const [key, val] of Object.entries(fsMap)) {
        if (key === modeField) {
          if (isConcreteModeValue(val) && modeValues.size > 0 && !modeValues.has(String(val))) {
            issues.push({
              preset_id: preset.id,
              preset_name: preset.name,
              step: stepNum,
              worker_id: slug,
              issue: `Mode field "${key}" has invalid value "${val}". Valid: [${[...modeValues].join(', ')}]`,
            });
          }
          continue;
        }

        if (!formFields.has(key)) {
          issues.push({
            preset_id: preset.id,
            preset_name: preset.name,
            step: stepNum,
            worker_id: slug,
            issue: `Field "${key}" does not exist in ${slug} formSchema`,
          });
        }
      }
    }

    if (preset.heavy_credits_per_run !== undefined && preset.light_tasks_per_run !== undefined) {
      try {
        const chainWorkers: WorkerInChain[] = normalizedWorkers.map((worker) => ({
          worker_id: worker.worker_id,
          position: worker.position ?? 0,
          form_settings: Object.fromEntries(
            Object.entries(worker.form_settings ?? {}).map(([key, value]) => [key, String(value ?? '')]),
          ),
        }));
        const actual = calcChainCostPerRun(chainWorkers, { requireMode: true });
        if (actual.heavy !== Number(preset.heavy_credits_per_run) || actual.light !== Number(preset.light_tasks_per_run)) {
          issues.push({
            preset_id: preset.id,
            preset_name: preset.name,
            step: 0,
            worker_id: '(preset)',
            issue: `Displayed cost ${preset.heavy_credits_per_run ?? 0}H/${preset.light_tasks_per_run ?? 0}L does not match actual ${actual.heavy}H/${actual.light}L`,
          });
        }
      } catch (err) {
        issues.push({
          preset_id: preset.id,
          preset_name: preset.name,
          step: 0,
          worker_id: '(preset)',
          issue: `Could not calculate actual cost: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  return issues;
}

function parseMigrationSeedPresets(): PresetForValidation[] {
  const seedPath = path.join(process.cwd(), 'supabase/migrations/20260702_agent_mode_seeded_preset_modes.sql');
  const sql = fs.readFileSync(seedPath, 'utf8');
  const regex = /--\s*([^\n(]+)\s*\([^\n]*\)[\s\S]*?workers\s*=\s*'([\s\S]*?)'::jsonb,[\s\S]*?heavy_credits_per_run\s*=\s*(\d+),[\s\S]*?light_tasks_per_run\s*=\s*(\d+)[\s\S]*?WHERE id = '([^']+)'/g;
  const presets: PresetForValidation[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql))) {
    presets.push({
      name: match[1].trim(),
      workers: JSON.parse(match[2]),
      heavy_credits_per_run: Number(match[3]),
      light_tasks_per_run: Number(match[4]),
      id: match[5],
    });
  }
  if (presets.length === 0) {
    throw new Error(`No seeded presets parsed from ${seedPath}`);
  }

  const disablePath = path.join(process.cwd(), 'supabase/migrations/20260713_disable_pipeline-only_presets.sql');
  if (!fs.existsSync(disablePath)) return presets;

  const disableSql = fs.readFileSync(disablePath, 'utf8');
  const disabledIds = new Set<string>();
  const disableMatch = /SET\s+is_active\s*=\s*false[\s\S]*?WHERE\s+id\s+IN\s*\(([\s\S]*?)\)/i.exec(disableSql);
  if (disableMatch) {
    for (const idMatch of disableMatch[1].matchAll(/'([^']+)'/g)) {
      disabledIds.add(idMatch[1]);
    }
  }

  return presets.filter(preset => !disabledIds.has(preset.id));
}

async function loadDbPresets(): Promise<PresetForValidation[]> {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local', quiet: true });
  dotenv.config({ quiet: true });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for --source=db');
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: presets, error } = await supabase
    .from('agent_mode_presets')
    .select('id, name, workers, heavy_credits_per_run, light_tasks_per_run')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`Failed to load presets: ${error.message}`);
  return presets ?? [];
}

function printResults(source: string, presets: PresetForValidation[], issues: ValidationIssue[]): void {
  console.log(`Validating ${presets.length} active presets from ${source} against current registry...\n`);

  if (issues.length === 0) {
    console.log('✅ All presets valid — 0 launch-blocker issue(s) found');
    return;
  }

  console.error(`❌ ${issues.length} launch-blocker issue(s) found:\n`);
  for (const issue of issues) {
    console.error(`  [${issue.preset_name}] Step ${issue.step} (${issue.worker_id}): ${issue.issue}`);
  }
}

async function main() {
  const sourceArg = process.argv.find(arg => arg.startsWith('--source='));
  const source = sourceArg?.split('=')[1] ?? 'db';

  const presets = source === 'migrations'
    ? parseMigrationSeedPresets()
    : await loadDbPresets();

  const issues = validatePresets(presets);
  printResults(source, presets, issues);
  process.exit(issues.length === 0 ? 0 : 1);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Validator crashed:', err);
    process.exit(1);
  });
}
