// @ts-nocheck
'use client'
import { Button } from '@/components/button'

export function UpgradeButton({ children, ...props }) {
  return (
    <Button href="/dashboard/settings/billing" {...props}>{children}</Button>
  )
}
