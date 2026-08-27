'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/utils/supabase/client'
import { useAuth } from './AuthContext'
import { TimeEntry } from '@/types/supabase'
import { addManualEntry, updateTimeEntry, deleteTimeEntry } from '@/utils/supabase/timeApi'
export type TimeFormat = 'compact' | 'colon';

type TimerContextType = {
  activeEntry: TimeEntry | null;
  elapsedSeconds: number;
  refreshTrigger: number;
  triggerRefresh: () => void;
  handleStart: (projectId?: string | null, description?: string) => Promise<void>;
  handleStop: (projectId?: string) => Promise<void>;
  handleDiscard: () => Promise<void>;
  timeFormat: TimeFormat;
  setTimeFormat: (format: TimeFormat) => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined)

export function TimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('compact')

  const triggerRefresh = () => setRefreshTrigger(prev => prev + 1)

  useEffect(() => {
    if (!user) return
    const fetchActive = async () => {
      const { data } = await supabase
        .from('time_entries')
        .select('*, projects(*, clients(*))')
        .eq('user_id', user.id)
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .single()
      
      setActiveEntry(data || null)
    }
    fetchActive()
  }, [user, refreshTrigger])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (activeEntry) {
      const start = new Date(activeEntry.start_time).getTime()
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000))
      interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - start) / 1000))
      }, 1000)
    } else {
      setElapsedSeconds(0)
    }
    return () => clearInterval(interval)
  }, [activeEntry])

  const handleStart = async (projectId?: string | null, description?: string) => {
    if (!user) return
    if (activeEntry) await handleStop()
    
    await addManualEntry({
      user_id: user.id,
      project_id: projectId || null as any,
      description: description || '',
      start_time: new Date().toISOString(),
      end_time: null
    })
    triggerRefresh()
  }

  const handleStop = async (enforcedProjectId?: string) => {
    if (!activeEntry) return
    const finalProjectId = enforcedProjectId || activeEntry.project_id
    
    await updateTimeEntry(activeEntry.id, { 
      end_time: new Date().toISOString(),
      project_id: finalProjectId 
    })
    triggerRefresh()
  }

  const handleDiscard = async () => {
    if (!activeEntry) return
    await deleteTimeEntry(activeEntry.id)
    triggerRefresh()
  }

  return (
    <TimerContext.Provider value={{ activeEntry, elapsedSeconds, refreshTrigger, triggerRefresh, handleStart, handleStop, handleDiscard, timeFormat, setTimeFormat }}>
      {children}
    </TimerContext.Provider>
  )
}

export const useTimer = () => {
  const context = useContext(TimerContext)
  if (context === undefined) throw new Error('useTimer must be used within a TimerProvider')
  return context
}