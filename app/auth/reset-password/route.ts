import { NextResponse } from 'next/server'

// Supabase sends password reset emails pointing to /auth/reset-password?code=...
// Our actual reset page lives at /reset-password — redirect there preserving all params.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const appOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://3rdshift.ai'
  const destination = new URL('/reset-password', appOrigin)
  url.searchParams.forEach((value, key) => {
    destination.searchParams.set(key, value)
  })
  return NextResponse.redirect(destination.toString())
}
