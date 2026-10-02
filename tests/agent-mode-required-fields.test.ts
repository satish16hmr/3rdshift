import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { validateRequiredFields } from '../lib/workers/validate-input';
import { getMissingRequiredFields, isPresent, applyDefaultWorkerMode } from '../lib/workers/required-fields';
import { getWorkerFormConfig } from '../lib/workers/configs';

interface SeededWorker {
  position?: number;
  step?: number;
  worker_id: string;
  form_settings?: Record<string, string>;
}

function parseSeededPresetWorkers(sql: string): Array<{ name: string; workers: SeededWorker[] }> {
  const blocks = [...sql.matchAll(/-- ([^\n]+)\nUPDATE agent_mode_presets[\s\S]*?workers = '(\[[\s\S]*?\])'::jsonb,[\s\S]*?WHERE id = '([^']+)'/g)];
  return blocks.map(([, comment, jsonText]) => ({
    name: comment.replace(/ \([^)]*\).*$/, '').replace(/ =>.*$/, '').trim(),
    workers: JSON.parse(jsonText) as SeededWorker[],
  }));
}

test('newsletter writer required fields are enforced from one shared source', () => {
  const input = {
    newsletter_style: 'classic_founder',
    newsletter_topic: 'Local authority launch plan',
    target_audience: 'Local service businesses',
    core_takeaway: 'Show up consistently in the local market',
  };

  const sharedMissing = getMissingRequiredFields('newsletter-writer', input).map(field => field.name);
  const serverValidation = validateRequiredFields('newsletter-writer', input);

  assert.deepEqual(sharedMissing, ['newsletter_length']);
  assert.equal(serverValidation.valid, false);
  assert.deepEqual(serverValidation.missing, ['newsletter_length']);
});

test('chat-generated deliverables apply worker mode defaults before shared validation', () => {
  const extractedInput = {
    newsletter_topic: 'Local authority launch plan',
    target_audience: 'Local service businesses',
    core_takeaway: 'Show up consistently in the local market',
    newsletter_length: 'Short',
  };

  const withoutDefault = validateRequiredFields('newsletter-writer', extractedInput);
  assert.equal(withoutDefault.valid, false);
  if (!withoutDefault.valid) assert.deepEqual(withoutDefault.missing, ['newsletter_style']);

  const withDefault = applyDefaultWorkerMode('newsletter-writer', extractedInput);
  assert.equal(withDefault.newsletter_style, 'classic_founder');
  assert.deepEqual(validateRequiredFields('newsletter-writer', withDefault), { valid: true });
});

test('chain config completion does not count form defaults as saved required values', async () => {
  const source = await readFile(
    join(process.cwd(), 'components/agent-mode/WorkerConfigPanel.tsx'),
    'utf8'
  );

  assert.match(source, /getMissingRequiredFields/);
  assert.doesNotMatch(source, /settings\[field\.name\]\s*\?\?\s*field\.defaultValue\s*\?\?\s*''/);
});

test('all seeded playbook required defaults are explicitly saved in form settings', async () => {
  const sql = await readFile(
    join(process.cwd(), 'supabase/migrations/20260702_agent_mode_seeded_preset_modes.sql'),
    'utf8'
  );
  const presets = parseSeededPresetWorkers(sql);
  const missingDefaultBackedFields: string[] = [];
  const validationFailuresAfterUserInputs: string[] = [];

  assert.equal(presets.length, 21);

  for (const preset of presets) {
    for (const worker of preset.workers) {
      const formSettings: Record<string, string> = { ...(worker.form_settings ?? {}) };
      const config = getWorkerFormConfig(worker.worker_id);
      const fields = config?.sections.flatMap(section => section.fields) ?? [];

      for (const field of fields) {
        if (!field.required || field.defaultValue === undefined) continue;
        if (!isPresent(formSettings[field.name])) {
          missingDefaultBackedFields.push(
            `${preset.name} step ${worker.position ?? worker.step} ${worker.worker_id}.${field.name}=${JSON.stringify(field.defaultValue)}`
          );
        }
      }

      // Simulate the user filling only the genuinely custom fields. Required
      // defaults should already be present in the seeded form_settings, so the
      // shared UI/server validator should pass without requiring the user to
      // touch those default-backed controls.
      const inputForValidation: Record<string, string> = { ...formSettings };
      let changed = true;
      while (changed) {
        changed = false;
        for (const missing of getMissingRequiredFields(worker.worker_id, inputForValidation)) {
          const field = fields.find(candidate => candidate.name === missing.name);
          if (field?.defaultValue !== undefined) continue;
          if (!isPresent(inputForValidation[missing.name])) {
            inputForValidation[missing.name] = 'Test user input';
            changed = true;
          }
        }
      }

      const missingAfterUserInputs = getMissingRequiredFields(worker.worker_id, inputForValidation);
      for (const missing of missingAfterUserInputs) {
        validationFailuresAfterUserInputs.push(
          `${preset.name} step ${worker.position ?? worker.step} ${worker.worker_id}.${missing.name}`
        );
      }
    }
  }

  assert.deepEqual(missingDefaultBackedFields, []);
  assert.deepEqual(validationFailuresAfterUserInputs, []);
});
