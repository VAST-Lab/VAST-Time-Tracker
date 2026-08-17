'use client'
import { useState, useEffect } from 'react'
import { useTimer } from '@/context/TimerContext'
import { getProjects } from '@/utils/supabase/api'
import { Project } from '@/types/supabase'
import { Play, Square } from 'lucide-react'

const formatTime = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export default function GlobalTimer() {
  const { activeEntry, elapsedSeconds, handleStart, handleStop } = useTimer()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    getProjects().then(setProjects)
  }, [])

  if (activeEntry) {
    return (
      <div className="flex items-center gap-2 md:gap-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 md:px-4 py-1.5 md:py-2 rounded-full shadow-lg w-full max-w-2xl mx-auto">
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[10px] md:text-xs font-semibold text-zinc-300 dark:text-zinc-600 truncate">{activeEntry.projects?.name}</span>
          <span className="text-xs md:text-sm truncate">{activeEntry.description || 'No description'}</span>
        </div>
        <div className="font-mono text-sm md:text-xl tracking-wider px-2 md:px-4 border-l border-zinc-700 dark:border-zinc-300 shrink-0">
          {formatTime(elapsedSeconds)}
        </div>
        <button onClick={handleStop} className="p-1.5 md:p-2 bg-red-500 hover:bg-red-600 rounded-full transition-colors text-white shrink-0">
          <Square size={14} className="md:w-4 md:h-4" fill="currentColor" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 md:gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-1.5 md:py-2 rounded-full shadow-sm w-full">
      <select 
        value={selectedProject} 
        onChange={(e) => setSelectedProject(e.target.value)}
        className="bg-transparent border-none text-xs md:text-sm focus:ring-0 px-1 md:px-2 w-24 md:w-1/3 text-zinc-900 dark:text-zinc-100 truncate"
      >
        <option value="">Project...</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div className="w-px h-4 md:h-6 bg-zinc-200 dark:bg-zinc-800 shrink-0" />
      <input
        type="text"
        placeholder="What are you working on?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="flex-1 bg-transparent border-none text-xs md:text-sm focus:ring-0 px-1 md:px-2 outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 min-w-0"
      />
      <button 
        onClick={() => { if (selectedProject) handleStart(selectedProject, description) }}
        disabled={!selectedProject}
        className="p-1.5 md:p-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white dark:text-zinc-900 rounded-full transition-colors shrink-0"
      >
        <Play size={14} className="md:w-4 md:h-4" fill="currentColor" />
      </button>
    </div>
  )
}