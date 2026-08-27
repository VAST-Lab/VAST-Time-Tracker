'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  addDays, subDays, isSameDay, isWithinInterval, isBefore, isAfter, startOfYear, 
  endOfYear, subYears, startOfToday, differenceInDays, parseISO, isSameMonth
} from 'date-fns'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onChange: (start: string, end: string) => void
}

const presets = [
  { label: 'Today', get: () => ({ s: startOfToday(), e: startOfToday() }) },
  { label: 'Yesterday', get: () => ({ s: subDays(startOfToday(), 1), e: subDays(startOfToday(), 1) }) },
  { label: 'This week', get: () => ({ s: startOfWeek(startOfToday()), e: endOfWeek(startOfToday()) }) },
  { label: 'Last week', get: () => ({ s: startOfWeek(subDays(startOfToday(), 7)), e: endOfWeek(subDays(startOfToday(), 7)) }) },
  { label: 'Past two weeks', get: () => ({ s: subDays(startOfToday(), 14), e: startOfToday() }) },
  { label: 'This month', get: () => ({ s: startOfMonth(startOfToday()), e: endOfMonth(startOfToday()) }) },
  { label: 'Last month', get: () => ({ s: startOfMonth(subMonths(startOfToday(), 1)), e: endOfMonth(subMonths(startOfToday(), 1)) }) },
  { label: 'This year', get: () => ({ s: startOfYear(startOfToday()), e: endOfYear(startOfToday()) }) },
  { label: 'Last year', get: () => ({ s: startOfYear(subYears(startOfToday(), 1)), e: endOfYear(subYears(startOfToday(), 1)) }) },
]

const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Wrap these in useMemo to maintain consistent object references
  const parsedStart = useMemo(() => parseISO(startDate), [startDate])
  const parsedEnd = useMemo(() => parseISO(endDate), [endDate])

  // Internal selection state for the calendar interactions
  const [tempStart, setTempStart] = useState<Date | null>(parsedStart)
  const [tempEnd, setTempEnd] = useState<Date | null>(parsedEnd)
  const [hoverDate, setHoverDate] = useState<Date | null>(null)
  const [viewMonth, setViewMonth] = useState(startOfMonth(parsedStart))

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Sync internal state when opened
  useEffect(() => {
    if (isOpen) {
      setTempStart(parsedStart)
      setTempEnd(parsedEnd)
      setViewMonth(startOfMonth(parsedStart))
    }
  }, [isOpen, parsedStart, parsedEnd])

  // Sync internal state when opened
  useEffect(() => {
    if (isOpen) {
      setTempStart(parsedStart)
      setTempEnd(parsedEnd)
      setViewMonth(startOfMonth(parsedStart))
    }
  }, [isOpen, parsedStart, parsedEnd])

  const currentPreset = useMemo(() => {
    return presets.find(p => {
      const { s, e } = p.get()
      return isSameDay(s, parsedStart) && isSameDay(e, parsedEnd)
    })
  }, [parsedStart, parsedEnd])

  const buttonLabel = currentPreset 
    ? `${currentPreset.label} (${format(parsedStart, 'MM/dd/yyyy')} - ${format(parsedEnd, 'MM/dd/yyyy')})`
    : `${format(parsedStart, 'MM/dd/yyyy')} - ${format(parsedEnd, 'MM/dd/yyyy')}`

  const handleShift = (direction: -1 | 1) => {
    const diff = differenceInDays(parsedEnd, parsedStart) + 1
    const shiftStart = addDays(parsedStart, diff * direction)
    const shiftEnd = addDays(parsedEnd, diff * direction)
    onChange(format(shiftStart, 'yyyy-MM-dd'), format(shiftEnd, 'yyyy-MM-dd'))
  }

  const handlePresetClick = (preset: typeof presets[0]) => {
    const { s, e } = preset.get()
    onChange(format(s, 'yyyy-MM-dd'), format(e, 'yyyy-MM-dd'))
    setIsOpen(false)
  }

  const handleDayClick = (day: Date) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(day)
      setTempEnd(null)
    } else {
      if (isBefore(day, tempStart)) {
        setTempStart(day)
      } else {
        onChange(format(tempStart, 'yyyy-MM-dd'), format(day, 'yyyy-MM-dd'))
        setIsOpen(false)
      }
    }
  }

  const renderCalendar = (month: Date) => {
    const startDay = startOfMonth(month)
    const endDay = endOfMonth(month)
    const startGrid = startOfWeek(startDay)
    const endGrid = endOfWeek(endDay)

    const days = []
    let day = startGrid
    while (day <= endGrid) {
      days.push(day)
      day = addDays(day, 1)
    }

    return (
      <div className="flex flex-col gap-2 p-4">
        <div className="text-center font-semibold text-sm text-zinc-900 dark:text-zinc-100 mb-2">
          {format(month, 'MMM yyyy')}
        </div>
        <div className="grid grid-cols-7 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
          {daysOfWeek.map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1 justify-items-center">
          {days.map((d, i) => {
            const isStart = tempStart && isSameDay(d, tempStart)
            const isEnd = tempEnd && isSameDay(d, tempEnd)
            const activeEnd = tempEnd || hoverDate
            const isBetween = tempStart && activeEnd && isWithinInterval(d, { 
              start: isBefore(tempStart, activeEnd) ? tempStart : activeEnd, 
              end: isAfter(activeEnd, tempStart) ? activeEnd : tempStart 
            }) && !isStart && !isEnd

            let spanClass = "w-8 h-8 flex items-center justify-center text-sm cursor-pointer transition-colors "
            let containerClass = "w-full flex justify-center "

            if (isStart || isEnd) {
              spanClass += "bg-blue-600 text-white rounded-md hover:bg-blue-700 "
              if (isStart && activeEnd && isAfter(activeEnd, tempStart)) containerClass += "bg-blue-50 dark:bg-blue-900/30 rounded-l-md "
              if (isEnd && tempStart && isBefore(tempStart, tempEnd)) containerClass += "bg-blue-50 dark:bg-blue-900/30 rounded-r-md "
            } else if (isBetween) {
              spanClass += "text-blue-900 dark:text-blue-100 "
              containerClass += "bg-blue-50 dark:bg-blue-900/30 "
            } else {
              spanClass += "hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md "
              if (!isSameMonth(d, month)) spanClass += "text-zinc-400 dark:text-zinc-600 "
              else spanClass += "text-zinc-700 dark:text-zinc-300 "
            }

            return (
              <div key={i} className={containerClass} onMouseEnter={() => setHoverDate(d)}>
                <span onClick={() => handleDayClick(d)} className={spanClass}>{format(d, 'd')}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="relative inline-block w-full" ref={containerRef}>
      <div className="flex h-10 w-full rounded-md shadow-sm">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 flex items-center px-3 md:px-4 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-l-md text-xs md:text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors focus:outline-none"
        >
          <CalendarIcon size={16} className="mr-2 text-zinc-500" />
          <span className="truncate">{buttonLabel}</span>
        </button>
        <button 
          onClick={() => handleShift(-1)}
          className="flex items-center justify-center px-2 md:px-3 bg-white dark:bg-zinc-950 border-y border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors focus:outline-none border-l-0"
        >
          <ChevronLeft size={16} />
        </button>
        <button 
          onClick={() => handleShift(1)}
          className="flex items-center justify-center px-2 md:px-3 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-r-md text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors focus:outline-none border-l-0"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 flex flex-col md:flex-row bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl overflow-hidden w-[280px] md:w-max">
          {/* Sidebar Presets */}
          <div className="flex flex-col py-2 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 min-w-[140px] max-h-40 md:max-h-none overflow-y-auto">
            {presets.map((preset, idx) => {
              const isSelected = currentPreset?.label === preset.label
              return (
                <button
                  key={idx}
                  onClick={() => handlePresetClick(preset)}
                  className={`text-left px-4 py-2 text-xs md:text-sm transition-colors ${
                    isSelected 
                      ? 'bg-blue-600 text-white font-medium' 
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>

          {/* Calendars */}
          <div className="flex flex-col md:flex-row p-2 bg-white dark:bg-zinc-950" onMouseLeave={() => setHoverDate(null)}>
            <div className="relative">
              <button onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="absolute left-2 top-4 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 z-10">
                <ChevronLeft size={18} />
              </button>
              {renderCalendar(viewMonth)}
            </div>
            <div className="hidden md:block w-px bg-zinc-200 dark:bg-zinc-800 mx-2 my-4" />
            <div className="relative hidden md:block">
              <button onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="absolute right-2 top-4 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 z-10">
                <ChevronRight size={18} />
              </button>
              {renderCalendar(addMonths(viewMonth, 1))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}