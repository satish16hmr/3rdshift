'use client'

import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Subheading } from '@/components/heading'
import { Text } from '@/components/text'
import CompanyLogoUpload from '@/components/CompanyLogoUpload'
import { getStoredWorkspaceId } from '@/lib/workspace-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/input'
import { Textarea } from '@/components/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Save } from 'lucide-react'
import { onboardingStep2Schema } from '@/src/schema/onboarding.schema'

type BrandProfile = {
  company_name: string
  company_logo_url: string | null
  industry: string
  audience: string
  tone: string
  competitors: string
  additional_context: string
}

type BrandProfileFieldKey = Exclude<keyof BrandProfile, 'company_logo_url' | 'additional_context'>

type WorkspaceSummary = {
  id: string
  name?: string | null
  company_logo_url?: string | null
}

type WorkspaceResponse = {
  activeWorkspaceId?: string
  workspaces?: WorkspaceSummary[]
}

function BrandContextSkeleton() {
  return (
    <section className="space-y-3 sm:space-y-4 lg:space-y-5" aria-busy="true">
      <div>
        <Subheading className="text-lg! text-zinc-800! hidden! lg:flex!">Brand Context</Subheading>
        <Text className="mt-1 text-neutral-500!">
          Additional freeform context for your team. Used on all tasks.
        </Text>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4 md:space-y-5">
        <div className="space-y-3 sm:space-y-4 md:space-y-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 shrink-0 rounded-full bg-zinc-100" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 bg-zinc-100" />
              <Skeleton className="h-3 w-36 bg-zinc-100" />
            </div>
          </div>

          {[96, 64, 108, 92, 84].map(width => (
            <div key={width}>
              <Skeleton className="h-4 bg-zinc-100" style={{ width }} />
              <Skeleton className="mt-1.5 h-9 w-full rounded-lg bg-zinc-100" />
            </div>
          ))}
        </div>

        <div>
          <Skeleton className="h-4 w-32 bg-zinc-100" />
          <Skeleton className="mt-1.5 h-32 w-full rounded-lg bg-zinc-100" />
        </div>

        <div className="flex justify-end -mt-0.5">
          <Skeleton className="h-10 w-36 rounded-lg bg-zinc-100" />
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Brand Profile Page
// ---------------------------------------------------------------------------
export default function BrandProfileSettings() {
  const [profile, setProfile] = useState<BrandProfile>({
    company_name: '',
    company_logo_url: null,
    industry: '',
    audience: '',
    tone: '',
    competitors: '',
    additional_context: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [workspaceName, setWorkspaceName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [initialProfile, setInitialProfile] = useState<BrandProfile | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      setSession(session)
      const storedWorkspaceId = getStoredWorkspaceId()
      const headers: Record<string, string> = { 'Authorization': `Bearer ${session.access_token}` }
      if (storedWorkspaceId) headers['x-workspace-id'] = storedWorkspaceId

      Promise.all([
        fetch('/api/brand-profile', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/workspace', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/company-logo', { headers }).then(r => r.json()).catch(() => ({})),
      ])
        .then(([brandData, workspaceData, logoData]) => {
          const workspace = workspaceData as WorkspaceResponse
          const activeWorkspace = workspace.workspaces?.find(w => w.id === workspace.activeWorkspaceId)
          setWorkspaceName(activeWorkspace?.name || '')
          const loadedProfile: BrandProfile = {
            company_name: brandData.brand_profile?.company_name || '',
            company_logo_url:
              activeWorkspace?.company_logo_url || logoData.logoUrl || null,
            industry: brandData.brand_profile?.industry || '',
            audience: brandData.brand_profile?.audience || '',
            tone: brandData.brand_profile?.tone || '',
            competitors: brandData.brand_profile?.competitors || '',
            additional_context:
              brandData.brand_profile?.additional_context || '',
          }

          setProfile(loadedProfile)
          setInitialProfile(loadedProfile)

          setLoading(false)
        })
        .catch(() => setLoading(false))
    })
  }, [])

  const hasChanges =
    initialProfile &&
    JSON.stringify(profile) !== JSON.stringify(initialProfile)

  const handleSave = async () => {
    if (!session) return
    setError('')
    setErrors({})

    const validationResult = onboardingStep2Schema.safeParse({
      companyName: profile.company_name || undefined,
      targetAudience: profile.audience,
      industry: profile.industry,
      competitors: profile.competitors || undefined,
      brandTone: profile.tone,
      additional_context: profile.additional_context || undefined,
    })

    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {}
      for (const err of validationResult.error.issues) {
        const key = err.path?.[0]
        if (key && typeof key === 'string') {
          const mappedKey = key === 'companyName' ? 'company_name'
            : key === 'targetAudience' ? 'audience'
            : key === 'brandTone' ? 'tone'
            : key
          fieldErrors[mappedKey] = err.message
        }
      }
      setErrors(fieldErrors)
      return
    }

    setSaving(true)
    const payload = {
      company_name: profile.company_name,
      industry: profile.industry,
      audience: profile.audience,
      tone: profile.tone,
      competitors: profile.competitors,
      additional_context: profile.additional_context,
    }
    try {
      const storedWorkspaceId = getStoredWorkspaceId()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      }
      if (storedWorkspaceId) headers['x-workspace-id'] = storedWorkspaceId

      const response = await fetch('/api/brand-profile', {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data?.error || 'Something went wrong. Please try again.')
      } else {
        setInitialProfile(profile)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputFields: Array<{ key: BrandProfileFieldKey; label: string; placeholder: string }> = [
    { key: 'company_name', label: 'Company Name', placeholder: 'e.g. Acme Corp' },
    { key: 'industry', label: 'Industry', placeholder: 'e.g. SaaS, E-commerce, Healthcare' },
    { key: 'audience', label: 'Target Audience', placeholder: 'e.g. Small business owners, CTOs at Series A startups' },
    { key: 'tone', label: 'Tone & Voice', placeholder: 'e.g. Professional but conversational, no jargon' },
    { key: 'competitors', label: 'Competitors', placeholder: 'e.g. HubSpot, Salesforce (optional)' },
  ]

  if (loading) {
    return <BrandContextSkeleton />
  }

  return (
    <section className="space-y-3 sm:space-y-4 lg:space-y-5">
      <div>
        <Subheading className="text-lg! text-zinc-800! hidden! lg:flex!">Brand Context</Subheading>
        <Text className="mt-1 text-neutral-500!">
          Additional freeform context for your team. Used on all tasks.
        </Text>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4 md:space-y-5">
        <div className="space-y-3 sm:space-y-4 md:space-y-5">
          <CompanyLogoUpload
            workspaceName={workspaceName}
            logoUrl={profile.company_logo_url}
            onUpdate={(url: string | null) => setProfile(p => ({ ...p, company_logo_url: url }))}
          />
          {inputFields.map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-zinc-700">{f.label}</label>
              <Input
                type="text"
                value={profile[f.key] || ''}
                onChange={e => {
                  setProfile(p => ({ ...p, [f.key]: e.target.value }))
                  setErrors(p => ({ ...p, [f.key]: '' }))
                }}
                placeholder={f.placeholder}
                className="mt-1.5"
              />
              {errors[f.key] && (
                <p className="text-red-500 text-xs mt-1">
                  {errors[f.key]}
                </p>
              )}
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700">Additional Context</label>
          <Textarea
            value={profile.additional_context || ''}
            onChange={e => {
              setProfile(p => ({ ...p, additional_context: e.target.value }))
              setErrors(p => ({ ...p, additional_context: '' }))
            }}
            placeholder="Anything else your team members should always know..."
            className="mt-1.5 h-32!"
          />
          {errors.additional_context && (
            <p className="text-red-500 text-xs mt-1">
              {errors.additional_context}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 -mt-0.5">
          {error ? (
            <p className="text-red-500 text-sm font-medium">{error}</p>
          ) : (
            <div />
          )}
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="w-43 ml-auto"
          >
            {saving ? 'Saving…' : 'Save Brand Profile'}
            <Save className='w-4 h-4'/>
          </Button>
        </div>
      </div>
    </section>
  )
}
