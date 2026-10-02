import { z } from 'zod';
import { getWorkerFormConfig } from './configs';
import { getMissingRequiredFields, isFieldVisible, isPresent } from './required-fields';

export interface ValidationResult {
  valid: true;
}

export interface ValidationFailure {
  valid: false;
  missing: string[];
  errors?: { field: string; message: string }[];
}

export type FieldValidationResult = ValidationResult | ValidationFailure;

export function validateRequiredFields(
  workerSlug: string,
  input: Record<string, unknown>
): FieldValidationResult {
  const formConfig = getWorkerFormConfig(workerSlug);

  // If no form config exists for this worker, skip validation — unknown workers
  // are rejected upstream by the registry check anyway.
  if (!formConfig) return { valid: true };

  const missingRequired = getMissingRequiredFields(workerSlug, input);
  const missing: string[] = missingRequired.map((field) => field.name);
  const errors: { field: string; message: string }[] = missingRequired.map((field) => ({
    field: field.name,
    message: field.message,
  }));
  const missingSet = new Set(missing);

  const visibleFields: any[] = [];

  for (const section of formConfig.sections) {
    for (const field of section.fields) {
      if (!isFieldVisible(field.showWhen, input)) continue;
      visibleFields.push(field);

      const val = input[field.name];

      // Determine if audio-upload has been uploaded (can be mapped to audio_file_url on frontend)
      let isUploadedAudio = false;
      if (field.type === 'audio-upload') {
        isUploadedAudio = isPresent(input['audio_file_url']) || isPresent(input['reference_video']) || isPresent(input[field.name]);
      }

      const hasValue = field.type === 'audio-upload' ? isUploadedAudio : isPresent(val);

      if (field.required && !hasValue) {
        if (!missingSet.has(field.name)) {
          missing.push(field.name);
          missingSet.add(field.name);
          errors.push({ field: field.name, message: `"${field.label}" is required.` });
        }
        continue;
      }

      // If value is present, run Zod schema validation
      if (isPresent(val)) {
        let schemaToValidate: z.ZodTypeAny | undefined = field.zodSchema;

        // Automatically build a schema for standard input types if no custom zodSchema is set
        if (!schemaToValidate) {
          if (field.type === 'url') {
            schemaToValidate = z.string().url('Must be a valid URL (including http:// or https://)');
          } else if (field.type === 'number') {
            schemaToValidate = z.preprocess(
              (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
              z.number({ message: 'Must be a valid number' })
            );
          }
        }

        if (schemaToValidate) {
          const parseResult = schemaToValidate.safeParse(val);
          if (!parseResult.success) {
            missing.push(field.name);
            const msg = parseResult.error.issues[0]?.message || `Invalid value for "${field.label}"`;
            errors.push({ field: field.name, message: msg });
          }
        }
      }
    }
  }

  // Ensure at least ONE visible user field has a value (prevents submitting completely empty forms)
  if (missing.length === 0 && visibleFields.length > 0) {
    const userFields = visibleFields.filter((f) => f.name !== 'mode' && f.name !== 'hiring_mode' && f.name !== 'script_mode' && f.name !== 'page_type' && f.name !== 'seo_mode' && f.name !== 'email_type' && f.name !== 'newsletter_style' && f.name !== 'outreach_mode');
    
    const hasAnyUserInput = userFields.some((f) => {
      const val = input[f.name];
      if (f.type === 'audio-upload') {
        return isPresent(input['audio_file_url']) || isPresent(input['reference_video']) || isPresent(input[f.name]);
      }
      if (f.type === 'select' && f.defaultValue && val === f.defaultValue) {
        return false;
      }
      return isPresent(val);
    });

    if (userFields.length > 0 && !hasAnyUserInput) {
      const targetField = userFields.find((f) => f.type === 'text' || f.type === 'textarea') || userFields[0];
      missing.push(targetField.name);
      errors.push({
        field: targetField.name,
        message: 'Please fill out at least one field before submitting.',
      });
    }
  }

  if (missing.length > 0) {
    return { valid: false, missing, errors };
  }

  return { valid: true };
}
