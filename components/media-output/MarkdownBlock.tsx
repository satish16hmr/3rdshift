'use client'

import { marked } from 'marked'
import DOMPurify from 'dompurify'

interface MarkdownBlockProps {
  text: string
  className?: string
}

/**
 * Renders a DOMPurify-sanitized markdown string as HTML.
 * Shared by AudioPlayer, VideoPlayer, and ImageGallery.
 */
export function MarkdownBlock({ text, className = 'prose prose-sm max-w-none text-zinc-800' }: MarkdownBlockProps) {
  if (!text) return null
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{
        __html:
          typeof window !== 'undefined'
            ? DOMPurify.sanitize(marked.parse(text, { breaks: true, gfm: true }) as string)
            : (marked.parse(text, { breaks: true, gfm: true }) as string),
      }}
    />
  )
}
