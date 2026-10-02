/**
 * /api/resume-pdf
 * Server-side PDF generation for Beck (Career Coach).
 * Uses puppeteer-core + @sparticuz/chromium-min for Vercel serverless.
 * Accepts: { content: string (markdown or HTML), template: 'classic'|'modern'|'simple' }
 * Returns: PDF bytes as application/pdf
 */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

// Template CSS definitions
const TEMPLATE_CSS: Record<string, string> = {
  classic: `
    body { font-family: 'Cambria', 'Georgia', 'Inter', 'Noto Sans', 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans KR', 'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Hebrew', 'Noto Sans Thai', serif; }
    .name { font-size: 19pt; font-weight: bold; color: #111; }
    .section-heading { color: #111; border-bottom: 0.75pt solid #999; }
    .job-title { font-weight: bold; color: #111; }
    .job-meta { color: #555; }
  `,
  modern: `
    body { font-family: 'Calibri', 'Arial', 'Inter', 'Noto Sans', 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans KR', 'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Hebrew', 'Noto Sans Thai', sans-serif; }
    .name { font-size: 22pt; font-weight: 700; color: #111; }
    .section-heading { color: #1d4ed8; border-bottom: 1pt solid #93c5fd; }
    .job-title { font-weight: 700; color: #111; }
    .job-meta { color: #555; }
  `,
  simple: `
    body { font-family: 'Arial', 'Helvetica', 'Inter', 'Noto Sans', 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans KR', 'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Hebrew', 'Noto Sans Thai', sans-serif; }
    .name { font-size: 19pt; font-weight: bold; color: #111; }
    .section-heading { color: #333; border-bottom: 0.5pt solid #ccc; }
    .job-title { font-weight: bold; color: #111; }
    .job-meta { color: #666; }
  `,
};

const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Noto+Sans:wght@400;700&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+SC:wght@400;700&family=Noto+Sans+TC:wght@400;700&family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+Arabic:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans+Thai:wght@400;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-size: 10.5pt;
    color: #111;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .name { margin-bottom: 3px; }
  .contact { font-size: 9pt; color: #555; margin-bottom: 14px; }
  .section-heading {
    font-size: 9.5pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    padding-bottom: 2px;
    margin: 13px 0 6px 0;
    page-break-after: avoid;
  }
  .job-header { margin: 9px 0 3px 0; page-break-after: avoid; }
  .job-title { font-size: 10.5pt; }
  .job-meta { font-style: italic; font-size: 9.5pt; }
  ul { padding-left: 17px; margin: 2px 0 8px 0; list-style-type: disc; }
  li { margin-bottom: 2px; font-size: 10.5pt; line-height: 1.4; }
  p { margin-bottom: 8px; font-size: 10.5pt; }
  .line { margin-bottom: 4px; font-size: 10.5pt; }
`;

// ── Parse Beck markdown → structured resume object ────────────────────────────
interface ResumeJob {
  title: string;
  company: string;
  dates: string;
  bullets: string[];
}

interface ResumeSection {
  heading: string;
  body?: string;
  jobs?: ResumeJob[];
  bullets?: string[];
  lines?: string[];
}

interface ParsedResume {
  name: string;
  contact: string;
  sections: ResumeSection[];
}

function parseResumeMarkdown(md: string): ParsedResume {
  const lines = md.split('\n');
  let name = '';
  let contact = '';
  const sections: ResumeSection[] = [];
  let currentSection: ResumeSection | null = null;
  let currentJob: ResumeJob | null = null;

  const flushJob = () => {
    if (currentJob && currentSection) {
      if (!currentSection.jobs) currentSection.jobs = [];
      currentSection.jobs.push(currentJob);
      currentJob = null;
    }
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;

    if (t.startsWith('# ')) { name = t.slice(2).trim(); continue; }
    if (t.startsWith('## ')) {
      flushJob();
      if (currentSection) sections.push(currentSection);
      currentSection = { heading: t.slice(3).trim() };
      continue;
    }

    // Contact line: before first section, has | or @ or phone
    if (!currentSection && (t.includes('|') || t.includes('@') || /\d{3}[-.)]\d{3}/.test(t))) {
      contact = t.replace(/\*\*/g, '');
      continue;
    }

    if (!currentSection) continue;

    // Bold job title lines: **Title | Company | Dates**
    const isTitleLine = t.startsWith('**') && (t.includes('|') || t.includes('–') || /\d{4}/.test(t));
    if (isTitleLine && currentSection.heading.toLowerCase().includes('experience')) {
      flushJob();
      const raw = t.replace(/\*\*/g, '');
      const parts = raw.split('|').map(p => p.trim());
      currentJob = { title: parts[0] || '', company: parts[1] || '', dates: parts.slice(2).join(' ').trim(), bullets: [] };
      continue;
    }

    // Bullets
    if (t.startsWith('- ') || t.startsWith('• ')) {
      const bullet = t.replace(/^[-•]\s*/, '').replace(/\*\*/g, '');
      if (currentJob) { currentJob.bullets.push(bullet); }
      else { if (!currentSection.bullets) currentSection.bullets = []; currentSection.bullets.push(bullet); }
      continue;
    }

    // Plain line
    flushJob();
    if (!currentSection.lines) currentSection.lines = [];
    currentSection.lines.push(t.replace(/\*\*/g, ''));
  }

  flushJob();
  if (currentSection) sections.push(currentSection);
  return { name, contact, sections };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function buildResumeHtml(content: string, template: string): Promise<string> {
  const css = TEMPLATE_CSS[template] || TEMPLATE_CSS.classic;

  // Detect if content is HTML (from Tiptap editor edits) or markdown
  const isHtml = /^\s*<[a-zA-Z]/.test(content.trim());

  let body = '';

  if (isHtml) {
    // H09 fix: sanitize HTML with DOMPurify before injecting into Puppeteer
    // Strips <script>, event handlers, external resources, and other XSS vectors
    const DOMPurify = (await import('isomorphic-dompurify')).default;
    const sanitized = DOMPurify.sanitize(content, {
      ALLOWED_TAGS: [
        'div', 'span', 'p', 'br', 'h1', 'h2', 'h3', 'h4',
        'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'a',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'hr', 'blockquote', 'pre', 'code',
      ],
      ALLOWED_ATTR: ['class', 'style', 'href'],
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'base'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'src', 'action', 'formaction'],
    });

    // Remap Tiptap heading/paragraph classes to resume classes
    body = sanitized
      .replace(/<h1[^>]*>/gi, '<div class="name">')
      .replace(/<\/h1>/gi, '</div>')
      .replace(/<h2[^>]*>/gi, '<div class="section-heading">')
      .replace(/<\/h2>/gi, '</div>')
      .replace(/<h3[^>]*>/gi, '<div class="job-header">')
      .replace(/<\/h3>/gi, '</div>')
      .replace(/<strong>/gi, '<span class="job-title">').replace(/<\/strong>/gi, '</span>')
      .replace(/<em>/gi, '<span class="job-meta">').replace(/<\/em>/gi, '</span>');
  } else {
    // Markdown → structured HTML
    const resume = parseResumeMarkdown(content);

    if (resume.name) body += `<div class="name">${esc(resume.name)}</div>\n`;
    if (resume.contact) body += `<div class="contact">${esc(resume.contact)}</div>\n`;

    for (const section of resume.sections) {
      body += `<div class="section-heading">${esc(section.heading)}</div>\n`;
      const isExp = section.heading.toLowerCase().includes('experience');

      if (section.body) {
        body += `<p>${esc(section.body)}</p>\n`;
      }

      if (isExp && section.jobs && section.jobs.length > 0) {
        for (const job of section.jobs) {
          body += `<div class="job-header">`;
          body += `<span class="job-title">${esc(job.title)}</span>`;
          if (job.company) body += ` <span class="job-meta"> · ${esc(job.company)}</span>`;
          if (job.dates) body += ` <span class="job-meta"> · ${esc(job.dates)}</span>`;
          body += `</div>\n`;
          if (job.bullets?.length) {
            body += `<ul>\n${job.bullets.map(b => `  <li>${esc(b)}</li>`).join('\n')}\n</ul>\n`;
          }
        }
      } else {
        if (section.bullets?.length) {
          body += `<ul>\n${section.bullets.map(b => `  <li>${esc(b)}</li>`).join('\n')}\n</ul>\n`;
        }
        if (section.lines?.length) {
          body += section.lines.map(l => `<div class="line">${esc(l)}</div>`).join('\n') + '\n';
        }
      }
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${BASE_CSS}
${css}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  // Auth check
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { content, template = 'classic' } = await request.json() as { content: string; template: string };

  if (!content) {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }

  const html = await buildResumeHtml(content, template);

  // Launch puppeteer with @sparticuz/chromium-min on Vercel, local puppeteer elsewhere
  let browser: import('puppeteer-core').Browser;

  const isVercel = !!process.env.VERCEL;

  if (isVercel) {
    const chromium = (await import('@sparticuz/chromium-min')).default;
    const puppeteer = (await import('puppeteer-core')).default;
    const executablePath = await chromium.executablePath(
      'https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar'
    );
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
  } else {
    // Local dev: use bundled puppeteer
    const puppeteer = (await import('puppeteer')).default;
    browser = await (puppeteer as any).launch({ headless: true });
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.evaluateHandle('document.fonts.ready');

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      margin: { top: '0.75in', bottom: '0.75in', left: '0.75in', right: '0.75in' },
      printBackground: true,
    });

    await browser.close();

    const pdfBytes = Buffer.from(pdfBuffer);
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="resume.pdf"`,
        'Content-Length': String(pdfBytes.length),
      },
    });
  } catch (err) {
    await browser.close().catch(() => {});
    console.error('[resume-pdf] error:', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
