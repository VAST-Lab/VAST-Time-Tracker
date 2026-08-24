'use client'
import { useState, useEffect, useRef } from 'react'
import { useTimer } from '@/context/TimerContext'
import { useAuth } from '@/context/AuthContext'
import { getProjects } from '@/utils/supabase/api'
import { getMyRecentEntries, updateTimeEntry } from '@/utils/supabase/timeApi'
import { Project, TimeEntry } from '@/types/supabase'
import { Play, Square, AlertCircle } from 'lucide-react'

const formatTime = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export default function GlobalTimer() {
  const { user } = useAuth()
  const { activeEntry, elapsedSeconds, handleStart, handleStop, triggerRefresh } = useTimer()
  const [projects, setProjects] = useState<Project[]>([])
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([])
  
  const [selectedProject, setSelectedProject] = useState('')
  const [description, setDescription] = useState('')
  
  // Autocomplete State
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  
  // Stop Validation State
  const [isValidatingStop, setIsValidatingStop] = useState(false)

  // Sync with active entry on load or when active entry starts/stops
  useEffect(() => {
    if (activeEntry) {
      setDescription(activeEntry.description || '')
      setSelectedProject(activeEntry.project_id || '')
      setIsValidatingStop(false)
    } else {
      setDescription('')
      setSelectedProject('')
      setIsValidatingStop(false)
    }
  }, [activeEntry?.id])

  useEffect(() => {
    getProjects().then(setProjects)
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

  // Derive unique suggestions based on description input
  const suggestions = recentEntries
    .filter(e => e.description && e.description.toLowerCase().includes(description.toLowerCase()))
    .reduce((acc, current) => {
      const x = acc.find(item => item.description === current.description && item.project_id === current.project_id)
      if (!x) acc.push(current)
      return acc
    }, [] as TimeEntry[])
    .slice(0, 5)

  const handleSuggestionClick = async (entry: TimeEntry) => {
    const newDesc = entry.description || ''
    const newProj = entry.project_id || ''
    setDescription(newDesc)
    setSelectedProject(newProj)
    setShowSuggestions(false)

    if (activeEntry) {
      await updateTimeEntry(activeEntry.id, { description: newDesc, project_id: newProj || null as any })
      triggerRefresh()
    }
  }

  const handleProjectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProj = e.target.value
    setSelectedProject(newProj)
    if (activeEntry) {
      await updateTimeEntry(activeEntry.id, { project_id: newProj || null as any })
      triggerRefresh()
    }
  }

  const handleDescriptionBlur = async () => {
    if (activeEntry && activeEntry.description !== description) {
      await updateTimeEntry(activeEntry.id, { description })
      triggerRefresh()
    }
  }

  const handlePlayStop = async () => {
    if (activeEntry) {
      if (!selectedProject) {
        setIsValidatingStop(true)
        return
      }
      // Save description if they click stop without blurring the input
      if (activeEntry.description !== description) {
        await updateTimeEntry(activeEntry.id, { description })
      }
      await handleStop(selectedProject)
    } else {
      await handleStart(selectedProject || null, description)
      setShowSuggestions(false)
    }
  }

  const confirmStop = async () => {
    if (!selectedProject) return
    if (activeEntry && activeEntry.description !== description) {
      await updateTimeEntry(activeEntry.id, { description })
    }
    await handleStop(selectedProject)
    setIsValidatingStop(false)
  }

  if (isValidatingStop) {
    return (
      <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-1.5 rounded-full w-full max-w-2xl mx-auto">
        <AlertCircle size={16} className="text-red-500 shrink-0" />
        <span className="text-[10px] md:text-xs text-red-700 dark:text-red-400 shrink-0 hidden md:inline">Project Required:</span>
        <select 
          value={selectedProject} 
          onChange={(e) => setSelectedProject(e.target.value)}
          className="flex-1 bg-white dark:bg-zinc-950 border border-red-200 dark:border-red-800 rounded text-xs px-2 py-1 outline-none text-zinc-900 dark:text-zinc-100 [&>option]:bg-white dark:[&>option]:bg-zinc-950"
        >
          <option value="">Select a project to save...</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={confirmStop} disabled={!selectedProject} className="px-3 py-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-xs font-medium rounded transition-colors shrink-0">
          Save & Stop
        </button>
        <button onClick={() => setIsValidatingStop(false)} className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 shrink-0">
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-1 md:gap-2 ${activeEntry ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 shadow-md' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm'} border px-2 py-1.5 md:py-2 rounded-full w-full max-w-2xl mx-auto relative transition-colors`} ref={suggestionsRef}>
      
      <div className="flex-1 relative min-w-0 flex items-center">
        <input
          type="text"
          maxLength={500}
          placeholder="What are you working on?"
          value={description}
          onChange={(e) => { setDescription(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={handleDescriptionBlur}
          className="w-full bg-transparent border-none text-xs md:text-sm focus:ring-0 px-1 md:px-2 outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
        />
        
        {description.length >= 150 && (
          <span className="absolute right-0 -top-6 text-[10px] text-red-500 font-medium bg-white dark:bg-zinc-800 px-1.5 py-0.5 rounded shadow-sm border border-red-200 dark:border-red-900 z-10">
            {description.length}/80
          </span>
        )}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 mt-2 w-[150%] md:w-[200%] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl overflow-hidden z-50">
            {suggestions.map((s, idx) => (
              <div 
                key={idx} 
                onMouseDown={(e) => e.preventDefault()} // Prevents input blur from firing before click registers
                onClick={() => handleSuggestionClick(s)}
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

      <div className={`w-px h-4 md:h-6 ${activeEntry ? 'bg-blue-200 dark:bg-blue-800' : 'bg-zinc-200 dark:bg-zinc-800'} shrink-0`} />
      
      <select 
        value={selectedProject} 
        onChange={handleProjectChange}
        className="bg-transparent border-none text-xs md:text-sm focus:ring-0 px-1 md:px-2 w-24 md:w-1/3 text-zinc-900 dark:text-zinc-100 truncate cursor-pointer [&>option]:bg-white dark:[&>option]:bg-zinc-900"
      >
        <option value="">Project</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      {activeEntry && (
        <>
          <div className={`w-px h-4 md:h-6 ${activeEntry ? 'bg-blue-200 dark:bg-blue-800' : 'bg-zinc-200 dark:bg-zinc-800'} shrink-0 hidden md:block`} />
          <div className="font-mono text-sm md:text-base tracking-wider px-1 md:px-3 text-blue-700 dark:text-blue-400 font-medium shrink-0">
            {formatTime(elapsedSeconds)}
          </div>
        </>
      )}

      <button 
        onClick={handlePlayStop}
        className={`p-1.5 md:p-2 ${activeEntry ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900'} rounded-full transition-colors shrink-0`}
      >
        {activeEntry ? (
          <Square size={14} className="md:w-4 md:h-4" fill="currentColor" />
        ) : (
          <Play size={14} className="md:w-4 md:h-4" fill="currentColor" />
        )}
      </button>
    </div>
  )
}