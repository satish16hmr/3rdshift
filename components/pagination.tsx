// @ts-nocheck
'use client'

import clsx from 'clsx'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
  cls?: string
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
  cls
}: PaginationProps) {
  if (totalPages <= 1) return null

  const generatePages = () => {
    const pages = []

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)

      if (currentPage > 3) {
        pages.push('...')
      }

      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push('...')
      }

      pages.push(totalPages)
    }

    return pages
  }

  return (
    <div aria-label="Pagination" role="navigation" className={`items-center gap-1 rounded-md p-1 flex flex-1! overflow-auto mx-auto ${className}`}>
      {generatePages().map((page, idx) => (
        <button
          key={`${page}-${idx}`}
          onClick={() => typeof page === 'number' && onPageChange(page)}
          disabled={page === '...'}
          aria-current={currentPage === page ? 'page' : undefined}
          aria-label={typeof page === 'number' ? `Go to page ${page}` : undefined}
          className={clsx(
            'flex size-8! sm:size-10! shrink-0 items-center justify-center rounded-md text-sm font-medium transition border-none',

            page === '...' && 'cursor-default text-zinc-400',

            typeof page === 'number' &&
            currentPage !== page &&
            'cursor-pointer text-neutral-500 hover:bg-gray-50',

            currentPage === page &&
            'bg-[#FAFAFA] text-[#252B37]',
            cls
          )}
        >
          {page}
        </button>
      ))}
    </div>
  )
}