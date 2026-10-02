/**
 * /api/report-pdf
 * Universal server-side PDF endpoint for all workers.
 * Converts markdown/HTML content → styled HTML → puppeteer PDF → direct file download.
 * No print dialog. Direct Content-Disposition: attachment response.
 * Previously only used for Bella (Bookkeeping Summarizer) and Brody (KPI Dashboard).
 * Now extended to all workers via the downloadPdf() client function.
 */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '@/lib/api-auth';
import { getWorkerBySlug } from '@/lib/workers/registry';
import { markdownToReportHtml } from '@/lib/report-pdf';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { userId, workspaceId } = auth;

  const { content, title = 'Deliverable Report', taskId, workerSlug: legacySlug, workerByline: legacyByline } = await request.json() as { content: string; title?: string; taskId?: string; workerSlug?: string; workerByline?: string };
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });

  let resolvedByline: string | undefined = legacyByline;
  let slug = legacySlug;

  // 1. If a specific single worker slug is provided (and not combined-report), prioritize worker persona
  if (!resolvedByline && slug && slug !== 'combined-report') {
    const worker = getWorkerBySlug(slug);
    if (worker) {
      const persona = worker.personaName || worker.name.split(' ')[0];
      resolvedByline = `${persona} · ${worker.name}`;
    }
  }

  // 2. If it's a combined report or no specific worker slug, build chain from runRow or tasks
  if (taskId) {
    const { data: runRow } = await supabaseAdmin
      .from('agent_mode_runs')
      .select('user_id, worker_results, agent_mode_chains(workers)')
      .eq('id', taskId)
      .maybeSingle();

    if (runRow) {
      const ownsRun = runRow.user_id === userId;
      if (!ownsRun) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      if (!resolvedByline) {
        const chainObj = Array.isArray(runRow.agent_mode_chains) ? runRow.agent_mode_chains[0] : runRow.agent_mode_chains;
        const rawWorkers = (runRow.worker_results as any[])?.length
          ? runRow.worker_results
          : ((chainObj as any)?.workers ?? []);

        const sortedWorkers = [...rawWorkers].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
        const chainPersonas = sortedWorkers
          .map((w: any) => {
            const slugId = w.worker_id || w.slug;
            const meta = getWorkerBySlug(slugId);
            return meta?.personaName || slugId;
          })
          .filter(Boolean);

        if (chainPersonas.length > 0) {
          resolvedByline = chainPersonas.join(' → ');
        }
      }
    } else {
      // Try tasks table (for single worker tasks)
      const { data: taskRow } = await supabaseAdmin
        .from('tasks')
        .select('worker_slug, user_id, workspace_id')
        .eq('id', taskId)
        .maybeSingle();

      if (taskRow) {
        const ownsTask = taskRow.user_id === userId ||
          (taskRow.workspace_id && taskRow.workspace_id === workspaceId);
        if (!ownsTask) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
        if (taskRow.worker_slug) {
          slug = taskRow.worker_slug;
          const worker = getWorkerBySlug(taskRow.worker_slug);
          if (worker) {
            const persona = worker.personaName || worker.name.split(' ')[0];
            resolvedByline = `${persona} · ${worker.name}`;
          }
        }
      }
    }
  }

  // 3. Fallback: Parse section headers in combined report content (e.g. ## Blair — Pitch Deck Writer)
  if (!resolvedByline && (slug === 'combined-report' || title === 'Combined Report')) {
    const headerMatches = Array.from(content.matchAll(/^##\s+([A-Za-z0-9_-]+)\s+—/gm)).map(m => m[1]);
    if (headerMatches.length > 0) {
      const uniquePersonas = Array.from(new Set(headerMatches));
      resolvedByline = uniquePersonas.join(' → ');
    }
  }

  if (!resolvedByline) {
    if (slug === 'combined-report' || title === 'Combined Report') {
      resolvedByline = '3rdShift AI Team';
    } else {
      resolvedByline = '3rdShift AI Worker';
    }
  }

  const html = await markdownToReportHtml(content, title, resolvedByline);

  let browser: import('puppeteer-core').Browser;
  const isVercel = !!process.env.VERCEL;

  if (isVercel) {
    const chromium = (await import('@sparticuz/chromium-min')).default;
    const puppeteer = (await import('puppeteer-core')).default;
    const executablePath = await chromium.executablePath(
      'https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar'
    );
    browser = await puppeteer.launch({ args: chromium.args, executablePath, headless: true });
  } else {
    const puppeteer = (await import('puppeteer')).default;
    browser = await (puppeteer as any).launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }

  try {
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: ['domcontentloaded', 'networkidle0'], timeout: 10000 });
    } catch {
      await page.setContent(html, { waitUntil: 'domcontentloaded' }).catch(() => {});
    }
    await page.evaluateHandle('document.fonts.ready').catch(() => {});
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      margin: { top: '0.75in', bottom: '0.75in', left: '0.75in', right: '0.75in' },
      printBackground: true,
    });
    await browser.close();

    const pdfBytes = Buffer.from(pdfBuffer);
    // Build a clean filename from worker slug and taskId
    const safeSlug = (slug || 'document').replace(/[^a-z0-9-]/g, '-');
    const idPart = taskId ? `-${taskId.slice(0, 8)}` : '';
    const pdfFilename = `${safeSlug}${idPart}.pdf`;

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFilename}"`,
        'Content-Length': String(pdfBytes.length),
      },
    });
  } catch (err) {
    await browser.close().catch(() => {});
    console.error('[report-pdf]', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
