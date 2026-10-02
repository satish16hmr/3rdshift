import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { getWorkspaceOwnerPlan } from '@/lib/workspace';
import { decryptToken } from '@/lib/crypto';

// Convert markdown text to Notion block objects (simplified but solid)
function markdownToNotionBlocks(markdown: string): object[] {
  const lines = markdown.split('\n');
  const blocks: object[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Heading 1
    if (line.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: { rich_text: [{ type: 'text', text: { content: line.slice(2).trim() } }] },
      });
      continue;
    }

    // Heading 2
    if (line.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: [{ type: 'text', text: { content: line.slice(3).trim() } }] },
      });
      continue;
    }

    // Heading 3
    if (line.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: [{ type: 'text', text: { content: line.slice(4).trim() } }] },
      });
      continue;
    }

    // Bullet list
    if (line.match(/^[-*] /)) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: parseInlineMarkdown(line.slice(2).trim()) },
      });
      continue;
    }

    // Numbered list
    const numberedMatch = line.match(/^\d+\. (.+)/);
    if (numberedMatch) {
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: parseInlineMarkdown(numberedMatch[1]) },
      });
      continue;
    }

    // Code block (backtick fence — simplified, just grab content)
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        object: 'block',
        type: 'code',
        code: {
          rich_text: [{ type: 'text', text: { content: codeLines.join('\n') } }],
          language: 'plain text',
        },
      });
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      blocks.push({ object: 'block', type: 'divider', divider: {} });
      continue;
    }

    // Empty line → skip
    if (!line.trim()) continue;

    // Default: paragraph
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: parseInlineMarkdown(line) },
    });
  }

  return blocks;
}

// Parse inline markdown (bold, italic) into Notion rich_text array
function parseInlineMarkdown(text: string): object[] {
  const result: object[] = [];
  // Simple regex for **bold**, *italic*, plain
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      result.push({ type: 'text', text: { content: part.slice(2, -2) }, annotations: { bold: true } });
    } else if (part.startsWith('*') && part.endsWith('*')) {
      result.push({ type: 'text', text: { content: part.slice(1, -1) }, annotations: { italic: true } });
    } else if (part) {
      result.push({ type: 'text', text: { content: part } });
    }
  }
  return result.length ? result : [{ type: 'text', text: { content: text } }];
}

async function findDefaultNotionPage(notionToken: string): Promise<string | null> {
  const searchRes = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      filter: { value: 'page', property: 'object' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: 1,
    }),
  });
  const data = await searchRes.json().catch(() => ({}));
  if (!searchRes.ok) throw new Error(data.message || 'Could not load Notion pages.');
  return data.results?.[0]?.id || null;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  // Check Pro+ plan — workspace owner's plan
  const plan = await getWorkspaceOwnerPlan(workspaceId);
  if (plan === 'starter') {
    return NextResponse.json({ error: 'Notion integration requires a Pro plan or higher.', upgrade_required: true }, { status: 403 });
  }

  // Get Notion token
  const { data: tokenRow } = await supabaseAdmin
    .from('notion_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single();

  if (!tokenRow?.access_token || tokenRow.access_token.startsWith('pending:')) {
    return NextResponse.json({ error: 'Notion not connected.', not_connected: true }, { status: 403 });
  }

  let body: { taskId?: string; parent_page_id?: string; title?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { taskId, parent_page_id, title } = body;
  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }

  // Load task
  const { data: task } = await supabaseAdmin
    .from('tasks')
    .select('worker_slug, input, output, edited_output, status')
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .single();

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (task.status !== 'completed') return NextResponse.json({ error: 'Task not completed yet' }, { status: 400 });

  // Prefer edited_output; if it's HTML, strip tags back to markdown-friendly text
  const rawContent = task.edited_output || task.output?.text || '';
  const content = task.edited_output
    ? rawContent.replace(/<\/?(h[1-3]|p|li|ul|ol|br)[^>]*>/gi, (m: string) => {
        if (m.match(/<h1/i)) return '# '; if (m.match(/<h2/i)) return '## '; if (m.match(/<h3/i)) return '### ';
        if (m.match(/<li/i)) return '- '; if (m.match(/<br/i)) return '\n';
        if (m.match(/<\/[hpoul]/i)) return '\n'; return '';
      }).replace(/<[^>]+>/g, '').trim()
    : rawContent;
  const pageTitle = title || 'Untitled Deliverable';
  // Phase 5: decrypt token (handles enc: prefix and plaintext lazy-migration)
  const notionToken = await decryptToken(tokenRow.access_token);
  let parentPageId = parent_page_id;
  if (!parentPageId) {
    try {
      parentPageId = await findDefaultNotionPage(notionToken) || undefined;
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load Notion pages.' }, { status: 502 });
    }
    if (!parentPageId) {
      return NextResponse.json({ error: 'No Notion pages found. Share a Notion page with 3rdShift, then try again.' }, { status: 400 });
    }
  }

  // Convert markdown to Notion blocks
  const allBlocks = markdownToNotionBlocks(content);

  // Notion API limit: 100 blocks per request
  const firstBatch = allBlocks.slice(0, 100);
  const remaining = allBlocks.slice(100);

  // Create the page
  const createRes = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${notionToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { page_id: parentPageId },
      properties: {
        title: { title: [{ text: { content: pageTitle } }] },
      },
      children: firstBatch,
    }),
  });

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}));
    console.error('Notion page creation error:', errData);
    return NextResponse.json({ error: 'Failed to create Notion page. Check your Notion connection.' }, { status: 500 });
  }

  const pageData = await createRes.json();
  const pageId = pageData.id;
  const pageUrl = pageData.url;

  // Append remaining blocks in batches of 100
  for (let i = 0; i < remaining.length; i += 100) {
    const batch = remaining.slice(i, i + 100);
    const appendRes = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({ children: batch }),
    });
    if (!appendRes.ok) {
      const errData = await appendRes.json().catch(() => ({}));
      console.error('Notion block append error:', errData);
      return NextResponse.json({ error: errData.message || 'Notion page was created, but adding all content failed.' }, { status: 502 });
    }
  }

  return NextResponse.json({ success: true, page_url: pageUrl, page_id: pageId, parent_page_id: parentPageId });
}

// GET — list pages/databases the user has shared with the integration
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { data: tokenRow } = await supabaseAdmin
    .from('notion_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single();

  if (!tokenRow?.access_token || tokenRow.access_token.startsWith('pending:')) {
    return NextResponse.json({ error: 'Notion not connected.', not_connected: true }, { status: 403 });
  }

  // Phase 5: decrypt token for page search handler
  const notionSearchToken = await decryptToken(tokenRow.access_token);

  const searchRes = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${notionSearchToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      filter: { value: 'page', property: 'object' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: 50,
    }),
  });

  if (!searchRes.ok) {
    return NextResponse.json({ pages: [] });
  }

  const searchData = await searchRes.json();
  const pages = (searchData.results || []).map((p: any) => ({
    id: p.id,
    title: p.properties?.title?.title?.[0]?.text?.content
      || p.properties?.Name?.title?.[0]?.text?.content
      || 'Untitled',
    type: p.object,
  }));

  return NextResponse.json({ pages });
}
