// @ts-nocheck
'use client'

import React, { useMemo } from 'react'

// Platform character limits
const PLATFORM_LIMITS = {
  twitter: { limit: 280, label: 'X/Twitter', short: 'X' },
  x: { limit: 280, label: 'X/Twitter', short: 'X' },
  linkedin: { limit: 3000, label: 'LinkedIn', short: 'LI', recommended: 1300 },
  instagram: { limit: 2200, label: 'Instagram', short: 'IG' },
  threads: { limit: 500, label: 'Threads', short: 'TH' },
  facebook: { limit: 63206, label: 'Facebook', short: 'FB', recommended: 500 },
  tiktok: { limit: 2200, label: 'TikTok', short: 'TK' },
}

function detectPlatform(text) {
  const lower = text.toLowerCase()
  if (lower.includes('twitter') || lower.includes('tweet') || lower.includes('x/twitter')) return 'twitter'
  if (lower.includes('linkedin')) return 'linkedin'
  if (lower.includes('instagram') || lower.includes('reels') || lower.includes('ig')) return 'instagram'
  if (lower.includes('threads')) return 'threads'
  if (lower.includes('facebook')) return 'facebook'
  if (lower.includes('tiktok')) return 'tiktok'
  return null
}

function getPostContent(postText) {
  // Strip markdown formatting, strip **Character count: N** line, strip platform/type labels
  return postText
    .replace(/\*\*Character count:.*?\*\*/gi, '')  // old format
    .replace(/^\*\*Type:\*\*.*$/gm, '')
    .replace(/^\*\*Pair with:\*\*.*$/gm, '')
    .replace(/^\*\*Post time:\*\*.*$/gm, '')
    .replace(/^\*\*Campaign:\*\*.*$/gm, '')
    .replace(/^---$/gm, '')
    .replace(/^#{1,3} .+$/gm, '')              // strip headers
    .replace(/\*\*([^*]+)\*\*/g, '$1')         // strip bold markers for char count
    .replace(/\*([^*]+)\*/g, '$1')             // strip italic markers
    .trim()
}

function parsePostsFromOutput(text) {
  if (!text) return []
  
  const posts = []
  
  // Split on ## POST N OF N pattern
  const postSections = text.split(/(?=^## POST \d+ OF \d+)/m)
  
  if (postSections.length > 1) {
    for (const section of postSections) {
      if (!section.trim()) continue
      const headerMatch = section.match(/## POST (\d+) OF (\d+)/)
      if (!headerMatch) continue
      
      const postNum = parseInt(headerMatch[1])
      const totalPosts = parseInt(headerMatch[2])
      const platform = detectPlatform(section)
      const content = getPostContent(section)
      const charCount = content.replace(/\s+/g, ' ').trim().length
      
      posts.push({ postNum, totalPosts, platform, content, charCount })
    }
    return posts
  }
  
  // Fallback: look for ---separated sections with Platform labels
  const sections = text.split(/\n---\n/)
  if (sections.length > 1) {
    sections.forEach((section, i) => {
      if (!section.trim()) return
      const platform = detectPlatform(section)
      const content = getPostContent(section)
      const charCount = content.replace(/\s+/g, ' ').trim().length
      if (charCount > 20) {
        posts.push({ postNum: i + 1, totalPosts: sections.length, platform, content, charCount })
      }
    })
    return posts
  }
  
  // Single post — no separators
  const platform = detectPlatform(text)
  const content = getPostContent(text)
  const charCount = content.replace(/\s+/g, ' ').trim().length
  return [{ postNum: 1, totalPosts: 1, platform, content, charCount }]
}

function CharBadge({ count, platform }) {
  const config = platform ? PLATFORM_LIMITS[platform] : null
  const limit = config?.limit
  const recommended = config?.recommended
  const effectiveLimit = recommended || limit

  let status = 'ok'    // green
  let bgColor = 'bg-emerald-50'
  let textColor = 'text-emerald-700'
  let borderColor = 'border-emerald-200'

  if (effectiveLimit) {
    const ratio = count / effectiveLimit
    if (count > (limit || Infinity)) {
      status = 'over'
      bgColor = 'bg-red-50'
      textColor = 'text-red-700'
      borderColor = 'border-red-200'
    } else if (ratio > 0.9) {
      status = 'approaching'
      bgColor = 'bg-amber-50'
      textColor = 'text-amber-700'
      borderColor = 'border-amber-200'
    }
  }

  const platformLabel = config?.short || null
  const limitLabel = recommended
    ? `${recommended.toLocaleString()} recommended`
    : limit
    ? `${limit.toLocaleString()} limit`
    : null

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${bgColor} ${textColor} ${borderColor}`}>
      {platformLabel && (
        <span className="font-semibold">{platformLabel}</span>
      )}
      <span>{count.toLocaleString()} chars</span>
      {limitLabel && (
        <span className="opacity-60">/ {limitLabel}</span>
      )}
      {status === 'over' && <span>⚠️</span>}
    </span>
  )
}

/**
 * SocialCharCount — shows character count badges per post for Ash's social output.
 * Reads the raw output text, parses posts, shows badges above the editor.
 * Does NOT inject anything into the output text or downloaded files.
 */
export default function SocialCharCount({ outputText, workerSlug }) {
  const SOCIAL_SLUGS = new Set([
    'social-media-creator',     // Ash
    'x-twitter-ghostwriter',    // Case
    'linkedin-ghostwriter',     // Elliot
    'instagram-strategist',     // Peyton
    'linkedin-profile-optimizer', // Lea
  ])

  const posts = useMemo(() => {
    if (!SOCIAL_SLUGS.has(workerSlug) || !outputText) return []
    return parsePostsFromOutput(outputText)
  }, [outputText, workerSlug])

  if (!posts.length) return null

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 px-3">
      <span className="text-xs font-medium text-zinc-400 mr-1">Character counts:</span>
      {posts.map((post, i) => (
        <CharBadge
          key={i}
          count={post.charCount}
          platform={post.platform}
        />
      ))}
      {posts.length === 1 && (
        <span className="text-xs text-zinc-400">
          {PLATFORM_LIMITS[posts[0].platform]
            ? `${PLATFORM_LIMITS[posts[0].platform].label} limit: ${(PLATFORM_LIMITS[posts[0].platform].recommended || PLATFORM_LIMITS[posts[0].platform].limit).toLocaleString()}`
            : ''}
        </span>
      )}
    </div>
  )
}
