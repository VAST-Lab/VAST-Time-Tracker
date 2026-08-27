'use client'
import { useTimer } from '@/context/TimerContext'

export default function FormatToggle() {
  const { timeFormat, setTimeFormat } = useTimer()
  return (
	<button
	  onClick={() => setTimeFormat(timeFormat === 'compact' ? 'colon' : 'compact')}
	  className="px-2 py-1.5 text-[10px] md:text-xs font-mono font-medium rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
	  title="Toggle Time Format"
	>
	  {timeFormat === 'compact' ? '0h 0m' : '00:00:00'}
	</button>
  )
}