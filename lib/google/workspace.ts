/**
 * Google Workspace Integration Helper
 * Handles OAuth token management and Drive/Docs/Sheets/Slides operations
 */

import { createClient } from '@supabase/supabase-js';
import { decryptToken, encryptToken } from '@/lib/crypto';
import { safeFetchExternal } from '@/lib/ssrf';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_URL = 'https://www.googleapis.com/drive/v3';
const GOOGLE_DOCS_URL = 'https://docs.googleapis.com/v1';
const GOOGLE_SHEETS_URL = 'https://sheets.googleapis.com/v4';
const GOOGLE_SLIDES_URL = 'https://slides.googleapis.com/v1';
const GOOGLE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Token management ──────────────────────────────────────────────────────

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const { data: tokenRow } = await supabaseAdmin
    .from('google_workspace_tokens')
    .select('access_token, refresh_token, token_expiry')
    .eq('user_id', userId)
    .single();

  if (!tokenRow) return null;

  // NI-H03 fix: decrypt tokens before use (encrypted by Phase 5 callback)
  const plainAccessToken = tokenRow.access_token
    ? await decryptToken(tokenRow.access_token).catch(() => null)
    : null;
  const plainRefreshToken = tokenRow.refresh_token
    ? await decryptToken(tokenRow.refresh_token).catch(() => null)
    : null;

  if (!plainRefreshToken) return null;

  // If access token is still valid (with 5-min buffer), return decrypted value
  const expiry = tokenRow.token_expiry ? new Date(tokenRow.token_expiry) : null;
  const now = new Date();
  if (expiry && expiry.getTime() - now.getTime() > 5 * 60 * 1000 && plainAccessToken) {
    return plainAccessToken;
  }

  // Refresh the token using decrypted refresh token
  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: plainRefreshToken, // decrypted
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();

    // Encrypt new access token before storing
    // Item 9 / P9-H02 fix: fail-closed — if encryption fails, throw rather than store plaintext
    // encryptToken() already fails closed (throws if TOKEN_ENCRYPTION_KEY missing)
    const newEncryptedToken = await encryptToken(data.access_token);

    await supabaseAdmin.from('google_workspace_tokens').update({
      access_token: newEncryptedToken,
      token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);

    return data.access_token; // return plaintext to caller
  } catch {
    return null;
  }
}

export async function isConnected(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('google_workspace_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .single();
  // Must have a real refresh token, not a pending state token
  return !!data && !!data.refresh_token && !data.refresh_token.startsWith('pending:');
}

// ── Folder management ─────────────────────────────────────────────────────

async function getOrCreate3rdShiftFolder(accessToken: string): Promise<string> {
  // Search for existing 3rdShift folder
  const searchRes = await fetch(
    `${GOOGLE_DRIVE_URL}/files?q=name='3rdShift' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) {
    return searchData.files[0].id;
  }

  // Create 3rdShift folder
  const createRes = await fetch(`${GOOGLE_DRIVE_URL}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '3rdShift', mimeType: 'application/vnd.google-apps.folder' }),
  });
  const folder = await createRes.json();
  return folder.id;
}

async function getOrCreateMemberSubfolder(accessToken: string, parentId: string, memberName: string): Promise<string> {
  const searchRes = await fetch(
    `${GOOGLE_DRIVE_URL}/files?q=name='${memberName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch(`${GOOGLE_DRIVE_URL}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: memberName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  const folder = await createRes.json();
  return folder.id;
}

// ── Save operations ───────────────────────────────────────────────────────

export interface SaveResult {
  url: string;
  fileId: string;
  fileName: string;
  type: 'doc' | 'sheet' | 'slides' | 'file';
}

type GoogleDocsRequest = Record<string, unknown>;

type InlineStyle = {
  start: number;
  end: number;
  bold?: boolean;
  italic?: boolean;
  link?: string;
};

type DocParagraph = {
  text: string;
  kind: 'paragraph' | 'heading' | 'bullet' | 'numbered' | 'divider';
  level?: 1 | 2 | 3;
  styles: InlineStyle[];
};

function shouldStripMetadataLine(line: string) {
  return /^\s*(?:[-*]\s*)?(?:\*\*)?\s*(?:meta description|slug|tags|keywords)\s*(?:\*\*)?\s*:/i.test(line);
}

function parseInlineMarkdown(value: string): { text: string; styles: InlineStyle[] } {
  let text = '';
  const styles: InlineStyle[] = [];
  let i = 0;

  const append = (segment: string, style?: Omit<InlineStyle, 'start' | 'end'>) => {
    const start = text.length;
    text += segment;
    const end = text.length;
    if (style && end > start) styles.push({ start, end, ...style });
  };

  while (i < value.length) {
    const rest = value.slice(i);
    const link = rest.match(/^\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/);
    if (link) {
      append(link[1], { link: link[2] });
      i += link[0].length;
      continue;
    }

    const bold = rest.match(/^\*\*([\s\S]+?)\*\*/);
    if (bold) {
      append(bold[1], { bold: true });
      i += bold[0].length;
      continue;
    }

    const italic = rest.match(/^(?:\*|_)([^*_]+?)(?:\*|_)/);
    if (italic) {
      append(italic[1], { italic: true });
      i += italic[0].length;
      continue;
    }

    append(value[i]);
    i += 1;
  }

  return { text, styles };
}

function markdownToDocParagraphs(markdown: string): DocParagraph[] {
  const paragraphs: DocParagraph[] = [];
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  let pending: string[] = [];

  const flushParagraph = () => {
    const raw = pending.join(' ').trim();
    pending = [];
    if (!raw) return;
    const parsed = parseInlineMarkdown(raw);
    paragraphs.push({ text: parsed.text, kind: 'paragraph', styles: parsed.styles });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || shouldStripMetadataLine(line)) {
      flushParagraph();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const parsed = parseInlineMarkdown(heading[2].trim());
      paragraphs.push({
        text: parsed.text,
        kind: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        styles: parsed.styles,
      });
      continue;
    }

    if (/^(?:---+|\*\*\*+|___+)$/.test(line)) {
      flushParagraph();
      paragraphs.push({ text: '', kind: 'divider', styles: [] });
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      const parsed = parseInlineMarkdown(bullet[1].trim());
      paragraphs.push({ text: parsed.text, kind: 'bullet', styles: parsed.styles });
      continue;
    }

    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      const parsed = parseInlineMarkdown(numbered[1].trim());
      paragraphs.push({ text: parsed.text, kind: 'numbered', styles: parsed.styles });
      continue;
    }

    pending.push(line);
  }

  flushParagraph();
  return paragraphs;
}

function buildGoogleDocRequests(content: string) {
  const paragraphs = markdownToDocParagraphs(content);
  const requests: GoogleDocsRequest[] = [];
  let text = '';
  let index = 1;

  for (const paragraph of paragraphs) {
    const start = index;
    const paragraphText = paragraph.kind === 'divider' ? '\n' : `${paragraph.text}\n`;
    text += paragraphText;
    index += paragraphText.length;
    const end = index;

    if (paragraph.kind === 'heading') {
      const namedStyleType = paragraph.level === 1 ? 'HEADING_1' : paragraph.level === 2 ? 'HEADING_2' : 'HEADING_3';
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end },
          paragraphStyle: { namedStyleType, spaceAbove: { magnitude: 12, unit: 'PT' }, spaceBelow: { magnitude: 6, unit: 'PT' } },
          fields: 'namedStyleType,spaceAbove,spaceBelow',
        },
      });
    }

    if (paragraph.kind === 'bullet' || paragraph.kind === 'numbered') {
      requests.push({
        createParagraphBullets: {
          range: { startIndex: start, endIndex: end },
          bulletPreset: paragraph.kind === 'numbered'
            ? 'NUMBERED_DECIMAL_ALPHA_ROMAN'
            : 'BULLET_DISC_CIRCLE_SQUARE',
        },
      });
    }

    if (paragraph.kind === 'divider') {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end },
          paragraphStyle: {
            borderBottom: {
              color: { color: { rgbColor: { red: 0.82, green: 0.82, blue: 0.86 } } },
              width: { magnitude: 1, unit: 'PT' },
              padding: { magnitude: 6, unit: 'PT' },
              dashStyle: 'SOLID',
            },
            spaceAbove: { magnitude: 6, unit: 'PT' },
            spaceBelow: { magnitude: 6, unit: 'PT' },
          },
          fields: 'borderBottom,spaceAbove,spaceBelow',
        },
      });
    }

    for (const style of paragraph.styles) {
      const range = { startIndex: start + style.start, endIndex: start + style.end };
      const textStyle: Record<string, unknown> = {};
      const fields: string[] = [];
      if (style.bold) {
        textStyle.bold = true;
        fields.push('bold');
      }
      if (style.italic) {
        textStyle.italic = true;
        fields.push('italic');
      }
      if (style.link) {
        textStyle.link = { url: style.link };
        fields.push('link');
      }
      if (fields.length) {
        requests.push({ updateTextStyle: { range, textStyle, fields: fields.join(',') } });
      }
    }
  }

  return { text, requests };
}

/**
 * Save text content as a Google Doc
 */
export async function saveAsGoogleDoc(
  accessToken: string,
  title: string,
  content: string,
  folderId: string
): Promise<SaveResult> {
  // Create blank Google Doc
  const createRes = await fetch(`${GOOGLE_DOCS_URL}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  const doc = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !doc.documentId) {
    throw new Error(doc.error?.message || 'Could not create Google Doc');
  }
  const docId = doc.documentId;
  const docContent = buildGoogleDocRequests(content);
  const batchRequests: GoogleDocsRequest[] = [];

  if (docContent.text) {
    batchRequests.push({
      insertText: {
        location: { index: 1 },
        text: docContent.text,
      },
    });
    batchRequests.push(...docContent.requests);
  }

  if (batchRequests.length > 0) {
    const updateRes = await fetch(`${GOOGLE_DOCS_URL}/documents/${docId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: batchRequests }),
    });
    if (!updateRes.ok) throw new Error('Could not format Google Doc');
  }

  // Move to folder
  const moveRes = await fetch(`${GOOGLE_DRIVE_URL}/files/${docId}?addParents=${folderId}&removeParents=root&fields=id,parents`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!moveRes.ok) throw new Error('Google Doc was created but could not be moved to the 3rdShift folder');

  return {
    url: `https://docs.google.com/document/d/${docId}/edit`,
    fileId: docId,
    fileName: title,
    type: 'doc',
  };
}

/**
 * Save CSV/tabular content as a Google Sheet
 */
export async function saveAsGoogleSheet(
  accessToken: string,
  title: string,
  csvContent: string,
  folderId: string
): Promise<SaveResult> {
  // Create spreadsheet
  const rows = csvContent.split('\n').map(row =>
    row.split(',').map(cell => ({ userEnteredValue: { stringValue: cell.trim().replace(/^"|"$/g, '') } }))
  );

  const createRes = await fetch(`${GOOGLE_SHEETS_URL}/spreadsheets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title },
      sheets: [{
        data: [{
          rowData: rows.map(r => ({ values: r }))
        }]
      }]
    }),
  });
  const sheet = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !sheet.spreadsheetId) {
    throw new Error(sheet.error?.message || 'Could not create Google Sheet');
  }
  const sheetId = sheet.spreadsheetId;

  // Move to folder
  const moveRes = await fetch(`${GOOGLE_DRIVE_URL}/files/${sheetId}?addParents=${folderId}&removeParents=root&fields=id,parents`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!moveRes.ok) throw new Error('Google Sheet was created but could not be moved to the 3rdShift folder');

  return {
    url: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
    fileId: sheetId,
    fileName: title,
    type: 'sheet',
  };
}

/**
 * Upload a file to Drive (images, PPTX, etc.)
 */
export async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  fileContent: Buffer | string,
  mimeType: string,
  folderId: string
): Promise<SaveResult> {
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const boundary = '-------314159265358979323846';
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const ending = `\r\n--${boundary}--`;

  const contentBuffer = typeof fileContent === 'string'
    ? Buffer.from(fileContent)
    : fileContent;
  const fullBody = Buffer.concat([Buffer.from(body), contentBuffer, Buffer.from(ending)]);

  const uploadRes = await fetch(`${GOOGLE_UPLOAD_URL}/files?uploadType=multipart&fields=id,name`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body: fullBody,
  });
  const file = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok || !file.id) {
    throw new Error(file.error?.message || 'Google Drive upload failed');
  }

  return {
    url: `https://drive.google.com/file/d/${file.id}/view`,
    fileId: file.id,
    fileName: fileName,
    type: 'file',
  };
}

/**
 * Main save function — routes to the right handler based on output type
 */
export async function saveToGoogle(params: {
  userId: string;
  memberSlug: string;
  memberName: string;
  title: string;
  output: Record<string, unknown>;
  workerSlug: string;
}): Promise<SaveResult> {
  const { userId, memberSlug, memberName, title, output, workerSlug } = params;

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) throw new Error('Google Workspace not connected');

  // Get/create folder structure: 3rdShift/MemberName/
  const rootFolderId = await getOrCreate3rdShiftFolder(accessToken);
  const memberFolderId = await getOrCreateMemberSubfolder(accessToken, rootFolderId, memberName);

  // Determine save type based on worker
  const csvWorkers = ['lead-generator', 'data-cleaner', 'bookkeeping-summarizer'];
  const sheetWorkers = ['spreadsheet-builder', 'data-analyst'];
  const imageWorkers = ['thumbnail-designer', 'logo-concept-generator', 'social-media-graphics-designer'];
  const pptxWorkers = ['pitch-deck-writer', 'presentation-builder'];

  const content = (output as Record<string, string>).content || (output as Record<string, string>).text || '';

  if (csvWorkers.includes(workerSlug) && content) {
    return saveAsGoogleSheet(accessToken, title, content, memberFolderId);
  }

  if (sheetWorkers.includes(workerSlug) && content) {
    return saveAsGoogleSheet(accessToken, title, content, memberFolderId);
  }

  // Video workers — upload MP4 directly to Drive
  const videoWorkers = ['product-video-creator', 'b-roll-generator', 'scene-director', 'ad-creative-generator'];
  if (videoWorkers.includes(workerSlug)) {
    const videoUrl = (output as Record<string, string>).video_url;
    const videoFilename = (output as Record<string, string>).video_filename || `${title}.mp4`;
    if (videoUrl) {
      // F3: safeFetchExternal validates URL, follows redirects safely, caps response at 500 MB
      const videoRes = await safeFetchExternal(videoUrl, {
        allowedContentTypes: ['video/*', 'application/octet-stream'],
        maxBytes: 500 * 1024 * 1024,
        timeoutMs: 120_000,
      });
      if (!videoRes.ok) throw new Error('Could not download video file for Drive upload');
      const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
      return uploadFileToDrive(accessToken, videoFilename, videoBuffer, 'video/mp4', memberFolderId);
    }
    throw new Error('No video URL found for this task');
  }

  // Audio workers — upload MP3 directly to Drive
  const audioWorkers = ['voiceover-artist', 'sound-effects-designer', 'content-translator'];
  if (audioWorkers.includes(workerSlug)) {
    const audioUrl = (output as Record<string, string>).audio_url;
    const audioFilename = (output as Record<string, string>).audio_filename || `${title}.mp3`;
    if (audioUrl) {
      // F3: safeFetchExternal validates URL, follows redirects safely, caps response at 100 MB
      const audioRes = await safeFetchExternal(audioUrl, {
        allowedContentTypes: ['audio/*', 'application/octet-stream'],
        maxBytes: 100 * 1024 * 1024,
        timeoutMs: 30_000,
      });
      if (!audioRes.ok) throw new Error('Could not download audio file for Drive upload');
      const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
      return uploadFileToDrive(accessToken, audioFilename, audioBuffer, 'audio/mpeg', memberFolderId);
    }
    throw new Error('No audio URL found for this task');
  }

  if (imageWorkers.includes(workerSlug)) {
    // Images stored as Drive files (URL-based)
    const images = (output as Record<string, unknown[]>).images as Array<{url: string}> || [];
    if (images.length > 0) {
      // Fetch and upload first image
      // F3: safeFetchExternal validates URL, follows redirects safely, caps response at 20 MB
      const imgRes = await safeFetchExternal(images[0].url, {
        allowedContentTypes: ['image/*'],
        maxBytes: 20 * 1024 * 1024,
      });
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
      return uploadFileToDrive(accessToken, `${title}.png`, imgBuffer, 'image/png', memberFolderId);
    }
  }

  // Default: save as Google Doc
  return saveAsGoogleDoc(accessToken, title, content, memberFolderId);
}
