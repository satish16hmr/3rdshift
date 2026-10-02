/**
 * lib/downloads/resume.ts
 * Beck (Career Coach) — DOCX generation + PDF trigger (via /api/resume-pdf).
 * Accepts content as markdown (original) OR HTML (user-edited Tiptap output).
 * Three templates: classic | modern | simple
 */

import {
  Document, Packer, Paragraph, TextRun, BorderStyle, AlignmentType,
  convertInchesToTwip,
} from 'docx';
import { getDownloadFilename } from './index';

export type ResumeTemplate = 'classic' | 'modern' | 'simple';

// ── Font + accent per template ─────────────────────────────────────────────
const TEMPLATE_FONTS: Record<ResumeTemplate, { body: string; heading: string }> = {
  classic: { body: 'Cambria', heading: 'Cambria' },
  modern:  { body: 'Calibri', heading: 'Calibri' },
  simple:  { body: 'Arial',   heading: 'Arial'   },
};
const TEMPLATE_ACCENTS: Record<ResumeTemplate, string> = {
  classic: '111111',
  modern:  '1D4ED8',
  simple:  '333333',
};
const TEMPLATE_RULE_COLORS: Record<ResumeTemplate, string> = {
  classic: '999999',
  modern:  '93C5FD',
  simple:  'CCCCCC',
};

// ── Markdown parser ────────────────────────────────────────────────────────
interface ResumeJob { title: string; company: string; dates: string; bullets: string[] }
interface ResumeSection { heading: string; body?: string; jobs?: ResumeJob[]; bullets?: string[]; lines?: string[] }
interface ParsedResume { name: string; contact: string; sections: ResumeSection[] }

function parseResumeMarkdown(md: string): ParsedResume {
  const lines = md.split('\n');
  let name = '', contact = '';
  const sections: ResumeSection[] = [];
  let cur: ResumeSection | null = null;
  let curJob: ResumeJob | null = null;

  const flushJob = () => {
    if (curJob && cur) { cur.jobs = cur.jobs || []; cur.jobs.push(curJob); curJob = null; }
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('# ')) { name = t.slice(2).trim(); continue; }
    if (t.startsWith('## ')) {
      flushJob();
      if (cur) sections.push(cur);
      cur = { heading: t.slice(3).trim() };
      continue;
    }
    if (!cur && (t.includes('|') || t.includes('@') || /\d{3}[-.)]\d{3}/.test(t))) {
      contact = t.replace(/\*\*/g, '');
      continue;
    }
    if (!cur) continue;

    const isTitleLine = t.startsWith('**') && (t.includes('|') || /\d{4}/.test(t));
    if (isTitleLine && cur.heading.toLowerCase().includes('experience')) {
      flushJob();
      const raw = t.replace(/\*\*/g, '');
      const parts = raw.split('|').map(p => p.trim());
      curJob = { title: parts[0] || '', company: parts[1] || '', dates: parts.slice(2).join(' ').trim(), bullets: [] };
      continue;
    }
    if (t.startsWith('- ') || t.startsWith('• ')) {
      const b = t.replace(/^[-•]\s*/, '').replace(/\*\*/g, '');
      if (curJob) curJob.bullets.push(b);
      else { cur.bullets = cur.bullets || []; cur.bullets.push(b); }
      continue;
    }
    flushJob();
    cur.lines = cur.lines || [];
    cur.lines.push(t.replace(/\*\*/g, ''));
  }
  flushJob();
  if (cur) sections.push(cur);
  return { name, contact, sections };
}

// ── HTML parser (Tiptap editor output) ────────────────────────────────────
// Strips HTML tags but preserves inline bold/italic for DOCX TextRuns.
interface InlineRun { text: string; bold?: boolean; italic?: boolean }

function parseInlineRuns(html: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const norm = html.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"');
  const re = /(<strong[^>]*>|<\/strong>|<em[^>]*>|<\/em>|<br\s*\/?>|<[^>]+>|[^<]+)/gi;
  let bold = false, italic = false;
  let m;
  while ((m = re.exec(norm)) !== null) {
    const t = m[1];
    if (!t) continue;
    if (/<strong/i.test(t))  { bold = true; continue; }
    if (/<\/strong/i.test(t)) { bold = false; continue; }
    if (/<em/i.test(t))      { italic = true; continue; }
    if (/<\/em/i.test(t))    { italic = false; continue; }
    if (/<br/i.test(t))      { runs.push({ text: '\n' }); continue; }
    if (/<[^>]+>/.test(t))   continue;
    if (t.trim()) runs.push({ text: t, bold, italic });
  }
  return runs;
}

function parseHtmlToResume(html: string): ParsedResume {
  // Extract block-level elements from Tiptap HTML
  const name = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]?.replace(/<[^>]+>/g, '').trim() || '';
  const sections: ResumeSection[] = [];

  // Find all h2 headings and collect content after each
  const h2re = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|$)/gi;
  let m;
  while ((m = h2re.exec(html)) !== null) {
    const heading = m[1].replace(/<[^>]+>/g, '').trim();
    const sectionHtml = m[2];
    const section: ResumeSection = { heading };

    // Extract paragraphs
    const paras: string[] = [];
    const pre = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let pm;
    while ((pm = pre.exec(sectionHtml)) !== null) {
      const text = pm[1].replace(/<[^>]+>/g, '').trim();
      if (text) paras.push(text);
    }

    // Extract list items
    const bullets: string[] = [];
    const lire = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let lm;
    while ((lm = lire.exec(sectionHtml)) !== null) {
      const text = lm[1].replace(/<[^>]+>/g, '').trim();
      if (text) bullets.push(text);
    }

    if (heading.toLowerCase().includes('summary') || heading.toLowerCase().includes('profile')) {
      section.body = paras.join(' ');
    } else if (heading.toLowerCase().includes('experience')) {
      // Each h3 is a job, paragraphs under it are title/meta, list items are bullets
      const jobs: ResumeJob[] = [];
      const jobRe = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|$)/gi;
      let jm;
      while ((jm = jobRe.exec(sectionHtml)) !== null) {
        const titleRaw = jm[1].replace(/<[^>]+>/g, '').trim();
        const jobHtml = jm[2];
        const parts = titleRaw.split('|').map(p => p.trim());
        const jobBullets: string[] = [];
        const jlre = /<li[^>]*>([\s\S]*?)<\/li>/gi;
        let jlm;
        while ((jlm = jlre.exec(jobHtml)) !== null) {
          const t = jlm[1].replace(/<[^>]+>/g, '').trim();
          if (t) jobBullets.push(t);
        }
        jobs.push({ title: parts[0] || '', company: parts[1] || '', dates: parts.slice(2).join(' ').trim(), bullets: jobBullets });
      }
      if (jobs.length > 0) section.jobs = jobs;
      else { section.bullets = bullets; }
    } else if (bullets.length > 0) {
      section.bullets = bullets;
    } else {
      section.lines = paras;
    }

    sections.push(section);
  }

  // Contact: first <p> after name that isn't inside an h2 section
  const contactMatch = html.match(/<h1[^>]*>[\s\S]*?<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  const contact = contactMatch ? contactMatch[1].replace(/<[^>]+>/g, '').trim() : '';

  return { name, contact, sections };
}

// ── DOCX builder ──────────────────────────────────────────────────────────
function buildDocxFromResume(resume: ParsedResume, template: ResumeTemplate): Paragraph[] {
  const font = TEMPLATE_FONTS[template];
  const accent = TEMPLATE_ACCENTS[template];
  const ruleColor = TEMPLATE_RULE_COLORS[template];
  const paragraphs: Paragraph[] = [];

  if (resume.name) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: resume.name, bold: true, size: 38, font: font.heading, color: '111111' })],
      spacing: { after: 60 },
    }));
  }
  if (resume.contact) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: resume.contact, size: 17, font: font.body, color: '666666' })],
      spacing: { after: 200 },
    }));
  }

  for (const section of resume.sections) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: section.heading.toUpperCase(), bold: true, size: 19, font: font.heading, color: accent, allCaps: true })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ruleColor, space: 4 } },
      spacing: { before: 240, after: 120 },
    }));

    if (section.body) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: section.body, size: 20, font: font.body, color: '333333' })],
        spacing: { after: 80 },
      }));
    }

    const isExp = section.heading.toLowerCase().includes('experience');
    if (isExp && section.jobs?.length) {
      for (const job of section.jobs) {
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({ text: job.title, bold: true, size: 21, font: font.body, color: '111111' }),
            job.company ? new TextRun({ text: `  ·  ${job.company}`, italics: true, size: 19, font: font.body, color: '555555' }) : new TextRun({ text: '' }),
            job.dates   ? new TextRun({ text: `  ·  ${job.dates}`,   italics: true, size: 19, font: font.body, color: '777777' }) : new TextRun({ text: '' }),
          ],
          spacing: { before: 120, after: 60 },
        }));
        for (const b of job.bullets) {
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text: b, size: 20, font: font.body, color: '333333' })],
            bullet: { level: 0 },
            indent: { left: 360, hanging: 260 },
            spacing: { after: 40 },
          }));
        }
      }
    } else {
      for (const b of section.bullets || []) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: b, size: 20, font: font.body, color: '333333' })],
          bullet: { level: 0 },
          indent: { left: 360, hanging: 260 },
          spacing: { after: 40 },
        }));
      }
      for (const line of section.lines || []) {
        const isBoldLine = line.includes('|') && !line.startsWith('http');
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: line, bold: isBoldLine, size: 20, font: font.body, color: '333333' })],
          spacing: { after: 60 },
        }));
      }
    }
  }

  return paragraphs;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Download Beck's resume as DOCX.
 * content: markdown (original) or HTML (editor-edited).
 * template: classic | modern | simple
 */
export async function downloadResumeDocx(
  content: string,
  taskId: string,
  template: ResumeTemplate = 'classic'
): Promise<void> {
  const isHtml = /^\s*<[a-zA-Z]/.test(content.trim());
  const resume = isHtml ? parseHtmlToResume(content) : parseResumeMarkdown(content);
  const paragraphs = buildDocxFromResume(resume, template);

  const margin = convertInchesToTwip(0.75);
  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: margin, bottom: margin, left: margin, right: margin } } },
      children: paragraphs,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getDownloadFilename('resume', taskId, 'docx');
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Download Beck's resume as PDF via /api/resume-pdf (server-side puppeteer).
 * content: markdown or HTML. template: classic | modern | simple
 */
export async function downloadResumePdf(
  content: string,
  taskId: string,
  template: ResumeTemplate = 'classic',
  authToken: string
): Promise<void> {
  const res = await fetch('/api/resume-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ content, template }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'PDF generation failed' })) as { error?: string };
    throw new Error(err?.error || 'PDF generation failed');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getDownloadFilename('resume', taskId, 'pdf');
  a.click();
  URL.revokeObjectURL(url);
}
