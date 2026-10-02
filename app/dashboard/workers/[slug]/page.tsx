// @ts-nocheck
import { redirect } from 'next/navigation'

export default function WorkerRedirect({ params, searchParams }) {
  const slug = params?.slug
  const query = new URLSearchParams(searchParams || {}).toString()
  redirect(`/dashboard/team/${slug}${query ? `?${query}` : ''}`)
}
