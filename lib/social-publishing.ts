import { decryptToken, encryptToken } from '@/lib/crypto';
import { marked } from 'marked';
import sharp from 'sharp';

export type SocialProvider = 'linkedin' | 'facebook' | 'instagram' | 'buffer';

export const META_GRAPH_VERSION = 'v21.0';

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai').trim();
}

export async function encryptNullable(value?: string | null) {
  return value ? encryptToken(value) : null;
}

export async function decryptStoredToken(value: string) {
  return decryptToken(value);
}

type PlainToken = {
  type?: string;
  raw?: string;
  text?: string;
  href?: string;
  tokens?: PlainToken[];
  items?: PlainToken[];
  ordered?: boolean;
  header?: PlainToken[];
  rows?: PlainToken[][];
};

type TaskLike = {
  edited_output?: unknown;
  output?: {
    text?: unknown;
    content?: unknown;
    images?: unknown[];
    image_url?: unknown;
    imageUrl?: unknown;
  } | null;
};

type StorageClient = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: ArrayBuffer,
        options: { contentType: string; upsert: boolean }
      ) => Promise<{ error: unknown }>;
      createSignedUrl: (
        path: string,
        expiresIn: number
      ) => Promise<{ data: { signedUrl?: string } | null; error: unknown }>;
    };
  };
};

function normalizePlainText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function stripSocialMetadataLines(value: string) {
  return value
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:[-*]\s*)?(?:\*\*)?\s*(?:meta description|slug|tags|keywords)\s*(?:\*\*)?\s*:/i.test(line))
    .join('\n');
}

function htmlToPlainText(html: string) {
  return normalizePlainText(stripSocialMetadataLines(html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|section|article|header|footer|h[1-6]|li|ul|ol|blockquote|pre|table|tr)\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")));
}

function inlineTokensToPlain(tokens: PlainToken[] = []): string {
  return tokens.map((token) => {
    if (token.tokens) return inlineTokensToPlain(token.tokens);
    if (token.type === 'link') {
      const label = inlineTokensToPlain(token.tokens || []);
      return token.href && token.href !== label ? `${label} (${token.href})` : label;
    }
    if (token.type === 'image') return token.text || '';
    if (token.type === 'br') return '\n';
    return token.text || token.raw || '';
  }).join('');
}

function blockTokensToPlain(tokens: PlainToken[] = []): string {
  const blocks: string[] = [];
  for (const token of tokens) {
    if (token.type === 'space' || token.type === 'hr') continue;
    if (token.type === 'heading' || token.type === 'paragraph') {
      blocks.push(inlineTokensToPlain(token.tokens || []) || token.text || '');
    } else if (token.type === 'list') {
      const items = (token.items || []).map((item, index: number) => {
        const marker = token.ordered ? `${index + 1}.` : '-';
        const itemText = blockTokensToPlain(item.tokens || []).replace(/\n{2,}/g, '\n').trim();
        return `${marker} ${itemText}`;
      });
      blocks.push(items.join('\n'));
    } else if (token.type === 'blockquote') {
      blocks.push(blockTokensToPlain(token.tokens || []));
    } else if (token.type === 'code') {
      blocks.push(token.text || '');
    } else if (token.type === 'table') {
      const rows = [
        (token.header || []).map((cell) => inlineTokensToPlain(cell.tokens || []) || cell.text || '').join(' | '),
        ...(token.rows || []).map((row) => row.map((cell) => inlineTokensToPlain(cell.tokens || []) || cell.text || '').join(' | ')),
      ].filter(Boolean);
      blocks.push(rows.join('\n'));
    } else if (token.type === 'html') {
      blocks.push(htmlToPlainText(token.raw || token.text || ''));
    } else if (token.tokens) {
      blocks.push(blockTokensToPlain(token.tokens));
    } else if (token.text) {
      blocks.push(token.text);
    }
  }
  return normalizePlainText(blocks.filter(Boolean).join('\n\n'));
}

export function markdownToPlainText(markdown: string) {
  const source = stripSocialMetadataLines(String(markdown || '')).trim();
  if (!source) return '';
  if (/<\/?[a-z][\s\S]*>/i.test(source)) return htmlToPlainText(source);
  return blockTokensToPlain(marked.lexer(source) as PlainToken[]);
}

export function trimLinkedInText(text: string, max = 2900) {
  const plain = normalizePlainText(text);
  if (plain.length <= max) return { text: plain, trimmed: false };

  const draft = plain.slice(0, max);
  const searchStart = Math.max(0, draft.length - 200);
  const tail = draft.slice(searchStart);
  const sentenceMatches = [...tail.matchAll(/[.!?](?=\s|$)/g)];
  const lastSentence = sentenceMatches.at(-1);

  if (lastSentence?.index !== undefined) {
    return {
      text: draft.slice(0, searchStart + lastSentence.index + 1).trim(),
      trimmed: true,
    };
  }

  const lastSpace = draft.lastIndexOf(' ');
  return {
    text: draft.slice(0, lastSpace > 0 ? lastSpace : max).trim(),
    trimmed: true,
  };
}

export function linkedinPostText(task: TaskLike, max = 2900) {
  const raw = stringValue(task?.edited_output) || stringValue(task?.output?.text) || stringValue(task?.output?.content);
  return trimLinkedInText(markdownToPlainText(raw), max);
}

export function taskText(task: TaskLike, max = 2800) {
  const raw = stringValue(task?.edited_output) || stringValue(task?.output?.text) || stringValue(task?.output?.content);
  return markdownToPlainText(raw).slice(0, max).trim();
}

export function taskImageUrl(task: TaskLike) {
  const image = task?.output?.images?.[0];
  if (typeof image === 'string') return image;
  const imageObjectUrl = image && typeof image === 'object' && 'url' in image ? image.url : null;
  return typeof imageObjectUrl === 'string'
    ? imageObjectUrl
    : typeof task?.output?.image_url === 'string'
      ? task.output.image_url
      : typeof task?.output?.imageUrl === 'string'
        ? task.output.imageUrl
        : null;
}

export async function fetchImageWithoutMetadata(imageUrl: string) {
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) throw new Error('Could not fetch task image');

  const sourceBuffer = Buffer.from(await imageRes.arrayBuffer());
  const strippedBuffer = await sharp(sourceBuffer)
    .rotate()
    .png({ compressionLevel: 9 })
    .toBuffer();
  const bytes = strippedBuffer.buffer.slice(
    strippedBuffer.byteOffset,
    strippedBuffer.byteOffset + strippedBuffer.byteLength
  ) as ArrayBuffer;

  return {
    bytes,
    contentType: 'image/png',
  };
}

export async function strippedSocialImageSignedUrl(params: {
  supabase: StorageClient;
  imageUrl: string;
  taskId: string;
  provider: SocialProvider;
}) {
  const { supabase, imageUrl, taskId, provider } = params;
  const stripped = await fetchImageWithoutMetadata(imageUrl);
  const storagePath = `social-publish/${provider}/${taskId}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

  const { error: uploadError } = await supabase.storage
    .from('generated-images')
    .upload(storagePath, stripped.bytes, {
      contentType: stripped.contentType,
      upsert: false,
    });

  if (uploadError) throw new Error('Could not prepare image for social publishing');

  const { data: signed, error: signedError } = await supabase.storage
    .from('generated-images')
    .createSignedUrl(storagePath, 60 * 60);

  if (signedError || !signed?.signedUrl) throw new Error('Could not prepare image URL for social publishing');
  return signed.signedUrl;
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function appScopedState(userId: string, state: string) {
  return `${userId}:${state}`;
}
