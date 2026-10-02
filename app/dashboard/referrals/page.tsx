'use client'

import { useEffect, useState } from 'react'
import { DubEmbed } from '@dub/embed-react'
import { Gift, RefreshCw } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Heading, Subheading } from '@/components/heading'

import { createClient } from '@/lib/supabase/client'

type TokenState =
  | { status: 'loading'; token: null; error: null }
  | { status: 'ready'; token: string; error: null }
  | { status: 'forbidden'; token: null; error: string }
  | { status: 'error'; token: null; error: string }

function ReferralsBodySkeleton() {
  return (
    <>
      <Skeleton className="my-5 h-[282px] w-full rounded-3xl bg-zinc-100" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-[126px] w-full rounded-3xl bg-zinc-100 col-span-2" />
        <Skeleton className="h-[126px] w-full rounded-3xl bg-zinc-100" />
      </div>
      <Skeleton className="mt-5 h-[513px] w-full rounded-3xl bg-zinc-100" />
    </>
  )
}

function ReferralsSkeleton() {
  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div className="min-w-0 flex gap-4">
          {/* <div className="mb-3 inline-flex size-13 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Gift className="size-5" aria-hidden="true" />
            </div> */}
          <div>
            <Heading className='text-2xl! text-zinc-800! font-semibold! hidden lg:block'>Refer &amp; Earn</Heading>
            <Subheading className='text-neutral-500! text-sm! sm:text-base! font-normal!'>Share 3rdShift and earn 20% of every payment from customers you refer — for life.</Subheading>
          </div>
        </div>
        <Skeleton className="h-6 w-[156px]" />
      </div>
      <ReferralsBodySkeleton />
    </div>
  )
}

export default function ReferralsPage() {
  
  const [state, setState] = useState<TokenState>({ status: 'loading', token: null, error: null })
  const [isIframeLoading, setIsIframeLoading] = useState(true)

  const fetchToken = async () => {
    setState({ status: 'loading', token: null, error: null })

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setState({ status: 'error', token: null, error: 'Please sign in again to open referrals.' })
        return
      }

      const response = await fetch('/api/referrals/embed-token', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const data = await response.json().catch(() => ({}))

      if (response.status === 403) {
        setState({
          status: 'forbidden',
          token: null,
          error: 'Referrals are available to paid-plan users.',
        })
        return
      }

      if (!response.ok || !data.publicToken) {
        throw new Error(data.error || 'Unable to load the referral dashboard.')
      }

      setState({ status: 'ready', token: data.publicToken, error: null })

      // Delay removing the skeleton to give the iframe time to load
      setTimeout(() => {
        setIsIframeLoading(false)
      }, 1500)
    } catch (error) {
      setState({
        status: 'error',
        token: null,
        error: error instanceof Error ? error.message : 'Unable to load the referral dashboard.',
      })
    }
  }

  useEffect(() => {
    fetchToken()
  }, [])


  if (state.status === 'loading') {
    return <ReferralsSkeleton />
  }

  return (
    <div className="w-full">
      <header>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
          <div className="min-w-0 flex gap-4">
            {/* <div className="mb-3 inline-flex size-13 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Gift className="size-5" aria-hidden="true" />
            </div> */}
            <div>
              <Heading className='text-2xl! text-zinc-800! font-semibold! hidden lg:block'>Refer &amp; Earn</Heading>
              <Subheading className='text-neutral-500! text-sm! sm:text-base! font-normal!'>Share 3rdShift and earn 20% of every payment from customers you refer — for life.</Subheading>
            </div>
          </div>
          {state.status === 'ready' && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 w-fit text-nowrap">
              Live referral dashboard
            </div>
          )}
        </div>
      </header>

      {state.status === 'ready' ? (
        <section className="mt-0 min-w-0 -mx-5 relative min-h-[640px]">
          {isIframeLoading && (
            <div className="absolute inset-0 z-10 bg-white px-5 transition-opacity duration-300">
              <ReferralsBodySkeleton />
            </div>
          )}
          <DubEmbed
            data="referrals"
            token={state.token}
            options={{
              theme: 'light',
              themeOptions: {
                backgroundColor: '#ffffff',
              },
              containerStyles: {
                minHeight: '640px',
                width: '100%',
                maxWidth: '100%',
              },
            }}
            className={`min-h-[640px] w-full min-w-[320px] transition-opacity duration-500 ${isIframeLoading ? 'opacity-0' : 'opacity-100'}`}
          />
        </section>
      ) : (
        <section className="mt-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="max-w-xl">
            <h2 className="text-lg font-semibold text-zinc-900">
              {state.status === 'forbidden' ? 'Upgrade to open referrals' : 'Referral dashboard unavailable'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{state.error}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {state.status === 'forbidden' ? (
                <Button variant="primary" asChild>
                  <Link href="/dashboard/settings/billing">View plans</Link>
                </Button>
              ) : (
                <Button variant="primary" onClick={fetchToken}>
                  <RefreshCw className="mr-2 size-4" />
                  Try again
                </Button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
