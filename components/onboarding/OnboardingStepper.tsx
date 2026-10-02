'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface OnboardingStepperProps {
  currentStep?: number
  totalSteps?: number
  buttonText: string
  loading?: boolean
  onSubmit?: () => void
  onBack?: () => void
  disabled?: boolean
  showBack?: boolean
  className?: string
}

export default function OnboardingStepper({
  currentStep = 2,
  totalSteps = 3,
  buttonText,
  loading = false,
  onSubmit,
  onBack,
  disabled = false,
  showBack = true,
  className
}: OnboardingStepperProps) {
  const router = useRouter()

  return (
    <div className="flex flex-wrap min-[390px]:flex-nowrap gap-4 items-center justify-between pt-10 pb-4 md:py-6">
     {showBack ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => (onBack ? onBack() : router.back())}
        >
          <ArrowLeft className='size-4' />
          <span className='hidden lg:flex'>Back</span>
        </Button>
      ) : (
        <div /> // keeps layout balanced
      )}

      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            className={`h-2 w-2 rounded-full ${index + 1 === currentStep
              ? 'bg-blue-600'
              : 'bg-zinc-300'
              }`}
          />
        ))}
      </div>

      <Button
        onClick={onSubmit}
        disabled={loading || disabled}
        variant="primary"
        className={`flex items-center gap-2 hover:scale-100! ${loading && "text-gray-300"} ${className}`}
      >
        {loading && (
          <div className="h-4 w-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        )}

        {loading ? 'Saving...' : buttonText}
      </Button>
    </div>
  )
}