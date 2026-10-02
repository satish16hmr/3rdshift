import { getWorkerFormConfig, getWorkerPromptConfig } from '@/lib/workers/configs';

const SOURCE_FIELD_CANDIDATES = [
  'original_content',
  'source_content',
  'source_text',
  'pasted_content',
  'pasted_data',
  'content',
  'article_text',
  'blog_post',
  'transcript',
  'brief',
  'description',
  'topic',
];

const TITLE_FIELD_CANDIDATES = ['source_title', 'title', 'topic'];

function flattenWorkerFields(workerId: string) {
  const formConfig = getWorkerFormConfig(workerId);
  return formConfig?.sections.flatMap((section) => section.fields) ?? [];
}

export function buildChatChainStepPrompt(params: {
  workerId: string;
  sourceText: string;
  isFirstStep: boolean;
}): string | null {
  const { workerId, sourceText, isFirstStep } = params;
  const promptConfig = getWorkerPromptConfig(workerId);
  if (!promptConfig) return null;

  const fields = flattenWorkerFields(workerId);
  const input: Record<string, string> = {};

  for (const field of fields) {
    if (typeof field.defaultValue === 'string') input[field.name] = field.defaultValue;
  }

  const trimmedSource = sourceText.trim();
  if (trimmedSource) {
    for (const fieldName of SOURCE_FIELD_CANDIDATES) {
      if (fields.some((field) => field.name === fieldName) && !input[fieldName]) {
        input[fieldName] = trimmedSource;
      }
    }

    for (const fieldName of TITLE_FIELD_CANDIDATES) {
      if (fields.some((field) => field.name === fieldName) && !input[fieldName]) {
        input[fieldName] = isFirstStep ? trimmedSource.slice(0, 160) : 'Output from previous chain step';
      }
    }
  }

  const builtPrompt = promptConfig.buildUserPrompt(input).trim();
  if (trimmedSource && !builtPrompt.includes(trimmedSource)) {
    const handoffLabel = isFirstStep ? 'Original chain request' : 'Source content from previous step';
    return `${handoffLabel}:\n\n${trimmedSource}\n\n---\n\n${builtPrompt || 'Complete your assigned task using the source content above.'}`;
  }

  return builtPrompt || (trimmedSource
    ? `${isFirstStep ? 'Original chain request' : 'Source content from previous step'}:\n\n${trimmedSource}`
    : 'Complete your assigned task.');
}
