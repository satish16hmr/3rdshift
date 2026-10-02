// @ts-nocheck
'use client'

import React, { forwardRef, useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import clsx from 'clsx'

/** Parse <option> / <optgroup> children into a flat options list */
function parseOptions(children: React.ReactNode): { label: string; value: string; disabled?: boolean }[] {
  const opts: { label: string; value: string; disabled?: boolean }[] = []
  React.Children.forEach(children, (child: any) => {
    if (!child) return
    if (child.type === 'option') {
      opts.push({
        label: child.props.children ?? child.props.value,
        value: child.props.value,
        disabled: child.props.disabled,
      })
    } else if (child.type === 'optgroup') {
      React.Children.forEach(child.props.children, (opt: any) => {
        if (!opt) return
        opts.push({
          label: opt.props.children ?? opt.props.value,
          value: opt.props.value,
          disabled: opt.props.disabled,
        })
      })
    }
  })
  return opts
}

function getScrollableParents(node: HTMLElement | null): HTMLElement[] {
  const parents: HTMLElement[] = []
  let current = node
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current)
    const overflowY = style.overflowY || style.overflow
    if (overflowY === 'auto' || overflowY === 'scroll') {
      parents.push(current)
    }
    current = current.parentElement
  }
  parents.push(document.body)
  parents.push(document.documentElement)
  return parents
}

export const Select = forwardRef(function Select(
  {
    className,
    multiple,
    arrowDown = false,
    value,
    defaultValue,
    onChange,
    children,
    placeholder,
    disabled,
    check = true,
    ...props
  }: any,
  _ref
) {
  const options = parseOptions(children)

  // Controlled or uncontrolled value
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = useState(defaultValue ?? '')
  const currentValue = isControlled ? value : internalValue

  const [open, setOpen] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const [highlightedIdx, setHighlightedIdx] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const lockedParentsRef = useRef<Map<HTMLElement, { overflowY: string; paddingRight: string }>>(new Map())
  const isKeyboardNavRef = useRef(false)

  const restoreScroll = () => {
    lockedParentsRef.current.forEach((original, el) => {
      el.style.overflowY = original.overflowY
      el.style.paddingRight = original.paddingRight
    })
    lockedParentsRef.current.clear()
  }

  useEffect(() => {
    if (open && containerRef.current) {
      const scrollableParents = getScrollableParents(containerRef.current)
      scrollableParents.forEach(el => {
        let scrollbarWidth = 0
        if (el === document.body) {
          scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
        } else if (el !== document.documentElement) {
          const style = window.getComputedStyle(el)
          const borderLeft = parseFloat(style.borderLeftWidth || '0')
          const borderRight = parseFloat(style.borderRightWidth || '0')
          scrollbarWidth = el.offsetWidth - el.clientWidth - borderLeft - borderRight
        }

        lockedParentsRef.current.set(el, {
          overflowY: el.style.overflowY,
          paddingRight: el.style.paddingRight,
        })

        el.style.setProperty('overflow-y', 'hidden', 'important')
        if (scrollbarWidth > 0) {
          const computedPaddingRight = parseFloat(window.getComputedStyle(el).paddingRight || '0')
          el.style.setProperty('padding-right', `${computedPaddingRight + scrollbarWidth}px`, 'important')
        }
      })
    } else {
      restoreScroll()
    }

    return () => {
      restoreScroll()
    }
  }, [open])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open && highlightedIdx >= 0 && listRef.current && isKeyboardNavRef.current) {
      const listEl = listRef.current
      const itemEl = listEl.children[highlightedIdx] as HTMLElement
      if (itemEl) {
        const itemTop = itemEl.offsetTop
        const itemBottom = itemTop + itemEl.offsetHeight
        const listTop = listEl.scrollTop
        const listBottom = listTop + listEl.clientHeight

        if (itemTop < listTop) {
          listEl.scrollTop = itemTop
        } else if (itemBottom > listBottom) {
          listEl.scrollTop = itemBottom - listEl.clientHeight
        }
      }
    }
  }, [highlightedIdx, open])

  // Reset highlight when opening
  const handleOpen = () => {
    if (disabled) return

    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const DROPDOWN_HEIGHT = 240
      setDropUp(spaceBelow < DROPDOWN_HEIGHT && spaceAbove > spaceBelow)
    }

    const selectedIdx = options.findIndex(o => String(o.value) === String(currentValue))
    isKeyboardNavRef.current = false
    setHighlightedIdx(selectedIdx >= 0 ? selectedIdx : 0)
    setOpen(p => !p)
  }

  const handleSelect = (optValue: string) => {
    if (!isControlled) setInternalValue(optValue)
    // Fire native-like onChange with a synthetic event
    if (onChange) {
      onChange({ target: { value: optValue } } as any)
    }
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        isKeyboardNavRef.current = true
        handleOpen()
      }
      return
    }
    const enabledIdxs = options
      .map((o, i) => (!o.disabled ? i : -1))
      .filter(i => i >= 0)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      isKeyboardNavRef.current = true
      const next = enabledIdxs.find(i => i > highlightedIdx) ?? enabledIdxs[0]
      setHighlightedIdx(next)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      isKeyboardNavRef.current = true
      const prev = [...enabledIdxs].reverse().find(i => i < highlightedIdx) ?? enabledIdxs[enabledIdxs.length - 1]
      setHighlightedIdx(prev)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (highlightedIdx >= 0 && !options[highlightedIdx]?.disabled) {
        handleSelect(options[highlightedIdx].value)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const selectedLabel = options.find(o => String(o.value) === String(currentValue))?.label

  return (
    <div
      ref={containerRef}
      className={clsx('group relative block w-full', open && 'z-[100]', className)}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger button — matches Input / Listbox look */}
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={handleOpen}
        className={clsx(
          "cursor-pointer",
          // Layout
          'relative flex w-full h-9 items-center rounded-lg px-3 py-1.5 pr-8',
          // Typography
          'text-left text-sm',
          selectedLabel ? 'text-zinc-900 dark:text-white font-medium' : 'text-zinc-500',
          // Border
          'border border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800',
          // Focus ring
          'outline-none focus:ring-2 focus:ring-blue-500',
          // Disabled
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        {...props}
      >
        <span className="relative block truncate">
          {selectedLabel ?? placeholder ?? 'Select…'}
        </span>
      </button>

      {/* Chevron icon */}
      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
        <ChevronDown
          className={clsx(
            'size-4 stroke-zinc-500 transition-transform duration-150',
            open && 'rotate-180',
            'dark:stroke-zinc-400'
          )}
        />
      </span>

      {/* Dropdown panel — matches Listbox / SendToDropdown */}
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className={clsx(
            // Positioning
            'absolute left-0 right-0 z-[100]',
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1',
            // Layout
            'max-h-43 overflow-y-auto overscroll-contain scroll-py-1',
            // Visual
            'rounded-xl bg-white dark:bg-zinc-800 p-1',
            'shadow-lg border border-zinc-200 dark:border-zinc-700',
            // Animation
            'animate-in fade-in-0 zoom-in-95 duration-100',
          )}
        >
          {options.map((opt, idx) => {
            const isSelected = String(opt.value) === String(currentValue)
            const isHighlighted = idx === highlightedIdx
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled}
                onMouseEnter={() => {
                  isKeyboardNavRef.current = false
                  if (!opt.disabled) setHighlightedIdx(idx)
                }}
                onMouseLeave={() => setHighlightedIdx(-1)}
                onClick={() => !opt.disabled && handleSelect(opt.value)}
                className={clsx(
                  // Layout
                  'flex items-center gap-x-2',
                  'rounded-lg py-1.5 px-2.5 cursor-pointer',
                  // Typography
                  'text-sm',
                  // States
                  isHighlighted
                    ? 'bg-blue-50 text-blue-500'
                    : 'text-zinc-950 dark:text-white',
                  opt.disabled && 'opacity-50 cursor-not-allowed',
                )}
              >
                {/* Checkmark column */}
                {
                  check && (
                    <Check
                      className={clsx(
                        'size-4 shrink-0 text-blue-500',
                        isSelected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  )
                }
                <span className={`truncate ${isSelected && "text-blue-500"}`}>{opt.label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
})
