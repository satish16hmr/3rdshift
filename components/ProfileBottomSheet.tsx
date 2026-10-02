'use client'

import * as Headless from '@headlessui/react'
import { Fragment, useState, useRef, useEffect } from 'react'

interface ProfileBottomSheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  showCloseButton?: boolean
  initialHeight?: 'small' | 'medium' | 'large' | 'full'
  snapPoints?: {
    small: number
    medium: number
    large: number
    full: number
  }
  contentClassName?: string
  className?: string
  resizable?: boolean
  maxHeight?: number
}

const DEFAULT_SNAP_POINTS = {
  small: 40,
  medium: 50,
  large: 75,
  full: 90
}

export function ProfileBottomSheet({
  open,
  onClose,
  children,
  title,
  showCloseButton = true,
  initialHeight = 'medium',
  snapPoints = DEFAULT_SNAP_POINTS,
  contentClassName,
  className,
  resizable = true,
  maxHeight = 95
}: ProfileBottomSheetProps) {
  const activeSnapPoints = snapPoints || DEFAULT_SNAP_POINTS
  const initialSnap = activeSnapPoints[initialHeight] ?? 50
  const initialVh = resizable ? Math.min(initialSnap, maxHeight) : initialSnap
  const [height, setHeight] = useState(initialVh)
  const [isDragging, setIsDragging] = useState(false)

  const isDraggingRef = useRef(false)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)
  const heightRef = useRef(height)
  const prevOpenRef = useRef(open)

  // Keep heightRef in sync
  useEffect(() => {
    heightRef.current = height
  }, [height])

  // Reset to initial default height ONLY when the sheet opens (transition from closed to open)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const snapVal = activeSnapPoints[initialHeight] ?? 50
      const resetVh = resizable ? Math.min(snapVal, maxHeight) : snapVal
      setHeight(resetVh)
    }
    prevOpenRef.current = open
  }, [open, initialHeight, maxHeight, activeSnapPoints, resizable])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!resizable) return
    e.stopPropagation()

    isDraggingRef.current = true
    setIsDragging(true)
    startYRef.current = e.clientY
    startHeightRef.current = heightRef.current

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current) return
      const deltaY = startYRef.current - moveEvent.clientY
      const deltaVh = (deltaY / window.innerHeight) * 100
      let newHeight = startHeightRef.current + deltaVh

      const minHeight = 20
      newHeight = Math.min(maxHeight, Math.max(minHeight, newHeight))
      setHeight(newHeight)
    }

    const handlePointerUp = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      setIsDragging(false)

      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
  }

  return (
    <Headless.Transition show={open} as={Fragment}>
      <Headless.Dialog onClose={onClose} className={`relative z-50 xl:hidden ${className}`}>
        <Headless.TransitionChild
          as={Fragment}
          enter="transition-opacity ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
        </Headless.TransitionChild>

        <div className="fixed inset-x-0 bottom-0">
          <Headless.TransitionChild
            as={Fragment}
            enter="transition-all ease-out duration-300"
            enterFrom="translate-y-full"
            enterTo="translate-y-0"
            leave="transition-all ease-in duration-200"
            leaveFrom="translate-y-0"
            leaveTo="translate-y-full"
          >
            <Headless.DialogPanel
              className="w-full rounded-t-2xl bg-white shadow-2xl"
              style={{
                height: `${height}vh`,
                transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.32, 0.72, 0, 1)'
              }}
            >
              {/* Drag handle */}
              <div
                onPointerDown={onPointerDown}
                className={`w-full pt-3 pb-2 rounded-full transition-colors touch-none select-none ${resizable ? 'cursor-grab active:cursor-grabbing hover:bg-gray-50' : 'cursor-default'
                  }`}
              >
                <div className="w-12 h-1.5 bg-[#E9EAEB] rounded-full mx-auto hover:bg-[#D1D5DB] transition-colors" />
              </div>

              {(title || showCloseButton) && (
                <div className="flex items-center justify-between px-4 pb-3">
                  {title && (
                    <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
                  )}
                </div>
              )}

              <div
                className={contentClassName || "overflow-y-auto"}
                style={{ height: 'calc(100% - 60px)', scrollBehavior: 'smooth' }}
              >
                {children}
              </div>
            </Headless.DialogPanel>
          </Headless.TransitionChild>
        </div>
      </Headless.Dialog>
    </Headless.Transition>
  )
}

export const useBottomSheet = (initialOpen = false) => {
  const [isOpen, setIsOpen] = useState(initialOpen)
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev)
  }
}