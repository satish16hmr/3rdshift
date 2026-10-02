// @ts-nocheck
import React, { forwardRef } from 'react'
import { useState } from 'react'
import clsx from 'clsx'
import * as Headless from '@headlessui/react'
import { Eye, EyeOff } from 'lucide-react'

type InputGroupProps = {
  children: React.ReactNode
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  className?: string
  showPasswordToggle?: boolean
  error?: React.ReactNode
}

export function InputGroup({ children }: InputGroupProps) {
  return (
    <span
      data-slot="control"
      className={clsx(
        'relative isolate block',
        'has-[[data-slot=icon]:first-child]:[&_input]:pl-10 has-[[data-slot=icon]:last-child]:[&_input]:pr-10 sm:has-[[data-slot=icon]:first-child]:[&_input]:pl-8 sm:has-[[data-slot=icon]:last-child]:[&_input]:pr-8',
        '*:data-[slot=icon]:pointer-events-none *:data-[slot=icon]:absolute *:data-[slot=icon]:top-3 *:data-[slot=icon]:z-10 *:data-[slot=icon]:size-5 sm:*:data-[slot=icon]:top-2.5 sm:*:data-[slot=icon]:size-4',
        '[&>[data-slot=icon]:first-child]:left-3 sm:[&>[data-slot=icon]:first-child]:left-2.5 [&>[data-slot=icon]:last-child]:right-3 sm:[&>[data-slot=icon]:last-child]:right-2.5',
        '*:data-[slot=icon]:text-zinc-500 dark:*:data-[slot=icon]:text-zinc-400'
      )}
    >
      {children}
    </span>
  )
}

const dateTypes = ['date', 'datetime-local', 'month', 'time', 'week']

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    showPasswordToggle = false,
    type,
    error,
    ...props
  },

  ref
) {
  const [showPassword, setShowPassword] = useState(false)

  const isPasswordInput =
    type === 'password' && showPasswordToggle
  return (
    <>
      <span
        data-slot="control"
        className={clsx([
          className,
          'relative block w-full',
          'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm',
          'dark:before:hidden',
          'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500',
          'has-data-disabled:opacity-50 has-data-disabled:before:bg-zinc-950/5 has-data-disabled:before:shadow-none',
        ])}
      >
        <Headless.Input
          ref={ref}
          {...props}
          type={
            isPasswordInput
              ? showPassword
                ? 'text'
                : 'password'
              : type
          }
          className={clsx([
            props.type &&
            dateTypes.includes(props.type) && [
              '[&::-webkit-datetime-edit-fields-wrapper]:p-0',
              '[&::-webkit-date-and-time-value]:min-h-[1.5em]',
              '[&::-webkit-datetime-edit]:inline-flex',
              '[&::-webkit-datetime-edit]:p-0',
              '[&::-webkit-datetime-edit-year-field]:p-0',
              '[&::-webkit-datetime-edit-month-field]:p-0',
              '[&::-webkit-datetime-edit-day-field]:p-0',
              '[&::-webkit-datetime-edit-hour-field]:p-0',
              '[&::-webkit-datetime-edit-minute-field]:p-0',
              '[&::-webkit-datetime-edit-second-field]:p-0',
              '[&::-webkit-datetime-edit-millisecond-field]:p-0',
              '[&::-webkit-datetime-edit-meridiem-field]:p-0',
            ],

            'relative block w-full appearance-none rounded-lg px-[calc(--spacing(3.5)-1px)] sm:px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)]',

            // extra right padding only when eye exists
            isPasswordInput &&
            'pr-10 sm:pr-8',
            error &&
            'border-red-500 focus:border-red-500',
            'border border-zinc-950/10',
            'text-zinc-950 placeholder:text-zinc-500 text-sm/6 dark:text-white',
            'border border-zinc-300 data-hover:border-zinc-950/20 dark:border-white/10 dark:data-hover:border-white/20',
            'bg-transparent dark:bg-white/5',
            'focus:outline-hidden',
            'data-invalid:border-red-500 data-invalid:data-hover:border-red-500 dark:data-invalid:border-red-600 dark:data-invalid:data-hover:border-red-600',
            'data-disabled:border-zinc-950/20 dark:data-disabled:border-white/15 dark:data-disabled:bg-white/2.5 dark:data-hover:data-disabled:border-white/15',
            'dark:scheme-dark',
          ])}
        />

        {isPasswordInput && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
          >
            {showPassword ? (
              <EyeOff className="size-5 sm:size-4" />
            ) : (
              <Eye className="size-5 sm:size-4" />
            )}
          </button>
        )}
      </span>
      {error && (
        <p className="mt-1 text-sm text-red-500">
          {error}
        </p>
      )}
    </>
  )
})
