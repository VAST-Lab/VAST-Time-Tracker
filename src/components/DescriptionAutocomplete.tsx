'use client'
import { useState, useRef, useEffect } from 'react'
import { TimeEntry } from '@/types/supabase'
import { getMyRecentEntries } from '@/utils/supabase/timeApi'
import { useAuth } from '@/context/AuthContext'

interface Props {
  value: string
  onChange: (val: string, projectId?: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export default function DescriptionAutocomplete({ value, onChange, disabled, placeholder, className }: Props) {
  const { user } = useAuth()
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
	if (user) getMyRecentEntries(user.id).then(setRecentEntries)
  }, [user])

  useEffect(() => {
	const handleClickOutside = (event: MouseEvent) => {
	  if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
		setShowSuggestions(false)
	  }
	}
	document.addEventListener('mousedown', handleClickOutside)
	return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const suggestions = recentEntries
	.filter(e => e.description && e.description.toLowerCase().includes(value.toLowerCase()))
	.reduce((acc, current) => {
	  const x = acc.find(item => item.description === current.description && item.project_id === current.project_id)
	  if (!x) acc.push(current)
	  return acc
	}, [] as TimeEntry[])
	.slice(0, 5)

  return (
	<div className="relative w-full" ref={suggestionsRef}>
	  <input
		type="text"
		maxLength={500}
		value={value}
		onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }}
		onFocus={() => setShowSuggestions(true)}
		disabled={disabled}
		placeholder={placeholder}
		className={className}
	  />
	  {showSuggestions && suggestions.length > 0 && !disabled && (
		<div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg overflow-hidden z-50">
		  {suggestions.map((s, idx) => (
			<div
			  key={idx}
			  onMouseDown={(e) => e.preventDefault()}
			  onClick={() => {
				onChange(s.description || '', s.project_id)
				setShowSuggestions(false)
			  }}
			  className="px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer border-b border-zinc-100 dark:border-zinc-800 last:border-0"
			>
			  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{s.description}</div>
			  <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2 mt-0.5">
				<div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.projects?.color_hex || '#ccc' }} />
				{s.projects?.name || 'No Project'}
			  </div>
			</div>
		  ))}
		</div>
	  )}
	</div>
  )
}