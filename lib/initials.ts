export function getWorkspaceInitials(name?: string | null, fallback = 'WS') {
  const trimmed = name?.trim()
  if (!trimmed) return fallback

  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }

  const compact = parts[0] || ''
  if (compact.length >= 2) {
    return `${compact[0]}${compact[compact.length - 1]}`.toUpperCase()
  }

  return compact.toUpperCase() || fallback
}
