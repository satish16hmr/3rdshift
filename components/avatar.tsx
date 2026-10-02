// @ts-nocheck
'use client'

import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import React, { forwardRef, useState } from 'react'
import { TouchTarget } from './button'
import { Link } from './link'

export function Avatar({ src = null, square = false, initials, alt = '', className, ...props }) {
  const [failedSrc, setFailedSrc] = useState(null)

  const showImage = Boolean(src && src !== failedSrc)
  const showInitials = Boolean(initials && !showImage)
  const showSkeleton = !showInitials && !showImage

  return (
    <span
      data-slot="avatar"
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      {...props}
      className={clsx(
        className,
        // Basic layout
        'inline-grid shrink-0 place-items-center overflow-hidden align-middle [--avatar-radius:20%] *:col-start-1 *:row-start-1',
        'outline -outline-offset-1 outline-black/10 dark:outline-white/10',
        // Border radius
        square ? 'rounded-(--avatar-radius) *:rounded-(--avatar-radius)' : 'rounded-full *:rounded-full'
      )}
    >
      {showInitials && (
        <svg
          className="size-full fill-current p-[5%] text-[48px] font-medium uppercase select-none"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <text x="50%" y="50%" alignmentBaseline="middle" dominantBaseline="middle" textAnchor="middle" dy=".125em">
            {initials}
          </text>
        </svg>
      )}
      {showSkeleton && (
        <span
          aria-hidden="true"
          className="size-full bg-zinc-300 dark:bg-zinc-700 animate-pulse"
        />
      )}
      {showImage && (
        <img
          className="size-full object-cover"
          src={src}
          alt=""
          onError={() => setFailedSrc(src)}
        />
      )}
    </span>
  )
}

export const AvatarButton = forwardRef(function AvatarButton(
  { src, square = false, initials, alt, className, ...props },

  ref
) {
  const classes = clsx(
    className,
    square ? 'rounded-[20%]' : 'rounded-full',
    'relative inline-grid focus:not-data-focus:outline-hidden data-focus:outline-2 data-focus:outline-offset-2 data-focus:outline-blue-500'
  )

  return typeof props.href === 'string' ? (
    <Link {...props} className={classes} ref={ref}>
      <TouchTarget>
        <Avatar src={src} square={square} initials={initials} alt={alt} />
      </TouchTarget>
    </Link>
  ) : (
    <Headless.Button {...props} className={classes} ref={ref}>
      <TouchTarget>
        <Avatar src={src} square={square} initials={initials} alt={alt} />
      </TouchTarget>
    </Headless.Button>
  )
})
