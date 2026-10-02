import { getWorkerBySlug } from '@/lib/workers/registry'

const AVATAR_BASE = '/images/marketing/workers-figma'

export const WORKER_AVATAR_NAMES = new Set([
  'alice', 'ash', 'ava', 'beck', 'bella', 'blair', 'bree', 'brody', 'cade', 'cara', 'case', 'charlie',
  'clay', 'cruz', 'dale', 'darcy', 'dex', 'dina', 'duncan', 'elliot', 'ellis', 'ember', 'emma', 'eve',
  'flynn', 'gus', 'heath', 'holly', 'iris', 'ivy', 'jett', 'joe', 'joss', 'jude', 'jules', 'kai',
  'knox', 'koa', 'lane', 'lena', 'lenny', 'lyra', 'mack', 'marlo', 'mira', 'naru', 'nash', 'nico',
  'nora', 'opal', 'oscar', 'paul', 'penn', 'pete', 'peyton', 'piper', 'quinn', 'reed', 'remy', 'ren',
  'rio', 'sage', 'sam', 'shay', 'sienna', 'silas', 'sully', 'tala', 'tate', 'tess', 'thea', 'trey',
  'vera', 'vince', 'wes', 'wilma', 'zane', 'zeke',
])

export function workerAvatarKey(personaName: string) {
  return personaName.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function getWorkerAvatarSrcByPersona(personaName?: string | null) {
  if (!personaName) return null
  const key = workerAvatarKey(personaName)
  return WORKER_AVATAR_NAMES.has(key) ? `${AVATAR_BASE}/${key}.png` : null
}

export function getWorkerAvatarSrcBySlug(slug: string) {
  const worker = getWorkerBySlug(slug)
  return getWorkerAvatarSrcByPersona(worker?.personaName)
}
