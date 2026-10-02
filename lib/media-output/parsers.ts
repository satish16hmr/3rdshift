import { marked } from 'marked'
import DOMPurify from 'dompurify'

/**
 * lib/media-output/parsers.ts
 *
 * Pure utility functions for parsing and handling media worker output strings.
 * No React, no side-effects — safe to import in tests or server code.
 */

export function toHtml(markdown: string): string {
  if (!markdown) return ''
  const cleanMarkdown = markdown.replace(/\n*```(?:metric-data|metricData)[\s\S]*?```\n*/gi, '').trimEnd()
  return typeof window !== 'undefined'
    ? (DOMPurify.sanitize(marked.parse(cleanMarkdown, { breaks: true, gfm: true }) as string) as string)
    : (marked.parse(cleanMarkdown, { breaks: true, gfm: true }) as string)
}


// ── Shared strip helper ───────────────────────────────────────────────────────

/** Strip the common "Media Asset Generated" boilerplate lines from output. */
function stripMediaBoilerplate(text: string): string {
  return text
    .replace(/^##\s*Media Asset Generated\s*\n?/im, '')
    .replace(/^media_task_id:\s*\S+\s*\n?/im, '')
    .trim()
}

// ── Image ─────────────────────────────────────────────────────────────────────

export interface ParsedImage {
  url: string
  label: string
}

export interface ParsedImageOutput {
  text: string
  images: ParsedImage[]
}

export function parseImageOutput(output: string): ParsedImageOutput {
  if (!output) return { text: '', images: [] }

  const images: ParsedImage[] = []
  const seenUrls = new Set<string>()

  // Match markdown links: [label](url) or ![label](url)
  const markdownLinkRegex = /!?\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = markdownLinkRegex.exec(output)) !== null) {
    const originalLabel = match[1]
    const url = match[2]
    if (
      url.match(/\.(png|jpg|jpeg|webp|gif|svg)/i) ||
      url.includes('fal.media') ||
      url.includes('tmp-files')
    ) {
      if (!seenUrls.has(url)) {
        const cleanLabel = originalLabel.replace(/Download\s+/i, '')
        images.push({ url, label: cleanLabel.charAt(0).toUpperCase() + cleanLabel.slice(1) })
        seenUrls.add(url)
      }
    }
  }

  // Fallback: raw URLs ending with image extensions
  const urlRegex = /(https?:\/\/[^\s)]+)/g
  const rawUrls = output.match(urlRegex) || []
  let fallbackCount = 1
  for (const url of rawUrls) {
    if (!seenUrls.has(url)) {
      if (
        url.match(/\.(png|jpg|jpeg|webp|gif|svg)/i) ||
        url.includes('fal.media') ||
        url.includes('tmp-files')
      ) {
        images.push({ url, label: `Image ${fallbackCount++}` })
        seenUrls.add(url)
      }
    }
  }

  const cleanLines = output.split('\n').filter((line) => {
    for (const img of images) {
      if (line.includes(img.url)) return false
    }
    const t = line.trim().toLowerCase()
    return t !== '### images' && t !== '## images' && t !== '### image' && t !== '## image'
  })

  return { text: cleanLines.join('\n').trim(), images }
}

// ── Audio ─────────────────────────────────────────────────────────────────────

export interface ParsedAudioOutput {
  audioUrl: string | null
  text: string
}

export function parseAudioOutput(output: string): ParsedAudioOutput {
  if (!output) return { audioUrl: null, text: '' }

  const match = output.match(/\[Download audio\]\((https?:\/\/[^\s)]+)\)/i)
  const audioUrl = match ? match[1] : null

  const text = stripMediaBoilerplate(
    output
      .replace(/^###\s*Audio\s*\n?/im, '')
      .replace(/^-\s*\[Download audio\]\(https?:\/\/[^\s)]+\)\s*\n?/im, '')
  )

  return { audioUrl, text }
}

/** Quick check — does this output contain an audio download link? */
export function hasAudioLink(output: string): boolean {
  return /\[Download audio\]/i.test(output)
}

// ── Video ─────────────────────────────────────────────────────────────────────

export interface ParsedVideoOutput {
  videoUrl: string | null
  text: string
}

export function parseVideoOutput(output: string): ParsedVideoOutput {
  if (!output) return { videoUrl: null, text: '' }

  const match = output.match(/\[Download video\]\((https?:\/\/[^\s)]+)\)/i)
  const videoUrl = match ? match[1] : null

  const text = stripMediaBoilerplate(
    output
      .replace(/^###\s*Video\s*\n?/im, '')
      .replace(/^-\s*\[Download video\]\(https?:\/\/[^\s)]+\)\s*\n?/im, '')
  )

  return { videoUrl, text }
}

/** Quick check — does this output contain a video download link? */
export function hasVideoLink(output: string): boolean {
  return /\[Download video\]/i.test(output)
}

// ── Shared download utilities ─────────────────────────────────────────────────

/** Trigger a browser download of a remote URL by filename. */
export async function downloadFromUrl(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Fetch failed')
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    a.click()
    URL.revokeObjectURL(blobUrl)
  } catch (err) {
    console.warn('[downloadFromUrl] Fallback to direct window.open due to CORS/fetch failure', err)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.target = '_blank'
    a.click()
  }
}

/** Trigger a browser download of a text/markdown string as a file. */
export function downloadTextAsFile(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function slugifyLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '-')
}

export function parseMediaTaskId(output: string): string | null {
  if (!output) return null
  const match = output.match(/^media_task_id:\s*(\S+)/im)
  return match ? match[1] : null
}

export function stripMediaForDownload(content: string): string {
  if (!content) return ''
  
  let cleaned = content
    .replace(/!\[[^\]]*\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/gi, '')
    .replace(/\[[^\]]*download[^\]]*\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/gi, '')
    .replace(/\[[^\]]*\]\((https?:\/\/[^\s)]+|\/[^\s)]+?\.(?:png|jpg|jpeg|webp|gif|mp3|mp4|wav|zip|pdf|docx|xlsx))[\s)]/gi, '')
    .replace(/\[[^\]]*\]\((https?:\/\/[^\s)]+|\/[^\s)]+?\.(?:png|jpg|jpeg|webp|gif|mp3|mp4|wav|zip|pdf|docx|xlsx))\)/gi, '')
    .replace(/^##\s*Media Asset Generated\s*\n?/im, '')
    .replace(/^media_task_id:\s*\S+\s*\n?/im, '')
    .trim()

  // Split into lines, filter out empty headers/lists, then join back
  const lines = cleaned.split('\n')
  const filteredLines: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const lowerLine = line.toLowerCase()
    
    // Skip empty lines/headers for media sections if they contain nothing after them
    if (
      lowerLine === '### images' || 
      lowerLine === '## images' || 
      lowerLine === '### video' || 
      lowerLine === '## video' || 
      lowerLine === '### audio' || 
      lowerLine === '## audio' ||
      lowerLine === '### files' ||
      lowerLine === '## files' ||
      lowerLine === 'media_task_id:' ||
      lowerLine === '-' ||
      lowerLine === '*'
    ) {
      continue
    }
    
    // Skip bullet points that became empty after link stripping (e.g. "- " or "* ")
    if (/^[-*]\s*$/.test(line)) {
      continue
    }
    
    filteredLines.push(lines[i])
  }
  
  return filteredLines.join('\n').trim()
}
