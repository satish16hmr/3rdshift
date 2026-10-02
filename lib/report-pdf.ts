function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const FORBIDDEN_TAGS = ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'base'];
const ALLOWED_HTML_TAGS = new Set([
  'div', 'p', 'br', 'h1', 'h2', 'h3', 'strong', 'em', 'b', 'i',
  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);
const SAFE_REPORT_CLASSES = new Set(['report-spacer', 'bold-line', 'total-row', 'flag-row']);

function stripForbiddenTagBlocks(input: string): string {
  let out = String(input);
  for (const tag of FORBIDDEN_TAGS) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\/?>`, 'gi'), '');
  }
  return out;
}

function stripRawHtmlForMarkdown(input: string): string {
  return stripForbiddenTagBlocks(input)
    // For markdown content, raw HTML is not part of the report language. Keep text inside
    // non-forbidden tags, but drop all attributes/URLs so Puppeteer never sees them.
    .replace(/<[^>]+>/g, '');
}

function safeClassAttr(attrs: string): string {
  const classMatch = attrs.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+))/i);
  if (!classMatch) return '';
  const classes = (classMatch[1] || classMatch[2] || classMatch[3] || '')
    .split(/\s+/)
    .filter((className) => SAFE_REPORT_CLASSES.has(className));
  return classes.length ? ` class="${classes.join(' ')}"` : '';
}

function escTextPreservingEntities(s: string): string {
  return String(s)
    .replace(/&(?!(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeEditorHtml(input: string): string {
  const withoutForbiddenBlocks = stripForbiddenTagBlocks(input);
  const tagRe = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9:-]*)([^>]*)>/g;
  let out = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(withoutForbiddenBlocks)) !== null) {
    out += escTextPreservingEntities(withoutForbiddenBlocks.slice(lastIndex, match.index));
    const [, closing, rawTag, attrs] = match;
    const tag = rawTag.toLowerCase();
    if (ALLOWED_HTML_TAGS.has(tag)) {
      if (closing) {
        if (tag !== 'br') out += `</${tag}>`;
      } else if (tag === 'br') {
        out += '<br>';
      } else {
        // Preserve only known styling classes used by this report renderer. Drop every
        // URL-bearing attribute (src/href), every event handler, style, and all unknown attrs.
        out += `<${tag}${safeClassAttr(attrs || '')}>`;
      }
    }
    lastIndex = match.index + match[0].length;
  }

  out += escTextPreservingEntities(withoutForbiddenBlocks.slice(lastIndex));
  return out;
}

function isEditorHtmlContent(input: string): boolean {
  const trimmed = input.trim();
  return /^<(div|p|br|h1|h2|h3|strong|em|b|i|ul|ol|li|table|thead|tbody|tr|th|td)\b/i.test(trimmed);
}

function buildTable(lines: string[]): string {
  const rows = lines.filter(l => !l.match(/^\|[-\s|:]+\|$/));
  if (rows.length === 0) return '';

  let html = '<table>';
  rows.forEach((row, i) => {
    const cells = row.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (i === 0) {
      html += '<thead><tr>' + cells.map(c => `<th>${esc(stripRawHtmlForMarkdown(c.replace(/\*\*/g, '')))}</th>`).join('') + '</tr></thead><tbody>';
    } else {
      const isTotal = cells.some(c => /total|net income|margin/i.test(c));
      const isFlag = cells.some(c => /flag|anomal/i.test(c));
      const cls = isTotal ? ' class="total-row"' : isFlag ? ' class="flag-row"' : '';
      html += `<tr${cls}>` + cells.map(c => `<td>${esc(stripRawHtmlForMarkdown(c.replace(/\*\*/g, '')))}</td>`).join('') + '</tr>';
    }
  });
  html += '</tbody></table>';
  return html;
}

function renderInlineBold(t: string): string {
  const safe = stripRawHtmlForMarkdown(t);
  const parts: string[] = [];
  let lastIndex = 0;
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = boldRegex.exec(safe)) !== null) {
    if (match.index > lastIndex) parts.push(esc(safe.slice(lastIndex, match.index)));
    parts.push(`<strong>${esc(match[1])}</strong>`);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < safe.length) parts.push(esc(safe.slice(lastIndex)));
  return parts.join('');
}

function markdownToReportBody(md: string): string {
  const lines = stripForbiddenTagBlocks(md).split('\n');
  let html = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    if (!t) { html += '<div class="report-spacer"></div>'; continue; }

    if (t.startsWith('# ')) {
      html += `<h1>${esc(stripRawHtmlForMarkdown(t.slice(2).trim()))}</h1>`;
    } else if (t.startsWith('## ')) {
      html += `<h2>${esc(stripRawHtmlForMarkdown(t.slice(3).trim()))}</h2>`;
    } else if (t.startsWith('### ')) {
      html += `<h3>${esc(stripRawHtmlForMarkdown(t.slice(4).trim()))}</h3>`;
    } else if (t.startsWith('| ')) {
      const tableLines: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        tableLines.push(lines[j].trim());
        j++;
      }
      i = j - 1;
      html += buildTable(tableLines);
    } else if (t.startsWith('- ') || t.startsWith('• ')) {
      html += `<li>${esc(stripRawHtmlForMarkdown(t.replace(/^[-•]\s*/, '').replace(/\*\*/g, '')))}</li>`;
    } else if (t.startsWith('**') && t.endsWith('**')) {
      html += `<p class="bold-line">${esc(stripRawHtmlForMarkdown(t.replace(/\*\*/g, '')))}</p>`;
    } else {
      html += `<p>${renderInlineBold(t)}</p>`;
    }
  }

  return html;
}

function reportBody(input: string): string {
  if (isEditorHtmlContent(input)) return sanitizeEditorHtml(input);
  return markdownToReportBody(input);
}

export async function markdownToReportHtml(md: string, title: string, resolvedByline?: string): Promise<string> {
  const html = reportBody(md);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Noto+Sans:wght@400;700&family=Noto+Sans+Symbols:wght@400;700&family=Noto+Sans+Symbols+2&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+SC:wght@400;700&family=Noto+Sans+TC:wght@400;700&family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+Arabic:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans+Thai:wght@400;700&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', 'Noto Sans', 'Noto Sans Symbols', 'Noto Sans Symbols 2', 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans KR', 'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Hebrew', 'Noto Sans Thai', 'Segoe UI Symbol', 'DejaVu Sans', 'Calibri', Arial, sans-serif;
    font-size: 10pt;
    color: #111;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .report-title {
    font-size: 16pt;
    font-weight: 700;
    color: #111;
    margin-bottom: 4px;
  }
  .report-meta {
    font-size: 9pt;
    color: #666;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 1pt solid #ddd;
  }
  .byline-arrow {
    font-family: 'Noto Sans Symbols', 'Noto Sans Symbols 2', 'Segoe UI Symbol', 'DejaVu Sans', sans-serif;
    display: inline-block;
    margin: 0 2px;
  }
  h1 { font-size: 13pt; font-weight: 700; color: #111; margin: 16px 0 6px; }
  h2 {
    font-size: 11pt;
    font-weight: 700;
    color: #1d4ed8;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1pt solid #93c5fd;
    padding-bottom: 2px;
    margin: 14px 0 6px;
  }
  h3 { font-size: 10pt; font-weight: 700; color: #333; margin: 10px 0 4px; }
  p { margin-bottom: 5px; font-size: 10pt; }
  p.bold-line { font-weight: 700; }
  .report-spacer { height: 6px; }
  ul, ol { margin: 5px 0 7px 18px; }
  li { margin-left: 16px; margin-bottom: 2px; font-size: 10pt; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 6px 0 10px;
    font-size: 9.5pt;
  }
  th {
    background: #1d4ed8;
    color: #fff;
    font-weight: 700;
    padding: 5px 8px;
    text-align: left;
    font-size: 9pt;
  }
  td {
    padding: 4px 8px;
    border-bottom: 0.5pt solid #e5e7eb;
  }
  tr:nth-child(even) td { background: #f8fafc; }
  tr.total-row td { font-weight: 700; border-top: 1pt solid #999; background: #f1f5f9; }
  .flag-row td { background: #fef3c7; color: #92400e; }
  strong, b { font-weight: 700; }
  em, i { font-style: italic; }
  @page { margin: 0.75in; size: letter; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<div class="report-title">${esc(title)}</div>
<div class="report-meta">Generated by ${esc(resolvedByline ?? '3rdShift AI Team').replace(/→/g, '<span class="byline-arrow">&rarr;</span>')} · 3rdShift</div>
${html}
</body>
</html>`;
}
