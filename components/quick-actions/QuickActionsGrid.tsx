'use client'

import { useState } from 'react'
import { Subheading } from '@/components/heading'
import { getDefaultQuickActions } from '@/lib/quick-actions'
import { QuickActionCard } from '@/components/quick-actions/QuickActionCard'
import { QuickActionsModal } from '@/components/quick-actions/QuickActionsModal'
import { Button } from '../ui/button'

const DEFAULT_ACTIONS = getDefaultQuickActions()

export function QuickActionsGrid() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Subheading className="text-zinc-500! text-sm!">Quick Actions</Subheading>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="shrink-0 text-sm font-medium text-neutral-500 shadow-none bg-transparent! hover:bg-transparent! hover:text-blue-500! border-0!"
        >
          See all Actions →
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 grid-section">
        {DEFAULT_ACTIONS.map((action) => (
          <QuickActionCard key={`${action.action}-${action.slug}`} action={action} />
        ))}
      </div>
      <QuickActionsModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </section>
  )
}
