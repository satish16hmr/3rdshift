import { redirect } from 'next/navigation'

type BillingSearchParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>

function buildBillingRedirect(searchParams?: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item)
    } else if (value != null) {
      params.set(key, value)
    }
  }

  const query = params.toString()
  return `/dashboard/settings/billing${query ? `?${query}` : ''}`
}

export default async function LegacyBillingRedirect({
  searchParams,
}: {
  searchParams?: BillingSearchParams
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  redirect(buildBillingRedirect(resolvedSearchParams))
}
