'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { getActiveTimer, startTimer, stopTimer } from '@/utils/supabase/timeApi'
import { TimeEntry } from '@/types/supabase'

type TimerContextType = {
  activeEntry: TimeEntry | null;
  elapsedSeconds: number;
  handleStart: (projectId: string, description: string) => Promise<void>;
  handleStop: () => Promise<void>;
  refreshTrigger: number; // Used to trigger re-renders on the dashboard
}

const TimerContext = createContext<TimerContextType>({
  activeEntry: null,
  elapsedSeconds: 0,
  handleStart: async () => {},
  handleStop: async () => {},
  refreshTrigger: 0
})

export const TimerProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth()
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    if (!user) return
    const fetchActive = async () => {
      const entry = await getActiveTimer(user.id)
      setActiveEntry(entry)
    }
    fetchActive()
  }, [user])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (activeEntry) {
      interval = setInterval(() => {
        const start = new Date(activeEntry.start_time).getTime()
        const now = new Date().getTime()
        setElapsedSeconds(Math.floor((now - start) / 1000))
      }, 1000)
    } else {
      setElapsedSeconds(0)
    }
    return () => clearInterval(interval)
  }, [activeEntry])

  const handleStart = async (projectId: string, description: string) => {
    if (!user) return
    const entry = await startTimer(user.id, projectId, description)
    setActiveEntry(entry)
  }

  const handleStop = async () => {
    if (!activeEntry) return
    await stopTimer(activeEntry.id)
    setActiveEntry(null)
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <TimerContext.Provider value={{ activeEntry, elapsedSeconds, handleStart, handleStop, refreshTrigger }}>
      {children}
    </TimerContext.Provider>
  )
}

export const useTimer = () => useContext(TimerContext)