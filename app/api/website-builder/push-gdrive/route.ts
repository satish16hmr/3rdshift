import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { getValidAccessToken, isConnected } from '@/lib/google/workspace';

const GOOGLE_DRIVE_URL = 'https://www.googleapis.com/drive/v3';
const GOOGLE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';

const PAGE_TYPE_LABELS: Record<string, string> = {
  landing: 'Landing Page',
  coming_soon: 'Coming Soon',
  lead_magnet: 'Lead Magnet',
  sales_page: 'Sales Page',
  service_business: 'Service Business',
};

// POST /api/website-builder/push-gdrive
// Saves the assembled website HTML to Google Drive.
// Creates: [businessName] Website/index.html + README.md
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  // Check Google Drive connection
  const connected = await isConnected(userId);
  if (!connected) {
    return NextResponse.json({ error: 'Google Drive not connected.', not_connected: true }, { status: 403 });
  }

  let body: { taskId?: string; assembledHtml?: string; businessName?: string; pageType?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // F9: require taskId — server-assemble HTML from task output, ignore body HTML
  const { taskId } = body;
  if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 });

  // Verify task ownership / workspace membership
  const { data: task } = await supabaseAdmin
    .from('tasks')
    .select('id, user_id, workspace_id, worker_slug, status, output, input')
    .eq('id', taskId)
    .maybeSingle();

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

  if (task.user_id !== userId) {
    if (task.workspace_id) {
      const { data: membership } = await supabaseAdmin
        .from('workspace_members').select('id')
        .eq('workspace_id', task.workspace_id).eq('user_id', userId).maybeSingle();
      if (!membership) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    } else {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
  }

  if (task.worker_slug !== 'website-builder') {
    return NextResponse.json({ error: 'Task is not a website-builder task' }, { status: 400 });
  }

  if (task.status !== 'completed') {
    return NextResponse.json({ error: 'Task must be completed before saving' }, { status: 400 });
  }

  // Server-assemble HTML from task output or body HTML
  const taskOutput = task.output as Record<string, unknown> | null;
  let assembledHtml = (taskOutput?.assembledHtml ?? taskOutput?.assembled_html ?? taskOutput?.html ?? body.assembledHtml ?? '') as string;

  if (!assembledHtml && taskOutput?.artifact) {
    const art = taskOutput.artifact as Record<string, unknown>;
    const sections = (art?.sections ?? {}) as Record<string, { order: number; html: string; css: string }>;
    const shared = (art?.shared ?? {}) as { head_html?: string; global_css?: string; global_js?: string; tailwind_cdn?: boolean };
    const sortedSections = Object.values(sections).sort((a, b) => a.order - b.order);
    const sectionsHtml = sortedSections.map(s => s.html || '').join('\n');
    const sectionsCss = sortedSections.map(s => s.css || '').filter(Boolean).join('\n');
    const tailwindTag = shared.tailwind_cdn !== false ? '<script src="https://cdn.tailwindcss.com"></script>' : '';
    assembledHtml = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n${tailwindTag}\n${shared.head_html || ''}\n<style>\n${shared.global_css || ''}\n${sectionsCss}\n</style>\n</head>\n<body>\n${sectionsHtml}\n<script>\n${shared.global_js || ''}\n</script>\n</body>\n</html>`;
  }

  if (!assembledHtml) return NextResponse.json({ error: 'No HTML found in task output' }, { status: 400 });

  const taskInput = task.input as Record<string, string> | null;
  const businessName = taskInput?.business_name || 'Website';
  const pageType = taskInput?.page_type || 'landing';

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return NextResponse.json({ error: 'Google Drive token expired. Reconnect in Settings → Integrations.' }, { status: 401 });
  }

  const folderName = `${businessName} Website (${PAGE_TYPE_LABELS[pageType] || 'Site'})`;

  // ── Create or find 3rdShift root folder ──────────────────────────────────
  async function getOrCreate3rdShiftFolder(): Promise<string> {
    const searchRes = await fetch(
      `${GOOGLE_DRIVE_URL}/files?q=${encodeURIComponent("name='3rdShift' and mimeType='application/vnd.google-apps.folder' and trashed=false")}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const searchData = await searchRes.json();
    if (searchData.files?.length > 0) return searchData.files[0].id;

    const createRes = await fetch(`${GOOGLE_DRIVE_URL}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '3rdShift', mimeType: 'application/vnd.google-apps.folder' }),
    });
    const folder = await createRes.json();
    return folder.id;
  }

  // ── Create website subfolder ──────────────────────────────────────────────
  async function createSubfolder(parentId: string, name: string): Promise<string> {
    const res = await fetch(`${GOOGLE_DRIVE_URL}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
    });
    const folder = await res.json();
    return folder.id;
  }

  // ── Upload file to folder ─────────────────────────────────────────────────
  async function uploadFile(folderId: string, fileName: string, content: string, mimeType: string): Promise<string> {
    const metadata = { name: fileName, parents: [folderId] };
    const metaBlob = JSON.stringify(metadata);
    const body = `--boundary\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaBlob}\r\n--boundary\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--boundary--`;
    const res = await fetch(`${GOOGLE_UPLOAD_URL}/files?uploadType=multipart`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'multipart/related; boundary=boundary' },
      body,
    });
    const file = await res.json();
    return file.id;
  }

  try {
    const rootFolderId = await getOrCreate3rdShiftFolder();
    const websiteFolderId = await createSubfolder(rootFolderId, folderName);

    // Build README
    const readme = `# ${businessName} — ${PAGE_TYPE_LABELS[pageType] || 'Website'}
Generated by Silas (Website Builder) on 3rdShift — https://3rdshift.ai

## Files
- index.html — Complete, ready-to-publish HTML page

## Deploy Options

### Netlify Drop (fastest, free)
1. Go to https://app.netlify.com/drop
2. Drag and drop index.html
3. Live in 30 seconds

### GitHub Pages (free)
1. Create a new repo, upload index.html
2. Settings → Pages → deploy from main branch

### Vercel (free)
1. Go to https://vercel.com/new, import your repo
2. Deploy

## Image Notes
Unsplash placeholders are free (https://unsplash.com/license).
Replace with your own brand assets before final publishing.

---
Built with 3rdShift — https://3rdshift.ai
`;

    // Upload files
    await uploadFile(websiteFolderId, 'index.html', assembledHtml, 'text/html');
    await uploadFile(websiteFolderId, 'README.md', readme, 'text/markdown');

    // Get folder URL
    const folderUrl = `https://drive.google.com/drive/folders/${websiteFolderId}`;

    return NextResponse.json({
      success: true,
      folder_url: folderUrl,
      folder_name: folderName,
      files_created: ['index.html', 'README.md'],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Drive upload failed';
    console.error('[Silas GDrive push]', msg);
    return NextResponse.json({ error: 'Google Drive upload failed. Please try again.' }, { status: 500 });
  }
}
