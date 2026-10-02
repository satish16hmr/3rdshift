import { getWorkerFormConfig } from './configs';
import { getWorkerBySlug } from './registry';

const PLACEHOLDER_PATTERNS = [
  /^\[.*\]$/,
  /^\{.*\}$/,
  /^<.*>$/,
];

export interface MissingRequiredField {
  name: string;
  label: string;
  message: string;
}

export function isPlaceholderValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.includes('[STORAGE_PATH:') || trimmed.includes('[FILE:') || trimmed.includes('[FIELD:')) {
    return false;
  }
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 && !isPlaceholderValue(trimmed);
  }
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function isFieldVisible(
  showWhen: { field: string; value: string | string[] } | undefined,
  input: Record<string, unknown>,
  formConfig?: any
): boolean {
  if (!showWhen) return true;
  let currentValue = input[showWhen.field];
  if (currentValue === undefined && formConfig) {
    const fieldDef = formConfig.sections?.flatMap((s: any) => s.fields ?? []).find((f: any) => f.name === showWhen.field);
    if (fieldDef?.defaultValue !== undefined && (!fieldDef.showWhen || isFieldVisible(fieldDef.showWhen, input, formConfig))) {
      currentValue = fieldDef.defaultValue;
    }
  }
  const currentValueStr = currentValue === true ? 'true' : currentValue === false ? 'false' : (currentValue as string);
  if (Array.isArray(showWhen.value)) {
    return Array.isArray(currentValue)
      ? (currentValue as string[]).some((value) => showWhen.value.includes(value))
      : showWhen.value.includes(currentValueStr);
  }
  return currentValueStr === showWhen.value || currentValue === showWhen.value;
}

export function getDefaultWorkerMode(workerSlug: string): string | null {
  const workerDef = getWorkerBySlug(workerSlug);
  return workerDef?.workerModesDefault ?? workerDef?.workerModes?.[0]?.id ?? null;
}

export function applyDefaultWorkerMode(
  workerSlug: string,
  input: Record<string, unknown>
): Record<string, unknown> {
  const workerDef = getWorkerBySlug(workerSlug);
  if (!workerDef?.workerModeField || isPresent(input[workerDef.workerModeField])) {
    return input;
  }

  const defaultMode = getDefaultWorkerMode(workerSlug);
  if (!defaultMode) return input;

  return {
    ...input,
    [workerDef.workerModeField]: defaultMode,
  };
}

export function getMissingRequiredFields(
  workerSlug: string,
  input: Record<string, unknown>
): MissingRequiredField[] {
  const formConfig = getWorkerFormConfig(workerSlug);
  if (!formConfig) return [];

  const missing: MissingRequiredField[] = [];
  const workerDef = getWorkerBySlug(workerSlug);

  if (workerDef?.workerModeField && !isPresent(input[workerDef.workerModeField])) {
    missing.push({
      name: workerDef.workerModeField,
      label: 'Mode',
      message: 'Please select a mode.',
    });
  }

  for (const section of formConfig.sections) {
    for (const field of section.fields) {
      if (!field.required || field.type === 'file-upload') continue;
      if (!isFieldVisible(field.showWhen, input, formConfig)) continue;

      const hasValue = field.type === 'audio-upload'
        ? isPresent(input.audio_file_url) || isPresent(input.reference_video) || isPresent(input[field.name])
        : isPresent(input[field.name]);

      if (!hasValue) {
        missing.push({
          name: field.name,
          label: field.label ?? field.name,
          message: `"${field.label ?? field.name}" is required.`,
        });
      }
    }
  }

  return missing;
}
