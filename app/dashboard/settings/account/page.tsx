'use client'

import { useState, useCallback, useEffect } from 'react'
import type {
  HTMLInputTypeAttribute,
} from 'react'
import { Save } from 'lucide-react'

import { Divider } from '@/components/divider'
import { Subheading } from '@/components/heading'
import { Text } from '@/components/text'
import AvatarUpload from '@/components/AvatarUpload'
import { Input } from '@/components/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/toast-provider'


import { emailSchema, nameSchema, passwordSchema } from '@/src/schema/setting.schema'
import { createClient } from '@/lib/supabase/client'

const MASKED_PASSWORD = '••••••••'

type AccountFieldKey = 'name' | 'email' | 'password' | 'confirmPassword'

type AccountData = {
  name: string
  email: string
  password: string
  avatar_url: string | null
}



type InlineFieldProps = {
  label: string
  value: string
  placeholder?: string
  confirmValue?: string
  type?: HTMLInputTypeAttribute
  fieldKey: AccountFieldKey
  onChange: (field: AccountFieldKey, value: string) => void
  error?: string
  confirmError?: string
}

function InlineField({
  label,
  placeholder,
  confirmValue,
  value,
  type = 'text',
  fieldKey,
  onChange,
  error,
  confirmError
}: InlineFieldProps) {
  return (
    <div className="pt-3 sm:pt-5">
      <label className="block text-sm font-medium text-zinc-700">
        {label}
      </label>

      <div className="mt-1.5">
        {type === 'password' ? (
          <div className="space-y-3 sm:space-y-5">
            <div>
              <Input
                type="password"
                showPasswordToggle
                className="mt-1.5 mb-1"
                placeholder="Current password"
              />
            </div>

            <div>
              <label className="font-medium text-zinc-700 text-sm">
                New Password
              </label>

              <Input
                type="password"
                showPasswordToggle
                placeholder="New password"
                value={value}
                onChange={(e) => onChange(fieldKey, e.target.value)}
                className="mt-1.5 mb-1"
              />

              {error && (
                <span className="text-sm text-red-500">
                  {error}
                </span>
              )}
            </div>

            <div>
              <label className="font-medium text-zinc-700 text-sm">
                Confirm Password
              </label>

              <Input
                type="password"
                showPasswordToggle
                placeholder="Confirm new password"
                value={confirmValue}
                onChange={(e) =>
                  onChange('confirmPassword', e.target.value)
                }
                className="mt-1.5 mb-1"
              />

              {confirmError && (
                <span className="text-sm text-red-500">
                  {confirmError}
                </span>
              )}
            </div>
          </div>
        ) : (
          <>
            <Input
              type={type}
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(fieldKey, e.target.value)}
              className="mt-1.5 mb-1"
            />

            {error && (
              <span className="text-sm text-red-500">
                {error}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function AccountInformationSkeleton() {
  return (
    <section className="space-y-3 sm:space-y-4 lg:space-y-5" aria-busy="true">
      <div>
        <Subheading className="text-lg! text-zinc-800! hidden! lg:flex!">Account Information</Subheading>
        <Text className="mt-1 text-neutral-500!">
          Your personal account information and login credentials.
        </Text>
      </div>
      <div className="rounded-xl border border-zinc-950/[0.08] bg-white p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 shrink-0 rounded-full bg-zinc-100" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 bg-zinc-100" />
            <Skeleton className="h-3 w-72 max-w-[60vw] bg-zinc-100" />
          </div>
        </div>

        <div className="pt-3 sm:pt-8">
          <Skeleton className="h-4 w-20 bg-zinc-100" />
          <Skeleton className="mt-1.5 h-9 w-full rounded-lg bg-zinc-100" />
        </div>

        <div className="pt-3 sm:pt-8">
          <Skeleton className="h-4 w-28 bg-zinc-100" />
          <Skeleton className="mt-1.5 h-9 w-full rounded-lg bg-zinc-100" />
        </div>

        <div className="pt-3 sm:pt-8">
          <Skeleton className="h-4 w-20 bg-zinc-100" />
          <Skeleton className="mt-1.5 h-9 w-full rounded-lg bg-zinc-100" />
        </div>

        <div className="space-y-3 pt-3 sm:space-y-5 sm:pt-5">
          <div>
            <Skeleton className="h-4 w-24 bg-zinc-100" />
            <Skeleton className="mt-1.5 h-9 w-full rounded-lg bg-zinc-100" />
          </div>
          <div>
            <Skeleton className="h-4 w-32 bg-zinc-100" />
            <Skeleton className="mt-1.5 h-9 w-full rounded-lg bg-zinc-100" />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end">
          <Skeleton className="h-9 w-20 rounded-lg bg-zinc-100" />
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Account Settings Page
// ---------------------------------------------------------------------------
export default function AccountSettings() {
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AccountData>({
    name: '',
    email: '',
    password: MASKED_PASSWORD,
    avatar_url: null,
  })
  const [draftData, setDraftData] = useState<Record<AccountFieldKey, string>>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  const [errors, setErrors] = useState<Partial<Record<AccountFieldKey, string>>>({})

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    const loadAccountData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .single()

        if (!mounted) return

        const nextData = {
          name: profileData?.full_name || user.user_metadata?.full_name || '',
          email: user.email || '',
          password: MASKED_PASSWORD,
          avatar_url: profileData?.avatar_url || null,
        }

        setData(nextData)
        setDraftData({
          name: nextData.name,
          email: nextData.email,
          password: '',
          confirmPassword: ''
        })
      } catch (err) {
        console.error('Account settings load error:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadAccountData()

    return () => {
      mounted = false
    }
  }, [])

  const handleSave = useCallback(
    async (key: AccountFieldKey, value: string) => {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      try {
        let savedValue = value

        if (key === 'name') {
          nameSchema.parse(value)

          const {
            data: { session },
          } = await supabase.auth.getSession()

          if (!session) throw new Error('Not authenticated')

          const res = await fetch('/api/profile/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              full_name: value,
            }),
          })

          if (!res.ok) {
            const e = await res.json().catch(() => ({}))
            throw new Error(e.error || 'Save failed')
          }
        } else if (key === 'email') {
          const email = emailSchema.parse(value).trim()
          savedValue = email

          const { error } = await supabase.auth.updateUser({
            email,
          })

          if (error) throw error

          const {
            data: { session },
          } = await supabase.auth.getSession()

          if (!session) throw new Error('Not authenticated')

          const res = await fetch('/api/account/email-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ email }),
          })

          if (!res.ok) {
            const e = await res.json().catch(() => ({}))
            throw new Error(e.error || 'Email sync failed')
          }
        } else if (key === 'password') {
          passwordSchema.parse(value)

          const { error } = await supabase.auth.updateUser({
            password: value,
          })

          if (error) throw error
        }

        setData((prev) => ({
          ...prev,
          [key]: key === 'password' ? MASKED_PASSWORD : savedValue,
        }))
      } catch (err) {
        console.error('Account settings save error:', err)
        throw err
      }
    },
    []
  )

  const handleDraftChange = useCallback(
    (key: AccountFieldKey, value: string) => {
      setDraftData((prev) => ({
        ...prev,
        [key]: value,
      }))

      setErrors((prev) => ({
        ...prev,
        [key]: undefined,
      }))
    },
    []
  )

  const handleSaveAll = useCallback(async () => {
    if (saving) return

    const newErrors: Partial<Record<AccountFieldKey, string>> = {}

    if (draftData.name !== data.name) {
      const result = nameSchema.safeParse(draftData.name)

      if (!result.success) {
        newErrors.name = result.error.issues[0]?.message
      }
    }

    if (draftData.email !== data.email) {
      const result = emailSchema.safeParse(draftData.email)

      if (!result.success) {
        newErrors.email = result.error.issues[0]?.message
      }
    }

    if (draftData.password) {
      const result = passwordSchema.safeParse(draftData.password)

      if (!result.success) {
        newErrors.password = result.error.issues[0]?.message
      }
    }

    if (
      draftData.password &&
      draftData.password !== draftData.confirmPassword
    ) {
      newErrors.confirmPassword =
        'Confirm password must match new password'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})

    const updates: Array<[AccountFieldKey, string]> = []

    if (draftData.name !== data.name) updates.push(['name', draftData.name])
    if (draftData.email !== data.email) updates.push(['email', draftData.email])
    if (draftData.password) updates.push(['password', draftData.password])

    if (updates.length === 0) return

    setSaving(true)
    try {
      for (const [key, value] of updates) {
        await handleSave(key, value)
      }

      setDraftData((prev) => ({
        ...prev,
        name: updates.find(([key]) => key === 'name')?.[1] ?? prev.name,
        email: updates.find(([key]) => key === 'email')?.[1] ?? prev.email,
        password: updates.find(([key]) => key === 'password')?.[1] ?? prev.password,
      }))
      showToast({ title: 'Saved successfully', variant: 'success' })
    } catch {
      showToast({ title: 'Save failed — please try again', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }, [data.email, data.name, draftData.confirmPassword, draftData.email, draftData.name, draftData.password, handleSave, saving, showToast])

  const hasChanges =
    draftData.name !== data.name ||
    draftData.email !== data.email ||
    draftData.password.length > 0

  // Compute initials
  const initials = data.name
    ? (() => {
      const parts = data.name.trim().split(' ').filter(Boolean)
      return parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : data.name.slice(0, 2).toUpperCase()
    })()
    : data.email
      ? data.email.slice(0, 2).toUpperCase()
      : '??'

  return (
    <div>


      {/* ═══════ ACCOUNT INFORMATION ═══════ */}
      {loading ? (
        <AccountInformationSkeleton />
      ) : (
         <section className="space-y-3 sm:space-y-4 lg:space-y-5">
        <div>
          <Subheading className="text-lg! text-zinc-800! hidden! lg:flex!">Account Information</Subheading>
          <Text className="mt-1 text-neutral-500!">
            Your personal account information and login credentials.
          </Text>
        </div>
        <div className="rounded-xl border border-zinc-950/[0.08] bg-white p-4 sm:p-6">
          <AvatarUpload
            initials={initials}
            avatarUrl={data.avatar_url}
            onUpdate={(url: string | null) => setData(prev => ({ ...prev, avatar_url: url }))}
          />
          <InlineField
            label="Full Name"
            placeholder="Full Name"
            value={draftData.name}
            fieldKey="name"
            onChange={handleDraftChange}
            error={errors.name}
          />

          <InlineField
            label="Email Address"
            placeholder="Email Address"
            value={draftData.email}
            type="email"
            fieldKey="email"
            onChange={handleDraftChange}
            error={errors.email}
          />

          <InlineField
            label="Password"
            value={draftData.password}
            confirmValue={draftData.confirmPassword}
            type="password"
            fieldKey="password"
            onChange={handleDraftChange}
            error={errors.password}
            confirmError={errors.confirmPassword}
          />
          <div className="mt-5 flex items-center justify-end">
            <Button
              variant="primary"
              disabled={!hasChanges || saving}
              onClick={handleSaveAll}
            >
              {saving ? 'Saving...' : 'Save'} <Save />
            </Button>
          </div>
        </div>
      </section>
      )}

      <Divider soft />
    </div>
  )
}
