'use client'

import React, { useState, useEffect } from 'react'

import Calendar from 'react-calendar'
import * as Popover from '@radix-ui/react-popover'
import * as Headless from '@headlessui/react'
import { format, isValid } from 'date-fns'
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/select'

interface SchedulePickerProps {
  value: string
  onChange: (value: string) => void
  customTrigger?: React.ReactNode
  onTriggerClick?: () => void
  selectRange?: boolean
  useMobileDialog?: boolean
}

interface PickerContentProps {
  selectRange?: boolean
  activeStartDate: Date
  tempDate: Date | null
  tempDateRange: [Date | null, Date | null]
  hour: string
  minute: string
  ampm: 'AM' | 'PM'
  onPrevMonth: () => void
  onNextMonth: () => void
  onActiveStartDateChange: (date: Date) => void
  onDayClick: (date: Date) => void
  onCalendarChange: (val: any) => void
  onHourChange: (val: string) => void
  onMinuteChange: (val: string) => void
  onAmpmToggle: () => void
  onApply: () => void
  onCancel: () => void
}

function PickerContent({
  selectRange,
  activeStartDate,
  tempDate,
  tempDateRange,
  hour,
  minute,
  ampm,
  onPrevMonth,
  onNextMonth,
  onActiveStartDateChange,
  onDayClick,
  onCalendarChange,
  onHourChange,
  onMinuteChange,
  onAmpmToggle,
  onApply,
  onCancel,
}: PickerContentProps) {
  return (
    <div className="flex flex-col gap-4 schedule-picker-container">
      {/* Month Navigation Row */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-500 transition-colors flex items-center justify-center cursor-pointer"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold text-zinc-900">
          {format(activeStartDate, 'MMMM yyyy')}
        </span>
        <button
          type="button"
          onClick={onNextMonth}
          className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-500 transition-colors flex items-center justify-center cursor-pointer"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Date Input Display */}
      <div>
        {selectRange ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              placeholder="Start Date"
              value={tempDateRange[0] ? format(tempDateRange[0], 'MMM dd, yyyy') : ''}
              className="h-10 w-1/2 px-3 py-2 rounded-lg border border-zinc-200 bg-white text-base text-zinc-800 focus:outline-hidden text-center select-none"
            />
            <span className="text-zinc-400">—</span>
            <input
              type="text"
              readOnly
              placeholder="End Date"
              value={tempDateRange[1] ? format(tempDateRange[1], 'MMM dd, yyyy') : ''}
              className="h-10 w-1/2 px-3 py-2 rounded-lg border border-zinc-200 bg-white text-base text-zinc-800 focus:outline-hidden text-center select-none"
            />
          </div>
        ) : (
          <input
            type="text"
            readOnly
            value={tempDate ? format(tempDate, 'MMM dd, yyyy') : 'No date selected'}
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-base text-zinc-800 focus:outline-hidden text-center select-none"
          />
        )}
      </div>

      {/* Calendar Grid */}
      <div className="schedule-picker-calendar">
        <Calendar
          showNavigation={false}
          activeStartDate={activeStartDate}
          onActiveStartDateChange={({ activeStartDate }) =>
            activeStartDate && onActiveStartDateChange(activeStartDate)
          }
          selectRange={selectRange}
          onChange={selectRange ? onCalendarChange : undefined}
          onClickDay={selectRange ? undefined : onDayClick}
          value={
            selectRange
              ? tempDateRange[0]
                ? tempDateRange[1]
                  ? tempDateRange
                  : tempDateRange[0]
                : null
              : tempDate
          }
          calendarType="iso8601"
          locale="en-US"
          showNeighboringMonth={true}
          formatShortWeekday={(locale, date) => format(date, 'EEEEEE')}
        />
      </div>

      {/* Time Picker */}
      {!selectRange && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-zinc-800">Time</span>
          <div className="flex items-center gap-1.5">
            <Select
              check={false}
              value={hour}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onHourChange(e.target.value)}
              className="w-14 text-center text-xs font-semibold"
            >
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </Select>
            <Select
              check={false}
              value={minute}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onMinuteChange(e.target.value)}
              className="w-14 text-center text-xs font-semibold"
            >
              {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
            <button
              type="button"
              onClick={onAmpmToggle}
              className="border border-zinc-300 rounded-lg px-3.5 py-2.5 text-xs text-center w-14 bg-white hover:bg-zinc-50 cursor-pointer font-bold text-zinc-700 focus:outline-hidden"
            >
              {ampm}
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-4 border-t border-zinc-100">
        <Button onClick={onCancel} variant="outline" className="bg-white">
          Cancel
        </Button>
        <Button onClick={onApply} variant="primary">
          Apply
        </Button>
      </div>
    </div>
  )
}

export default function SchedulePicker({
  value,
  onChange,
  customTrigger,
  onTriggerClick,
  selectRange,
  useMobileDialog = false,
}: SchedulePickerProps) {
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [activeStartDate, setActiveStartDate] = useState<Date>(() => new Date())

  const [tempDate, setTempDate] = useState<Date | null>(null)
  const [tempDateRange, setTempDateRange] = useState<[Date | null, Date | null]>([null, null])
  const [hour, setHour] = useState('12')
  const [minute, setMinute] = useState('00')
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM')

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Sync internal state when external value changes
  useEffect(() => {
    if (value) {
      if (selectRange) {
        const parts = value.split(',')
        const start = parts[0] ? new Date(parts[0]) : null
        const end = parts[1] ? new Date(parts[1]) : null
        setTempDateRange([
          start && isValid(start) ? start : null,
          end && isValid(end) ? end : null,
        ])
        if (start && isValid(start)) setActiveStartDate(start)
        return
      }

      const parsed = new Date(value)
      if (isValid(parsed)) {
        setTempDate(parsed)
        setActiveStartDate(parsed)
        let hrs = parsed.getHours()
        const mins = parsed.getMinutes()
        const ampmVal = hrs >= 12 ? 'PM' : 'AM'
        setAmpm(ampmVal)
        hrs = hrs % 12
        hrs = hrs ? hrs : 12
        setHour(String(hrs).padStart(2, '0'))
        setMinute(String(mins).padStart(2, '0'))
        return
      }
    }

    if (selectRange) {
      setTempDateRange([null, null])
    } else {
      setTempDate(null)
      setHour('12')
      setMinute('00')
      setAmpm('AM')
    }
    setActiveStartDate(new Date())
  }, [value, selectRange])

  const handlePrevMonth = () => {
    setActiveStartDate((prev) => {
      const d = new Date(prev)
      d.setMonth(d.getMonth() - 1)
      return d
    })
  }

  const handleNextMonth = () => {
    setActiveStartDate((prev) => {
      const d = new Date(prev)
      d.setMonth(d.getMonth() + 1)
      return d
    })
  }

  const handleApply = () => {
    if (selectRange) {
      const [start, end] = tempDateRange
      if (start && end) {
        onChange(`${start.toISOString()},${end.toISOString()}`)
      } else if (start) {
        onChange(`${start.toISOString()},${start.toISOString()}`)
      } else {
        onChange('')
      }
      setOpen(false)
      return
    }

    if (!tempDate) {
      onChange('')
      setOpen(false)
      return
    }

    let hrs = parseInt(hour, 10)
    if (ampm === 'PM' && hrs < 12) hrs += 12
    if (ampm === 'AM' && hrs === 12) hrs = 0
    const mins = parseInt(minute, 10)

    const finalDate = new Date(tempDate)
    finalDate.setHours(hrs, mins, 0, 0)

    if (isValid(finalDate)) onChange(finalDate.toISOString())
    setOpen(false)
  }

  const handleCancel = () => setOpen(false)

  const handleDayClick = (clickedDate: Date) => {
    if (
      tempDate &&
      tempDate.getDate() === clickedDate.getDate() &&
      tempDate.getMonth() === clickedDate.getMonth() &&
      tempDate.getFullYear() === clickedDate.getFullYear()
    ) {
      setTempDate(null)
    } else {
      setTempDate(clickedDate)
    }
  }

  const handleCalendarChange = (val: any) => {
    if (Array.isArray(val)) {
      setTempDateRange([val[0], val[1]])
    } else if (val instanceof Date) {
      setTempDateRange([val, null])
    } else {
      setTempDateRange([null, null])
    }
  }

  const getTriggerText = () => {
    if (!value) return 'Select date'
    if (selectRange) {
      const parts = value.split(',')
      const start = parts[0] ? new Date(parts[0]) : null
      const end = parts[1] ? new Date(parts[1]) : null
      if (start && isValid(start) && end && isValid(end)) {
        return `${format(start, 'MMM dd, yyyy')} - ${format(end, 'MMM dd, yyyy')}`
      }
      return 'Select range'
    }
    const d = new Date(value)
    if (!isValid(d)) return 'Select date'
    return format(d, 'MMM dd, yyyy, hh:mm a')
  }

  const pickerProps: PickerContentProps = {
    selectRange,
    activeStartDate,
    tempDate,
    tempDateRange,
    hour,
    minute,
    ampm,
    onPrevMonth: handlePrevMonth,
    onNextMonth: handleNextMonth,
    onActiveStartDateChange: setActiveStartDate,
    onDayClick: handleDayClick,
    onCalendarChange: handleCalendarChange,
    onHourChange: setHour,
    onMinuteChange: setMinute,
    onAmpmToggle: () => setAmpm((prev) => (prev === 'AM' ? 'PM' : 'AM')),
    onApply: handleApply,
    onCancel: handleCancel,
  }

  const defaultTrigger = (
    <button
      type="button"
      className="w-full flex items-center justify-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold border border-zinc-300 bg-white rounded-lg text-zinc-600 hover:text-zinc-800 hover:border-zinc-300 shadow-2xs transition-all duration-200 cursor-pointer"
    >
      <CalendarPlus className="size-4 text-zinc-700" />
      <span className="text-sm text-zinc-700">{getTriggerText()}</span>
    </button>
  )

  const shouldShowMobileDialog = isMobile && useMobileDialog

  const triggerElement = customTrigger ? (
    React.cloneElement(customTrigger as React.ReactElement<any>, {
      onClick: (e: any) => {
        const childProps = (customTrigger as any).props
        if (childProps.onClick) childProps.onClick(e)
        onTriggerClick?.()
        if (shouldShowMobileDialog) setOpen(true)
      },
    })
  ) : (
    React.cloneElement(defaultTrigger as React.ReactElement<any>, {
      onClick: () => {
        if (shouldShowMobileDialog) setOpen(true)
      },
    })
  )

  return (
    <div className="relative w-fit schedule-picker-container">
      {shouldShowMobileDialog ? (
        <>
          {triggerElement}
          <Headless.Dialog open={open} onClose={() => setOpen(false)}>
            <Headless.DialogBackdrop
              transition
              className="fixed z-100 inset-0 bg-zinc-950/70 transition duration-100 data-closed:opacity-0 data-enter:ease-out data-leave:ease-in dark:bg-zinc-950/50"
            />
            <div className="fixed inset-0 w-screen z-110 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Headless.DialogPanel
                  transition
                  className="w-[92%] max-w-sm bg-white p-4 sm:p-5 shadow-lg ring-1 ring-zinc-950/10 rounded-2xl dark:bg-zinc-900 dark:ring-white/10 overflow-hidden transition duration-100 data-closed:scale-95 data-closed:opacity-0 data-enter:ease-out data-leave:ease-in"
                >
                  <PickerContent {...pickerProps} />
                </Headless.DialogPanel>
              </div>
            </div>
          </Headless.Dialog>
        </>
      ) : (
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>{triggerElement}</Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="z-110 relative max-[330px]:left-[5%]! max-lg:left-[5%]! bg-white border border-zinc-200 rounded-2xl shadow-xl p-4 sm:p-5 w-[calc(100vw-32px)] max-w-82.25 focus:outline-hidden"
              align="center"
              sideOffset={8}
            >
              <PickerContent {...pickerProps} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  )
}