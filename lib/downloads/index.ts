// lib/downloads/index.ts
export { downloadResumeDocx, downloadResumePdf } from './resume';
export type { ResumeTemplate } from './resume';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer, BorderStyle } from 'docx';
import jsPDF from 'jspdf';
import ExcelJS from 'exceljs';
import { marked } from 'marked';
import { getWorkerBySlug } from '@/lib/workers/registry';

// Convert markdown to HTML using marked with GFM (tables, strikethrough, etc.)
function markdownToHtml(md: string): string {
  marked.setOptions({ gfm: true, breaks: true } as object);
  return marked.parse(md) as string;
}

// Worker name lookup (for filename and footer)
export function getWorkerDisplayName(slug: string): string {
  const registryWorker = getWorkerBySlug(slug);
  if (registryWorker) return `${registryWorker.personaName} ${registryWorker.name}`;

  const names: Record<string, string> = {
    'content-writer': 'Ava Article Writer',
    'email-copywriter': 'Mira Email Copywriter',
    'hook-specialist': 'Sam Hook Specialist',
    'long-form-article-writer': 'Sam Hook Specialist', // legacy slug redirect
    'creative-editor': 'Remy Creative Editor',
    'script-writer': 'Jules Script Writer',
    'newsletter-writer': 'Oscar Newsletter Editor',
    'ad-copywriter': 'Tate Ad Copywriter',
    'landing-page-copywriter': 'Quinn Landing Page Copywriter',
    'grant-writer': 'Sage Grant Writer',
    'interview-question-writer': 'Dale Hiring Specialist',
    'business-plan-writer': 'Marlo Business Plan Architect',
    'case-study-writer': 'Thea Case Study Specialist',
    'whitepaper-writer': 'Naru Publications Specialist',
    'proposal-writer': 'Vera Proposal Manager',
    'technical-writer': 'Penn Ebook Architect',
    'standard-operating-procedure-writer': 'Flynn Operations Specialist',
    'job-description-writer': 'Eve Recruiting Specialist',
    'creative-brief-writer': 'Bree Creative Strategist',
    'resume-screener': 'Knox Resume Screener',
    // meeting-notes-summarizer (Macy) removed 2026-04-22
    'competitor-analyst': 'Zane Competitor Analyst',
    'trend-analyst': 'Jett Trend Analyst',
    'audience-persona-builder': 'Nora Audience Persona Builder',
    // 'swot-analyst' cut Brief 1C
    'market-research-analyst': 'Duncan Market Research Analyst',
    'pricing-strategist': 'Cruz Pricing Strategist',
    'content-strategist': 'Lane Content Strategist',
    'report-writer': 'Iris Report Strategist',
    'kpi-dashboard-writer': 'Brody Key Metrics Architect',
    'lead-generator': 'Lenny Lead Generator',
    'data-cleaner': 'Cade Data Cleaner',
    'bookkeeping-summarizer': 'Bella Bookkeeping Summarizer',
    'spreadsheet-builder': 'Sienna Spreadsheet Builder',
    'pitch-deck-writer': 'Blair Pitch Deck Writer',
    'automation-blueprint-writer': 'Wes Automation Specialist',
    'brand-voice-guide-writer': 'Ember Brand Voice Guide Writer', // legacy — deprecated Apr 24-25 2026
    'image-cleanup': 'Ember Image Cleanup',
    'podcast-show-notes-writer': 'Heath Podcast Specialist',
    'course-outline-builder': 'Charlie Course Architect',
    'content-repurposer': 'Holly Content Repurposer',
    'personal-brand-strategist': 'Silas Personal Brand Strategist', // legacy — deprecated Apr 25 2026
    'website-builder': 'Silas Website Builder',
    'video-repurposer': 'Vince Membership Architect',
    'ecommerce-strategist': 'Emma Ecommerce Strategist',
    // 'linkedin-profile-optimizer' cut Brief 1C
    'pinterest-strategist': 'Lyra Pinterest Strategist',
    'ad-campaign-strategist': 'Trey Ad Campaign Strategist',
    'sales-outreach-writer': 'Wilma Sales Outreach Specialist',
    'brand-strategist': 'Piper Brand Strategist',
    'translator': 'Nico Translator',
    'legal-document-drafter': 'Jude Legal Document Drafter',
    'cover-letter-writer': 'Cleo Cover Letter Writer', // deprecated — Beck (Career Coach) handles cover letters now
    'site-auditor': 'Nash Site Auditor',
    'customer-review-responder': 'Nash Customer Review Responder', // legacy slug
    'social-media-creator': 'Ash Short-Form Video Script Writer',
  };
  return names[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Filename generator
// Per-worker filename prefix overrides (cleaner names for users)
const FILENAME_PREFIXES: Record<string, string> = {
  'kpi-dashboard-writer': 'kpi-framework',
  'data-cleaner': 'data-cleaner',
  'customer-support-writer': 'support-templates',
};

export function getDownloadFilename(slug: string, taskId: string, ext: string): string {
  const prefix = FILENAME_PREFIXES[slug] ?? slug.substring(0, 20);
  const idPart = taskId.substring(0, 8);
  return `${prefix}-${idPart}.${ext}`;
}

// Detect if content is HTML
export function isHtmlContent(content: string): boolean {
  return /^\s*<[a-zA-Z]/.test(content.trim())
}

// Parse Tiptap HTML to the same block format used by docx/pdf generators
export function htmlToBlocks(html: string): Array<{ type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'blank'; text: string }> {
  const blocks: Array<{ type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'blank'; text: string }> = []

  // Strip inline formatting tags, keep text
  const stripInline = (s: string) =>
    s.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '$1')
      .replace(/<u[^>]*>(.*?)<\/u>/gi, '$1')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim()

  // Parse block-level tags in order
  const blockRe = /<(h[1-3]|p|li|ul|ol)([^>]*?)>([\s\S]*?)<\/\1>/gi
  let m
  while ((m = blockRe.exec(html)) !== null) {
    const tag = m[1].toLowerCase()
    const inner = stripInline(m[3])
    if (!inner) { blocks.push({ type: 'blank', text: '' }); continue }
    if (tag === 'h1') blocks.push({ type: 'h1', text: inner })
    else if (tag === 'h2') blocks.push({ type: 'h2', text: inner })
    else if (tag === 'h3') blocks.push({ type: 'h3', text: inner })
    else if (tag === 'li') blocks.push({ type: 'li', text: inner })
    else if (tag === 'p') {
      if (!inner) blocks.push({ type: 'blank', text: '' })
      else blocks.push({ type: 'p', text: inner })
    }
    // ul/ol container — individual <li> items are caught above
  }
  return blocks
}

// Parse markdown to plain text (strip **, ##, *, etc.)
export function markdownToPlain(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '')
    .trim();
}

// Parse markdown to structured blocks for DOCX/PDF
export function parseMarkdownBlocks(md: string): Array<{ type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'blank'; text: string }> {
  const lines = md.split('\n');
  const blocks: Array<{ type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'blank'; text: string }> = [];

  for (const line of lines) {
    if (line.match(/^# /)) blocks.push({ type: 'h1', text: line.replace(/^# /, '') });
    else if (line.match(/^## /)) blocks.push({ type: 'h2', text: line.replace(/^## /, '') });
    else if (line.match(/^### /)) blocks.push({ type: 'h3', text: line.replace(/^### /, '') });
    else if (line.match(/^\s*[-*+] /)) blocks.push({ type: 'li', text: line.replace(/^\s*[-*+] /, '') });
    else if (line.trim() === '') blocks.push({ type: 'blank', text: '' });
    else if (line.trim()) blocks.push({ type: 'p', text: line.trim() });
  }
  return blocks;
}

// ── HTML → DOCX with full inline formatting ──────────────────────────────────
// Walks Tiptap HTML and produces TextRuns that preserve bold/italic/underline.

interface RunSpec { text: string; bold?: boolean; italic?: boolean; underline?: boolean }

function parseInlineRuns(html: string): RunSpec[] {
  // Normalise entities first
  const norm = html
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"')

  const runs: RunSpec[] = []
  // Iterate through inline tokens: <strong>,<em>,<u>,<br>,text
  const tokenRe = /(<strong[^>]*>|<\/strong>|<em[^>]*>|<\/em>|<u[^>]*>|<\/u>|<br\s*\/?>|<[^>]+>|[^<]+)/gi
  let bold = false, italic = false, underline = false
  let m
  while ((m = tokenRe.exec(norm)) !== null) {
    const t = m[1]
    if (!t) continue
    if (/<strong/i.test(t)) { bold = true; continue }
    if (/<\/strong/i.test(t)) { bold = false; continue }
    if (/<em/i.test(t)) { italic = true; continue }
    if (/<\/em/i.test(t)) { italic = false; continue }
    if (/<u[^/]/i.test(t)) { underline = true; continue }
    if (/<\/u/i.test(t)) { underline = false; continue }
    if (/<br/i.test(t)) { runs.push({ text: '\n' }); continue }
    if (/<[^>]+>/.test(t)) continue // skip other tags
    const text = t
    if (text) runs.push({ text, bold, italic, underline })
  }
  return runs
}

function runsToTextRuns(runs: RunSpec[]): TextRun[] {
  return runs.map(r => new TextRun({
    text: r.text,
    bold: r.bold || false,
    italics: r.italic || false,
    underline: r.underline ? {} : undefined,
  }))
}

// Parse Tiptap/marked HTML into DOCX Paragraphs preserving inline formatting, tables, and hr
function htmlToDocxParagraphs(html: string): Paragraph[] {
  const children: Paragraph[] = []

  // Handle <hr> — convert to a bordered paragraph acting as a horizontal rule
  const withHr = html.replace(/<hr\s*\/?>/gi, '<p data-hr="1"></p>')

  // Handle <table> — render each row as a tab-separated paragraph
  const withTables = withHr.replace(
    /<table[^>]*>([\s\S]*?)<\/table>/gi,
    (_match: string, tableInner: string) => {
      const rows: string[] = []
      // Extract thead + tbody rows
      const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
      let rm
      let isHeader = true
      while ((rm = rowRe.exec(tableInner)) !== null) {
        const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi
        const cells: string[] = []
        let cm
        while ((cm = cellRe.exec(rm[1])) !== null) {
          cells.push(cm[1].replace(/<[^>]+>/g, '').trim())
        }
        if (cells.length) {
          rows.push(`<p data-table-row="${isHeader ? 'header' : 'data'}">${cells.join('\t')}</p>`)
          isHeader = false
        }
      }
      return rows.join('')
    }
  )

  // Flatten HTML: expand <ul>/<ol> by extracting their <li> children inline
  const flattenedHtml = withTables.replace(
    /<(ul|ol)[^>]*>([\s\S]*?)<\/\1>/gi,
    (_match: string, _tag: string, inner: string) => inner
  )

  const blockRe = /<(h[1-3]|p|li)([^>]*?)>([\s\S]*?)<\/\1>/gi
  let m
  while ((m = blockRe.exec(flattenedHtml)) !== null) {
    const tag = m[1].toLowerCase()
    const attrs = m[2]
    const inner = m[3]

    // Horizontal rule
    if (attrs.includes('data-hr')) {
      children.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } },
        spacing: { before: 120, after: 120 },
        children: [new TextRun({ text: '' })],
      }))
      continue
    }

    // Table row
    if (attrs.includes('data-table-row')) {
      const isHeader = attrs.includes('header')
      const cells = inner.split('\t')
      const runs: TextRun[] = []
      cells.forEach((cell, i) => {
        if (i > 0) runs.push(new TextRun({ text: '    ', bold: false }))
        runs.push(new TextRun({ text: cell, bold: isHeader }))
      })
      children.push(new Paragraph({ children: runs, indent: { left: isHeader ? 0 : 180 } }))
      continue
    }

    const runs = parseInlineRuns(inner)
    const textRuns = runsToTextRuns(runs)
    if (!textRuns.length) { children.push(new Paragraph({ text: '' })); continue }

    if (tag === 'h1') {
      children.push(new Paragraph({ children: textRuns, heading: HeadingLevel.HEADING_1 }))
    } else if (tag === 'h2') {
      children.push(new Paragraph({ children: textRuns, heading: HeadingLevel.HEADING_2 }))
    } else if (tag === 'h3') {
      children.push(new Paragraph({ children: textRuns, heading: HeadingLevel.HEADING_3 }))
    } else if (tag === 'li') {
      children.push(new Paragraph({ children: textRuns, indent: { left: 360 }, bullet: { level: 0 } }))
    } else {
      children.push(new Paragraph({ children: textRuns }))
    }
  }

  return children
}

// Download as DOCX
export async function downloadDocx(content: string, slug: string, taskId: string): Promise<void> {
  const workerName = getWorkerDisplayName(slug);
  let docxChildren: Paragraph[];

  // Always convert to HTML first — markdown path uses marked (handles tables, hr, GFM)
  const htmlContent = isHtmlContent(content) ? content : markdownToHtml(content);

  if (true) { // unified HTML path
    docxChildren = htmlToDocxParagraphs(htmlContent);
  } else {
    // Markdown path: parse blocks, handle **bold** inline (kept for reference, unreachable)
    const blocks = parseMarkdownBlocks(content);
    docxChildren = [];
    for (const block of blocks) {
      if (block.type === 'h1') {
        docxChildren.push(new Paragraph({ text: block.text, heading: HeadingLevel.HEADING_1 }));
      } else if (block.type === 'h2') {
        docxChildren.push(new Paragraph({ text: block.text, heading: HeadingLevel.HEADING_2 }));
      } else if (block.type === 'h3') {
        docxChildren.push(new Paragraph({ text: block.text, heading: HeadingLevel.HEADING_3 }));
      } else if (block.type === 'li') {
        // Render bullet with bold support inside li text
        const boldRegex = /\*\*(.+?)\*\*/g;
        const liRuns: TextRun[] = [new TextRun({ text: '• ' })];
        let lastIndex = 0;
        let match;
        while ((match = boldRegex.exec(block.text)) !== null) {
          if (match.index > lastIndex) liRuns.push(new TextRun({ text: block.text.slice(lastIndex, match.index) }));
          liRuns.push(new TextRun({ text: match[1], bold: true }));
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex < block.text.length) liRuns.push(new TextRun({ text: block.text.slice(lastIndex) }));
        docxChildren.push(new Paragraph({ children: liRuns, indent: { left: 360 } }));
      } else if (block.type === 'blank') {
        docxChildren.push(new Paragraph({ text: '' }));
      } else {
        const boldRegex = /\*\*(.+?)\*\*/g;
        const runs: TextRun[] = [];
        let lastIndex = 0;
        let match;
        while ((match = boldRegex.exec(block.text)) !== null) {
          if (match.index > lastIndex) runs.push(new TextRun({ text: block.text.slice(lastIndex, match.index) }));
          runs.push(new TextRun({ text: match[1], bold: true }));
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex < block.text.length) runs.push(new TextRun({ text: block.text.slice(lastIndex) }));
        docxChildren.push(new Paragraph({ children: runs.length ? runs : [new TextRun({ text: block.text })] }));
      }
    }
  }

  const doc = new Document({ sections: [{ children: docxChildren }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getDownloadFilename(slug, taskId, 'docx');
  a.click();
  URL.revokeObjectURL(url);
}

// Download as PDF
/**
 * downloadPdf — server-side PDF via /api/report-pdf
 * Returns a direct file download (no print dialog, no popup).
 * Content-Disposition: attachment — browser saves directly.
 */
export async function downloadPdf(content: string, slug: string, taskId: string): Promise<void> {
  const workerName = getWorkerDisplayName(slug);

  try {
    // Get the current session token for auth
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';

    const res = await fetch('/api/report-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ content, title: workerName, taskId, workerSlug: slug }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `PDF generation failed: ${res.status}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-${taskId?.slice(0, 8) || 'document'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[downloadPdf]', err);
    throw err; // Let the result page handle the error toast
  }

}


// Convert HTML content into clean markdown/text format for CSV & spreadsheet exports
export function htmlToCleanText(html: string): string {
  if (!isHtmlContent(html) && !/<[a-zA-Z][^>]*>/.test(html)) {
    return html;
  }
  return decodeHtmlEntities(
    html
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<hr\s*\/?>/gi, '\n---\n')
      .replace(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n## $1\n')
      .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
      .replace(/<div\b[^>]*>([\s\S]*?)<\/div>/gi, '\n$1\n')
      .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, '\n• $1\n')
      .replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, '\n$1\n')
      .replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
      .replace(/<b\b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
      .replace(/<em\b[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
      .replace(/<i\b[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
      .replace(/<[^>]+>/g, ' ')
  );
}

// Download as CSV (parse html/markdown tables or structured data)
export function downloadCsv(content: string, slug: string, taskId: string): void {
  let csvContent = '';

  // 1. If HTML table exists in content
  if (/<table\b[^>]*>/i.test(content)) {
    const htmlTableMatch = content.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i);
    if (htmlTableMatch) {
      const htmlRows = parseHtmlTable(htmlTableMatch[0]);
      if (htmlRows.length > 0) {
        csvContent = htmlRows
          .map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(','))
          .join('\n');
      }
    }
  }

  // 2. If Markdown table exists in content
  if (!csvContent) {
    const cleanContent = (isHtmlContent(content) || /<[a-zA-Z][^>]*>/.test(content)) ? htmlToCleanText(content) : content;
    const tableRegex = /\|(.+)\|[\r\n]+\|[-|: ]+\|[\r\n]+((?:\|.+\|[\r\n]*)+)/g;
    let match;
    while ((match = tableRegex.exec(cleanContent)) !== null) {
      const headerLine = match[1];
      const bodyLines = match[2];

      const headers = headerLine.split('|').map((h) => stripHtmlToText(markdownToPlain(h.trim()))).filter(Boolean);
      csvContent += headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',') + '\n';

      const rows = bodyLines.trim().split('\n');
      for (const row of rows) {
        const cells = row.split('|').map((c) => stripHtmlToText(markdownToPlain(c.trim()))).filter(Boolean);
        if (cells.length > 0) {
          csvContent += cells.map((c) => `"${c.replace(/"/g, '""')}"`).join(',') + '\n';
        }
      }
      csvContent += '\n';
    }
  }

  // 3. Fallback: convert plain text to single-column CSV without HTML tags
  if (!csvContent) {
    const cleanText = htmlToCleanText(content);
    const lines = cleanText
      .split('\n')
      .map((l) => stripHtmlToText(markdownToPlain(l)).trim())
      .filter(Boolean);
    csvContent = '"Content"\n' + lines.map((l) => `"${l.replace(/"/g, '""')}"`).join('\n');
  }

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getDownloadFilename(slug, taskId, 'csv');
  a.click();
  URL.revokeObjectURL(url);
}

// Parse a markdown table into rows of strings
function parseMarkdownTable(tableText: string): string[][] {
  const lines = tableText.trim().split('\n').filter((l) => l.trim().startsWith('|'));
  const rows: string[][] = [];
  for (const line of lines) {
    // Skip separator rows (| --- | --- |)
    if (/^\|[\s\-|:]+\|$/.test(line.trim())) continue;
    const cells = line.split('|').map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
    if (cells.length > 0) rows.push(cells.map(markdownToPlain));
  }
  return rows;
}

interface ParsedSheet {
  name: string;
  rows: Array<Array<string | number>>;
  headerRows: number[];
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );
}

function rowFromLine(text: string): string[] {
  const clean = markdownToPlain(stripHtmlToText(text)).replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim();
  if (!clean) return [];
  const pair = clean.match(/^([^:]{2,80}):\s+(.+)$/);
  if (pair) return [pair[1].trim(), pair[2].trim()];
  return [clean];
}

function parseHtmlTable(tableHtml: string): string[][] {
  const rows: string[][] = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(tableHtml)) !== null) {
    const cells: string[] = [];
    const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(stripHtmlToText(cellMatch[1]));
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function defaultSheetName(slug: string): string {
  if (slug === 'bookkeeping-summarizer') return 'Bookkeeping Summary';
  if (slug === 'kpi-dashboard-writer') return 'KPI Report';
  if (slug === 'spreadsheet-builder') return 'Spreadsheet';
  return 'Deliverable';
}

export function parseDeliverableToSheets(content: string, slug = 'deliverable'): ParsedSheet[] {
  const rows: Array<Array<string | number>> = [];
  const headerRows: number[] = [];
  const addHeading = (text: string) => {
    const clean = stripHtmlToText(text);
    if (!clean) return;
    rows.push([clean]);
    headerRows.push(rows.length);
  };
  const addRows = (newRows: string[][], headerFirst = false) => {
    for (const row of newRows) {
      if (!row.length) continue;
      rows.push(normalizeSheetRow(row));
      if (headerFirst && rows.length === rows.length - newRows.length + 1) headerRows.push(rows.length);
    }
  };

  if (isHtmlContent(content)) {
    const tokenRe = /<(h[1-3]|table|p|li)\b[^>]*>[\s\S]*?<\/\1>/gi;
    let match: RegExpExecArray | null;
    while ((match = tokenRe.exec(content)) !== null) {
      const tag = match[1].toLowerCase();
      const token = match[0];
      if (tag === 'table') {
        const tableRows = parseHtmlTable(token);
        const start = rows.length + 1;
        addRows(tableRows);
        if (tableRows.length) headerRows.push(start);
      } else if (/^h[1-3]$/.test(tag)) {
        addHeading(token);
      } else {
        const row = rowFromLine(token);
        if (row.length) rows.push(normalizeSheetRow(row));
      }
    }
  } else {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.trim()) continue;
      if (line.trim().startsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i]);
          i += 1;
        }
        i -= 1;
        const tableRows = parseMarkdownTable(tableLines.join('\n'));
        const start = rows.length + 1;
        addRows(tableRows);
        if (tableRows.length) headerRows.push(start);
        continue;
      }
      if (/^#{1,6}\s+/.test(line)) {
        addHeading(line.replace(/^#{1,6}\s+/, ''));
        continue;
      }
      if (/^\s*(?:[-*+] |\d+\.\s+)/.test(line)) {
        const row = rowFromLine(line);
        if (row.length) rows.push(normalizeSheetRow(row));
        continue;
      }
      const row = rowFromLine(line);
      if (row.length) rows.push(normalizeSheetRow(row));
    }
  }

  if (!rows.length) return [];
  return [{ name: defaultSheetName(slug), rows, headerRows: [...new Set(headerRows)] }];
}

function normalizeSheetRow(row: string[]): Array<string | number> {
  return row.map((cell) => rowToXlsxCells([cell])[0]?.v ?? cell);
}

function addParsedSheet(wb: ExcelJS.Workbook, sheet: ParsedSheet): void {
  addRowsSheet(wb, sheet.name, sheet.rows, { headerRows: sheet.headerRows });
}

// Convert a row of strings to XLSX cell values — detects formulas and numbers
function rowToXlsxCells(row: string[]): Array<{ v: string | number; t: string; f?: string }> {
  return row.map((cell) => {
    // Normalize: strip leading/trailing whitespace, replace Unicode minus/dashes with ASCII
    const trimmed = cell.trim()
      .replace(/\u2212/g, '-')   // Unicode minus sign → ASCII hyphen
      .replace(/\u2013/g, '-')   // en dash → ASCII hyphen
      .replace(/\u2014/g, '-');  // em dash → ASCII hyphen

    if (trimmed.startsWith('=')) {
      // Excel formula — store as formula cell, not text
      const formula = trimmed.slice(1);
      return { v: 0, t: 'n', f: formula };
    }

    // Try to parse as number — strip $, commas, spaces
    const cleaned = trimmed.replace(/[$,\s]/g, '');
    if (cleaned !== '' && !isNaN(Number(cleaned)) && cleaned !== '') {
      return { v: Number(cleaned), t: 'n' };
    }

    return { v: trimmed, t: 's' };
  });
}

function makeWorkbook(): ExcelJS.Workbook {
  return new ExcelJS.Workbook();
}

function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/*?:[\]]/g, ' ').trim() || 'Sheet';
  return cleaned.slice(0, 31);
}

function addRowsSheet(
  wb: ExcelJS.Workbook,
  name: string,
  rows: Array<Array<string | number>>,
  options: { header?: boolean; headerRows?: number[]; widths?: number[] } = {}
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(safeSheetName(name));
  ws.addRows(rows);

  const headerRows = new Set<number>(options.headerRows || (options.header ? [1] : []));
  for (const rowNumber of headerRows) {
    if (rowNumber < 1 || rowNumber > ws.rowCount) continue;
    const header = ws.getRow(rowNumber);
    header.font = { bold: true };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
  }

  if (options.widths) {
    ws.columns = options.widths.map(width => ({ width }));
  } else if (rows.length > 0) {
    const columnCount = Math.max(...rows.map(row => row.length));
    ws.columns = Array.from({ length: columnCount }, (_, index) => {
      const maxLen = Math.max(
        ...rows.map(row => String(row[index] ?? '').length),
        10
      );
      return { width: Math.min(Math.max(maxLen + 2, 10), 40) };
    });
  }

  return ws;
}

async function saveWorkbook(wb: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Download as XLSX (for Sienna - parse structured ## Sheet: Name + tables output)
export async function downloadXlsx(content: string, slug: string, taskId: string): Promise<void> {
  const wb = makeWorkbook();
  let sheetAdded = false;

  // Split content by ## Sheet: sections — manual split is most reliable
  const rawSections: Array<{ name: string; body: string }> = [];
  const parts = content.split(/^## Sheet:/m);
  for (const part of parts) {
    if (!part.trim()) continue;
    const firstNewline = part.indexOf('\n');
    if (firstNewline === -1) continue;
    const name = part.slice(0, firstNewline).trim();
    const body = part.slice(firstNewline + 1);
    if (name) rawSections.push({ name, body });
  }

  for (const { name: rawName, body: section } of rawSections) {
    const rawSheetName = safeSheetName(rawName);

    // Extract all pipe-delimited table lines from this section's body
    const tableLines = section.split('\n').filter((l) => l.trim().startsWith('|'));
    if (tableLines.length < 2) continue;

    const tableRows = parseMarkdownTable(tableLines.join('\n'));
    if (tableRows.length < 2) continue; // need at least header + 1 data row

    const [headerRow, ...dataRows] = tableRows;

    const ws = wb.addWorksheet(rawSheetName);
    const header = ws.addRow(headerRow);
    header.font = { bold: true };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };

    // Data rows
    dataRows.forEach((row) => {
      const added = ws.addRow([]);
      const xlsxCells = rowToXlsxCells(row);
      xlsxCells.forEach((cell, c) => {
        added.getCell(c + 1).value = cell.f
          ? { formula: cell.f, result: typeof cell.v === 'number' ? cell.v : 0 }
          : cell.v;
      });
    });

    // Set column widths (auto-size to ~max content)
    const colWidths = headerRow.map((h, c) => {
      const maxLen = Math.max(
        h.length,
        ...dataRows.map((r) => (r[c] || '').length)
      );
      return { width: Math.min(Math.max(maxLen + 2, 10), 40) };
    });

    ws.columns = colWidths;
    sheetAdded = true;
  }

  // If no ## Sheet: sections found, fall back to parsing any markdown tables
  if (!sheetAdded) {
    const tableRegex = /\|(.+)\|[\r\n]+\|[-|: ]+\|[\r\n]+((?:\|.+\|[\r\n]*)+)/g;
    let match;
    let sheetIndex = 1;

    while ((match = tableRegex.exec(content)) !== null) {
      const allRows = parseMarkdownTable(match[0]);
      if (allRows.length < 1) continue;
      addRowsSheet(wb, `Sheet ${sheetIndex++}`, allRows, { header: true });
      sheetAdded = true;
    }
  }

  // If no Sienna-style sections or markdown tables were found, parse the visible
  // deliverable (HTML or markdown) into spreadsheet rows instead of dumping raw
  // HTML/markdown into one cell.
  if (!sheetAdded) {
    const parsedSheets = parseDeliverableToSheets(content, slug);
    for (const sheet of parsedSheets) {
      addParsedSheet(wb, sheet);
      sheetAdded = true;
    }
  }

  // Absolute fallback — plain text lines only after structural parsing fails.
  if (!sheetAdded) {
    const lines = stripHtmlToText(content).split('\n').map((l) => [markdownToPlain(l)]);
    addRowsSheet(wb, 'Content', [['Content'], ...lines], { header: true });
  }

  // Append ## Notes section as a Notes sheet if present
  const notesMatch = content.match(/^## Notes\n([\s\S]*?)(?=^##|$)/m);
  if (notesMatch) {
    const notesLines = notesMatch[1].trim().split('\n').map((l) => [markdownToPlain(l)]);
    if (notesLines.length > 0) {
      addRowsSheet(wb, 'Notes', [['Notes'], ...notesLines], { header: true, widths: [80] });
    }
  }

  await saveWorkbook(wb, getDownloadFilename(slug, taskId, 'xlsx'));
}

// ---------------------------------------------------------------------------
// Brody (kpi-dashboard-writer): 4-tab metric tracker
// Primary: parse ```metric-data JSON block from model output
// Fallback: parse per-metric card tables (Field|Detail format)
// ---------------------------------------------------------------------------
interface BrodyMetric {
  name: string;
  definition: string;
  formula: string;
  dataSource: string;
  frequency: string;
  target: string;
}
interface BrodyMetricData {
  northStar: BrodyMetric[];
  inputMetrics: BrodyMetric[];
  outputMetrics: BrodyMetric[];
  guardrailMetrics: BrodyMetric[];
}

export async function downloadBrodyXlsx(content: string, taskId: string, preloadedMetricData?: BrodyMetricData | null): Promise<void> {
  const wb = makeWorkbook();
  const TRACKER_HEADERS = ['Metric Name', 'Definition', 'Formula', 'Data Source', 'Frequency', 'Target', 'Current', 'Owner'];

  function addSheet(name: string, metrics: BrodyMetric[]): void {
    const dataRows = metrics.map(m => [
      m.name || '',
      m.definition || '',
      m.formula || '',
      m.dataSource || '',
      m.frequency || '',
      m.target || '',
      '', // Current — user fills in
      '', // Owner — user fills in
    ]);
    const allRows = [TRACKER_HEADERS, ...dataRows];
    addRowsSheet(wb, name, allRows, {
      header: true,
      widths: [30, 45, 40, 25, 12, 20, 12, 15],
    });
  }

  // PRIMARY: use pre-parsed metricData from task output (stored server-side, never shown to user)
  const metricSource = preloadedMetricData ?? (() => {
    const jsonMatch = content.match(/```metric-data\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[1].trim()) as BrodyMetricData; } catch { return null; }
    }
    return null;
  })();

  if (metricSource) {
    addSheet('North Star', metricSource.northStar || []);
    addSheet('Input Metrics', metricSource.inputMetrics || []);
    addSheet('Output Metrics', metricSource.outputMetrics || []);
    addSheet('Guardrail Metrics', metricSource.guardrailMetrics || []);
    await saveWorkbook(wb, getDownloadFilename('kpi-dashboard-writer', taskId, 'xlsx'));
    return;
  }

  // FALLBACK: parse the visible deliverable into real spreadsheet rows. Older
  // tasks may not have the hidden metric-data JSON, but they still have headings,
  // bullets, and/or HTML/markdown tables that should not export as empty tabs.
  const parsedSheets = parseDeliverableToSheets(content, 'kpi-dashboard-writer');
  if (parsedSheets.length) {
    for (const sheet of parsedSheets) addParsedSheet(wb, sheet);
    await saveWorkbook(wb, getDownloadFilename('kpi-dashboard-writer', taskId, 'xlsx'));
    return;
  }

  // Last-resort empty tracker only when there is truly no parseable content.
  addSheet('North Star', []);
  addSheet('Input Metrics', []);
  addSheet('Output Metrics', []);
  addSheet('Guardrail Metrics', []);
  await saveWorkbook(wb, getDownloadFilename('kpi-dashboard-writer', taskId, 'xlsx'));
}

// Download as PPTX (for Blair - parse slide content blocks)
export async function downloadPptx(content: string, slug: string, taskId: string): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';

  // Define slide master with proper title + body placeholders
  // This lets users apply any PowerPoint/Google Slides theme and have formatting inherit
  pptx.defineSlideMaster({
    title: 'BLAIR_MASTER',
    background: { color: '0F172A' },
    objects: [
      {
        placeholder: {
          options: {
            name: 'title', type: 'title', x: 0.4, y: 0.2, w: 9.2, h: 0.9,
            color: 'FFFFFF', fontSize: 30, bold: true, fontFace: 'Calibri', valign: 'middle'
          },
          text: '',
        },
      },
      {
        placeholder: {
          options: {
            name: 'body', type: 'body', x: 0.4, y: 1.35, w: 9.2, h: 4.5,
            color: 'E2E8F0', fontSize: 16, fontFace: 'Calibri', valign: 'top'
          },
          text: '',
        },
      },
    ],

  });

  // Parse Blair's structured output: ## Slide N: Title sections
  interface SlideData {
    title: string;
    headline: string;
    bullets: string[];
    speakerNotes: string;
  }

  const parsedSlides: SlideData[] = [];

  // Split on Slide N: or ## Slide N: boundaries
  const slideParts = content.split(/(?:^|\n)(?=(?:#{1,3}\s*)?Slide \d+[:\s])/i);
  for (const part of slideParts) {
    const trimmedPart = part.trim();
    if (!trimmedPart) continue;

    // First line = title
    const lines = trimmedPart.split('\n');
    const firstLine = lines[0].replace(/^#{1,3}\s*/, '').trim();
    const title = firstLine;

    // Extract headline if present
    const headlineMatch = trimmedPart.match(/\*\*Headline:\*\*\s*(.+)/i);
    const headline = headlineMatch ? headlineMatch[1].trim() : '';

    // Extract bullets (excluding Speaker Notes and Headline lines)
    const bullets: string[] = [];
    for (const line of lines.slice(1)) {
      const trimmedLine = line.trim();
      if (/^(?:\*\*Speaker Notes:\*\*|Speaker Notes:)/i.test(trimmedLine)) continue;
      if (/^\*\*Headline:\*\*/i.test(trimmedLine)) continue;

      const bulletMatch = trimmedLine.match(/^(?:[-*•]|\d+\.)\s+(.+)/);
      if (bulletMatch) {
        const bulletText = bulletMatch[1].trim().replace(/\*\*(.+?)\*\*/g, '$1');
        if (bulletText) bullets.push(bulletText);
      }
    }

    // Extract speaker notes
    const notesMatch = trimmedPart.match(/(?:\*\*Speaker Notes:\*\*|Speaker Notes:)\s*([\s\S]+?)(?=(?:\n\s*(?:#{1,3}\s*)?Slide \d+)|\n---|$)/i);
    const speakerNotes = notesMatch ? notesMatch[1].trim().replace(/\n/g, ' ') : '';

    if (title && (bullets.length > 0 || speakerNotes || headline)) {
      parsedSlides.push({ title, headline, bullets, speakerNotes });
    }
  }

  // Fallback: if no ## Slide N: format found, use old block-based parser
  if (parsedSlides.length === 0) {
    const blocks = parseMarkdownBlocks(content);
    const slideGroups: Array<Array<typeof blocks[0]>> = [];
    let currentGroup: Array<typeof blocks[0]> = [];
    for (const block of blocks) {
      if ((block.type === 'h1' || block.type === 'h2') && currentGroup.length > 0) {
        slideGroups.push(currentGroup);
        currentGroup = [block];
      } else {
        currentGroup.push(block);
      }
    }
    if (currentGroup.length > 0) slideGroups.push(currentGroup);

    for (const slideBlocks of slideGroups) {
      const titleBlock = slideBlocks.find((b) => b.type === 'h1' || b.type === 'h2');
      const bodyBlocks = slideBlocks.filter((b) => b.type !== 'h1' && b.type !== 'h2' && b.type !== 'blank');
      parsedSlides.push({
        title: titleBlock ? markdownToPlain(titleBlock.text) : '',
        headline: '',
        bullets: bodyBlocks.filter(b => b.type === 'li').map(b => markdownToPlain(b.text)),
        speakerNotes: '',
      });
    }
  }

  // Build slides using the BLAIR_MASTER layout with proper placeholders
  for (const slideData of parsedSlides) {
    const slide = pptx.addSlide({ masterName: 'BLAIR_MASTER' });

    // Title placeholder — inherits master formatting, theme-compatible
    slide.addText(slideData.title, { placeholder: 'title' });

    // Divider line below title
    slide.addShape(pptx.ShapeType.line, {
      x: 0.4, y: 1.15, w: 9.2, h: 0,
      line: { color: '2563EB', width: 2 },
    });

    // Body placeholder — headline + bullets, theme-compatible
    const bodyContent: Array<{ text: string; options: Record<string, unknown> }> = [];

    if (slideData.headline) {
      bodyContent.push({
        text: slideData.headline,
        options: { bold: false, color: '93C5FD', fontSize: 18, fontFace: 'Calibri', italic: true, paraSpaceAfter: 8 },
      });
    }

    for (const bullet of slideData.bullets) {
      bodyContent.push({
        text: bullet,
        options: { bullet: { type: 'bullet' as const }, color: 'E2E8F0', fontSize: 16, fontFace: 'Calibri', paraSpaceAfter: 6, indentLevel: 1 },
      });
    }

    if (bodyContent.length > 0) {
      slide.addText(bodyContent, { placeholder: 'body' });
    }

    // Speaker notes go into the actual PowerPoint notes field
    if (slideData.speakerNotes) {
      slide.addNotes(slideData.speakerNotes);
    }
  }

  await pptx.writeFile({ fileName: getDownloadFilename(slug, taskId, 'pptx') });
}

// ── Cade (data-cleaner) structured XLSX change report ─────────────────────────
interface CadeChange {
  type: string;
  count: number;
  sample_before?: string;
  sample_after?: string;
}
interface CadeFlaggedRow {
  row: number | string;
  reason: string;
  original_values?: string;
}
interface CadeData {
  summary: {
    rows_in: number;
    rows_out: number;
    rows_removed: number;
    cells_modified: number;
    errors_flagged: number;
  };
  changes_by_type: CadeChange[];
  flagged_rows: CadeFlaggedRow[];
  columns_modified: string[];
}

function parseCadeDataFromProse(text: string): CadeData {
  const rowsInMatch = text.match(/rows\s*in[:\s]+(\d+)/i);
  const rowsOutMatch = text.match(/rows\s*out(?:\s*\(clean\))?[:\s]+(\d+)/i);
  const rowsRemovedMatch = text.match(/rows\s*(?:removed|flagged)[^\d\n]*[:\s]+(\d+)/i);
  const cellsModMatch = text.match(/cells\s*modified[:\s]+(\d+)/i);
  const issuesFlaggedMatch = text.match(/(?:issues|errors)\s*flagged[:\s]+(\d+)/i);
  const colsModMatch = text.match(/columns\s*modified[:\s]+([^\n]+)/i);

  let tableRows: string[][] = [];
  const tableMatch = text.match(/(\|[^\n]+\|\n\|[-| :]+\|\n(?:\|[^\n]+\|\n?)+)/);
  if (tableMatch) {
    const lines = tableMatch[0].trim().split('\n').filter(l => l.includes('|'));
    for (const line of lines) {
      if (/^[\s|:\-]+$/.test(line)) continue;
      const cells = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
      if (cells.length) tableRows.push(cells);
    }
  }

  const flaggedFromTable: CadeFlaggedRow[] = [];
  let tableRowsIn = 0;
  let tableRowsClean = 0;

  if (tableRows.length > 1) {
    const [headers, ...data] = tableRows;
    tableRowsIn = data.length;
    const statusColIdx = headers.findIndex(h => /status|flag/i.test(h));

    data.forEach((r, idx) => {
      const statusVal = statusColIdx !== -1 ? (r[statusColIdx] || '') : (r[r.length - 1] || '');
      const isClean = /^clean$/i.test(statusVal) || !statusVal;
      if (isClean) {
        tableRowsClean++;
      } else {
        flaggedFromTable.push({
          row: idx + 1,
          reason: statusVal || 'Flagged for review',
          original_values: r.slice(0, statusColIdx !== -1 ? statusColIdx : r.length - 1).join(', '),
        });
      }
    });
  }

  const changesByTypeMap = new Map<string, { count: number; sample_before?: string; sample_after?: string }>();
  const flaggedFromProse: CadeFlaggedRow[] = [];

  const changeLogLines = text.split('\n').filter(l => /^\s*[-*•]\s*Row\s+\d+/i.test(l) || /^\s*[-*•]\s*\*\*Row\s+\d+/i.test(l));

  for (const line of changeLogLines) {
    const cleanLine = line.replace(/^\s*[-*•]\s*/, '').replace(/\*\*/g, '');
    const rowMatch = cleanLine.match(/^Row\s+(\d+)\s*(?:\(([^)]+)\))?:\s*(.+)$/i);
    const rowNum = rowMatch ? rowMatch[1] : '';
    const details = rowMatch ? rowMatch[3] : cleanLine;

    let changeType = 'General modification';
    if (/duplicate|dedup/i.test(details)) changeType = 'Deduplication';
    else if (/email/i.test(details)) changeType = 'Email normalization';
    else if (/phone/i.test(details)) changeType = 'Phone standardization';
    else if (/whitespace|trim/i.test(details)) changeType = 'Whitespace trimming';
    else if (/capital|case|title case|lowercase|uppercase/i.test(details)) changeType = 'Capitalization standardization';
    else if (/date/i.test(details)) changeType = 'Date standardization';
    else if (/currency|amount|numeric/i.test(details)) changeType = 'Currency normalization';
    else if (/flagged|missing|invalid/i.test(details)) changeType = 'Data validation / Flagged';

    const existing = changesByTypeMap.get(changeType) || { count: 0 };
    existing.count++;

    const arrowMatch = details.match(/([^\s]+)\s*(?:->|→)\s*([^\s,.]+)/);
    if (arrowMatch) {
      if (!existing.sample_before) existing.sample_before = arrowMatch[1];
      if (!existing.sample_after) existing.sample_after = arrowMatch[2];
    }
    changesByTypeMap.set(changeType, existing);

    if (/flagged|missing|invalid|duplicate/i.test(details) && rowNum) {
      flaggedFromProse.push({
        row: rowNum,
        reason: details,
      });
    }
  }

  const changes_by_type: CadeChange[] = Array.from(changesByTypeMap.entries()).map(([type, val]) => ({
    type,
    count: val.count,
    sample_before: val.sample_before || '',
    sample_after: val.sample_after || '',
  }));

  const combinedFlagged = flaggedFromTable.length > 0 ? flaggedFromTable : flaggedFromProse;

  const rowsIn = rowsInMatch ? parseInt(rowsInMatch[1], 10) : (tableRowsIn || 0);
  const rowsOut = rowsOutMatch ? parseInt(rowsOutMatch[1], 10) : (tableRowsClean || (rowsIn > combinedFlagged.length ? rowsIn - combinedFlagged.length : rowsIn));
  const rowsRemoved = rowsRemovedMatch ? parseInt(rowsRemovedMatch[1], 10) : (rowsIn > rowsOut ? rowsIn - rowsOut : 0);
  const cellsModified = cellsModMatch ? parseInt(cellsModMatch[1], 10) : (changes_by_type.reduce((acc, c) => acc + c.count, 0));
  const errorsFlagged = issuesFlaggedMatch ? parseInt(issuesFlaggedMatch[1], 10) : (combinedFlagged.length);

  const columnsModifiedRaw = colsModMatch ? colsModMatch[1].trim() : '';
  const columns_modified = columnsModifiedRaw
    ? columnsModifiedRaw.split(/[,;]/).map(s => s.trim().replace(/^[-*•]\s*/, '')).filter(Boolean)
    : [];

  return {
    summary: {
      rows_in: rowsIn,
      rows_out: rowsOut,
      rows_removed: rowsRemoved,
      cells_modified: cellsModified,
      errors_flagged: errorsFlagged,
    },
    changes_by_type,
    flagged_rows: combinedFlagged,
    columns_modified,
  };
}

export function downloadCadeXlsx(
  content: string,
  taskId: string,
  preloadedCadeData?: CadeData | null
): Promise<void> {
  // Parse cade-data JSON block from content, or use preloaded, or parse from prose
  function parseCadeData(text: string): CadeData | null {
    const match = text.match(/```cade-data\s*([\s\S]*?)```/);
    if (match) {
      try { return JSON.parse(match[1].trim()) as CadeData; } catch { /* ignore */ }
    }
    return null;
  }

  const cadeData = preloadedCadeData ?? parseCadeData(content) ?? parseCadeDataFromProse(content);

  const wb = makeWorkbook();

  // Tab 1: Summary
  const summaryRows: (string | number)[][] = [
    ['Cade - Data Cleaning Summary'],
    [],
    ['Metric', 'Value'],
    ['Rows in', cadeData?.summary?.rows_in ?? 'N/A'],
    ['Rows out (clean)', cadeData?.summary?.rows_out ?? 'N/A'],
    ['Rows removed/flagged', cadeData?.summary?.rows_removed ?? 'N/A'],
    ['Cells modified', cadeData?.summary?.cells_modified ?? 'N/A'],
    ['Issues flagged', cadeData?.summary?.errors_flagged ?? 'N/A'],
    [],
    ['Columns Modified'],
    [(cadeData?.columns_modified ?? []).join(', ') || 'N/A'],
  ];
  addRowsSheet(wb, 'Summary', summaryRows);

  // Tab 2: All Changes
  const changes = cadeData?.changes_by_type ?? [];
  const changeRows: (string | number)[][] = [
    ['Change Type', 'Count', 'Sample - Before', 'Sample - After'],
    ...changes.map(c => [c.type, c.count, c.sample_before ?? '', c.sample_after ?? '']),
  ];
  if (changes.length === 0) changeRows.push(['No changes logged', '', '', '']);
  addRowsSheet(wb, 'All Changes', changeRows, { header: true });

  // Tab 3: Flagged Rows
  const flagged = cadeData?.flagged_rows ?? [];
  const flaggedRows: (string | number)[][] = [
    ['Row', 'Reason', 'Original Values'],
    ...flagged.map(r => [r.row, r.reason, r.original_values ?? '']),
  ];
  if (flagged.length === 0) flaggedRows.push(['None', 'No rows flagged for review', '']);
  addRowsSheet(wb, 'Flagged Rows', flaggedRows, { header: true });

  // Distinct filename for changelog
  const idPart = taskId.substring(0, 8);
  return saveWorkbook(wb, `data-cleaner-${idPart}-changelog.xlsx`);
}

// ── Cade (data-cleaner): cleaned data XLSX (parses the pipe table from Section 1) ──────────────
export function downloadCadeCleanedXlsx(content: string, taskId: string): Promise<void> {
  // Strip cade-data JSON block before parsing
  const cleanContent = content.replace(/```cade-data[\s\S]*?```/g, '');

  // Find the first pipe table in the output (Section 1: Cleaned Data)
  // Tables look like: | Col1 | Col2 | ... \n | --- | --- | ...\n | val | val | ...
  const tableMatch = cleanContent.match(/(\|[^\n]+\|\n\|[-| :]+\|\n(?:\|[^\n]+\|\n?)+)/);

  let rows: string[][] = [];
  if (tableMatch) {
    const lines = tableMatch[0].trim().split('\n').filter(l => l.includes('|'));
    for (const line of lines) {
      // Skip separator rows (only dashes, colons, pipes)
      if (/^[\s|:\-]+$/.test(line)) continue;
      const cells = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
      rows.push(cells);
    }
  } else {
    // Try to find HTML table
    const htmlTableMatch = cleanContent.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i);
    if (htmlTableMatch) {
      rows = parseHtmlTable(htmlTableMatch[0]);
    }
  }

  const wb = makeWorkbook();
  if (rows.length > 0) {
    addRowsSheet(wb, 'Cleaned Data', rows, { header: true });
  } else {
    // Fallback: no table found — dump raw text
    addRowsSheet(wb, 'Cleaned Data', [['No structured table found in output'], [''], ['Raw output:'], [cleanContent.slice(0, 32767)]]);
  }

  const idPart = taskId.substring(0, 8);
  return saveWorkbook(wb, `data-cleaner-${idPart}-cleaned.xlsx`);
}

// ── Cade: cleaned data as CSV (for "Cleaned CSV" output format preference) ────
export function downloadCadeCleanedCsv(content: string, taskId: string): void {
  // Strip cade-data JSON block before parsing
  const cleanContent = content.replace(/```cade-data[\s\S]*?```/g, '');

  // Find first pipe table (Section 1)
  const tableMatch = cleanContent.match(/(\|[^\n]+\|\n\|[-| :]+\|\n(?:\|[^\n]+\|\n?)+)/);

  let csvRows: string[] = [];
  if (tableMatch) {
    const lines = tableMatch[0].trim().split('\n').filter(l => l.includes('|'));
    for (const line of lines) {
      if (/^[\s|:\-]+$/.test(line)) continue; // skip separator rows
      const cells = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
      // CSV-escape: wrap cells containing commas or quotes in double-quotes
      const escaped = cells.map(c => c.includes(',') || c.includes('"') ? `"${c.replace(/"/g, '""')}"` : c);
      csvRows.push(escaped.join(','));
    }
  } else {
    // Try to find HTML table
    const htmlTableMatch = cleanContent.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i);
    if (htmlTableMatch) {
      const parsedRows = parseHtmlTable(htmlTableMatch[0]);
      for (const cells of parsedRows) {
        const escaped = cells.map(c => c.includes(',') || c.includes('"') ? `"${c.replace(/"/g, '""')}"` : c);
        csvRows.push(escaped.join(','));
      }
    }
  }

  const csv = csvRows.join('\n') || 'No structured table found in output';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const idPart = taskId.substring(0, 8);
  a.download = `data-cleaner-${idPart}-cleaned.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Cara — Customer Support Writer CSV export
// Parses agent-facing template blocks from markdown output
// ---------------------------------------------------------------------------
export function downloadCaraCsv(content: string, taskInput: Record<string, unknown>, taskId: string): void {
  const channel = (taskInput?.primary_channel as string) || '';
  const customerState = Array.isArray(taskInput?.customer_state)
    ? (taskInput.customer_state as string[]).join('; ')
    : (taskInput?.customer_state as string) || '';
  const hasFollowUp = taskInput?.follow_up_variants === 'true' || taskInput?.follow_up_variants === 'Yes' || taskInput?.follow_up_variants === true;

  // CSV headers
  const headers = ['Title', 'Subject', 'Body', 'When to use'];
  if (hasFollowUp) headers.push('Follow-up');
  if (channel && channel !== 'Any / not specified') headers.push('Channel');
  if (customerState) headers.push('Customer State');

  const rows: string[][] = [];

  // Convert HTML content to clean text for parsing if needed
  const normalizedContent = (isHtmlContent(content) || /<[a-zA-Z][^>]*>/.test(content))
    ? htmlToCleanText(content)
    : content;

  const cleanCell = (s: string) => {
    if (!s) return '';
    return stripHtmlToText(markdownToPlain(s))
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Parse template blocks: look for Template N:, **Template N:**, or ## Template N: patterns
  const templateBlocks = normalizedContent.split(/(?=\n\s*(?:(?:\*\*|##\s*)?Template\s*\d+[:\.]|Template\s*\d+[:\.]))/i);

  for (const block of templateBlocks) {
    if (!block.match(/(?:\*\*|##\s*)?Template\s*\d+[:\.]/i)) continue;

    // Extract Title (first bolded heading, ## heading, or Template N: line)
    const titleMatch = block.match(/(?:(?:\*\*|##\s*)?Template\s*\d+[:\.]\s*([^*\n<]+)(?:\*\*)?)/i);
    const title = cleanCell(titleMatch?.[0] || titleMatch?.[1] || '');

    // Extract Subject
    const subjectMatch = block.match(/(?:\*\*|\b)Subject:\s*\*?\*?\s*(.+)/i);
    const subject = cleanCell(subjectMatch?.[1] || '');

    // Extract Body — content between Body: and the next label/template
    const bodyMatch = block.match(/(?:\*\*|\b)Body:\s*\*?\*?\s*\n?([\s\S]+?)(?=\n\s*(?:\*\*|\b)(?:When to use|If first reply|Follow-up|Template|##|$))/i);
    const body = cleanCell(bodyMatch?.[1] || '');

    // Extract When to use
    const tagMatch = block.match(/(?:\*\*|\b)When to use:\s*\*?\*?\s*(.+)/i);
    const tag = cleanCell(tagMatch?.[1] || '');

    // Extract follow-up
    const followUpMatch = block.match(/(?:\*\*|\b)(?:If first reply doesn't resolve|Follow-up):\s*\*?\*?\s*\n?([\s\S]+?)(?=\n\s*(?:\*\*|\b)(?:Template|##|$))/i);
    const followUp = cleanCell(followUpMatch?.[1] || '');

    if (!title && !subject && !body) continue; // skip non-template sections

    const row = [title, subject, body, tag];
    if (hasFollowUp) row.push(followUp);
    if (channel && channel !== 'Any / not specified') row.push(channel);
    if (customerState) row.push(customerState);
    rows.push(row);
  }

  // Fallback: if no template blocks found, export clean text lines without HTML tags
  if (rows.length === 0) {
    const cleanText = htmlToCleanText(content);
    const lines = cleanText
      .split('\n')
      .map(l => cleanCell(l))
      .filter(Boolean);
    const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
    const fallbackCsv = '"Content"\n' + lines.map(l => escape(l)).join('\n');
    const blob = new Blob(['\uFEFF' + fallbackCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `support-templates-${taskId.substring(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
  const csvLines = [
    headers.map(escape).join(','),
    ...rows.map(r => r.map(escape).join(',')),
  ];

  const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `support-templates-${taskId.substring(0, 8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
