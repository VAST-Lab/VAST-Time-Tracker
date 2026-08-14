'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useTimer } from '@/context/TimerContext'
import { getProjects } from '@/utils/supabase/api'
import { getMyRecentEntries, addManualEntry, updateTimeEntry, deleteTimeEntry } from '@/utils/supabase/timeApi'
import { Project, TimeEntry } from '@/types/supabase'
import { format, differenceInMinutes, parseISO, startOfWeek, endOfWeek } from 'date-fns'

export default function TimeLogsPage() {
  const { user } = useAuth()
  const { refreshTrigger } = useTimer()
  const [projects, setProjects] = useState<Project[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  
  const [projectId, setProjectId] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')

  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [editProjectId, setEditProjectId] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')

  useEffect(() => {
    getProjects().then(setProjects)
  }, [])

  useEffect(() => {
    if (user) {
      loadEntries()
    }
  }, [user, refreshTrigger])

  const loadEntries = () => {
    if (user) getMyRecentEntries(user.id).then(setEntries)
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !projectId) return

    const startIso = new Date(`${date}T${startTime}`).toISOString()
    const endIso = new Date(`${date}T${endTime}`).toISOString()

    await addManualEntry({
      user_id: user.id,
      project_id: projectId,
      description,
      start_time: startIso,
      end_time: endIso
    })

    setDescription('')
    loadEntries()
  }

  const openEditModal = (entry: TimeEntry) => {
    const start = parseISO(entry.start_time)
    setEditProjectId(entry.project_id)
    setEditDescription(entry.description || '')
    setEditDate(format(start, 'yyyy-MM-dd'))
    setEditStartTime(format(start, 'HH:mm'))
    setEditEndTime(entry.end_time ? format(parseISO(entry.end_time), 'HH:mm') : '')
    setEditingEntry(entry)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEntry) return

    const startIso = new Date(`${editDate}T${editStartTime}`).toISOString()
    const endIso = editEndTime ? new Date(`${editDate}T${editEndTime}`).toISOString() : null

    await updateTimeEntry(editingEntry.id, {
      project_id: editProjectId,
      description: editDescription,
      start_time: startIso,
      end_time: endIso
    })

    setEditingEntry(null)
    loadEntries()
  }

  const handleDelete = async () => {
    if (!editingEntry) return
    await deleteTimeEntry(editingEntry.id)
    setEditingEntry(null)
    loadEntries()
  }

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return 'Running...'
    const mins = differenceInMinutes(new Date(end), new Date(start))
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  }

  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  }

  // Group entries by Week and then by Day
  const groupedData = useMemo(() => {
    const groups = new Map<string, { startDate: Date, weekTotal: number, days: Map<string, { date: Date, dayTotal: number, entries: TimeEntry[] }> }>();

    entries.forEach(entry => {
      const start = new Date(entry.start_time);
      const wStart = startOfWeek(start, { weekStartsOn: 1 });
      const wEnd = endOfWeek(start, { weekStartsOn: 1 });
      const weekLabel = `Week of ${format(wStart, 'MMM d')} - ${format(wEnd, 'MMM d')}`;
      const dayLabel = format(start, 'EEEE, MMM d');
      
      const mins = entry.end_time ? differenceInMinutes(new Date(entry.end_time), start) : differenceInMinutes(new Date(), start);

      if (!groups.has(weekLabel)) {
        groups.set(weekLabel, { startDate: wStart, weekTotal: 0, days: new Map() });
      }
      
      const weekData = groups.get(weekLabel)!;
      if (!weekData.days.has(dayLabel)) {
        weekData.days.set(dayLabel, { date: start, dayTotal: 0, entries: [] });
      }
      
      const dayData = weekData.days.get(dayLabel)!;
      weekData.weekTotal += mins;
      dayData.dayTotal += mins;
      dayData.entries.push(entry);
    });

    return Array.from(groups.entries())
      .map(([label, data]) => ({
        label,
        startDate: data.startDate,
        weekTotal: data.weekTotal,
        days: Array.from(data.days.entries())
          .map(([dLabel, dData]) => ({
            label: dLabel,
            date: dData.date,
            dayTotal: dData.dayTotal,
            entries: dData.entries.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime())
      }))
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  }, [entries]);

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Time Logs</h1>
        
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Manual Entry</h2>
          <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Project</label>
              <select required value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                <option value="">Select...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Description</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Date</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Start</label>
                <input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">End</label>
                <input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>
            </div>
            <div className="md:col-span-7 flex justify-end mt-2">
              <button type="submit" className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2 rounded-md hover:bg-zinc-800 dark:hover:bg-white text-sm font-medium">
                Add Time
              </button>
            </div>
          </form>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4 text-zinc-800 dark:text-zinc-200">Recent Logs</h2>
        
        {groupedData.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-500 dark:text-zinc-400">
            No time entries logged yet.
          </div>
        ) : (
          groupedData.map((week, wIdx) => (
            <div key={wIdx} className="mb-8">
              <div className="flex justify-between items-center mb-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <span>{week.label}</span>
                <span>{formatMins(week.weekTotal)}</span>
              </div>
              
              <div className="space-y-4">
                {week.days.map((day, dIdx) => (
                  <div key={dIdx} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{day.label}</span>
                      <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">{formatMins(day.dayTotal)}</span>
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {day.entries.map(entry => (
                        <div key={entry.id} onClick={() => openEditModal(entry)} className="p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer">
                          <div className="flex items-center gap-4">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.projects?.color_hex || '#ccc' }} />
                            <div>
                              <div className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">{entry.projects?.name}</div>
                              <div className="text-sm text-zinc-500 dark:text-zinc-400">{entry.description || 'No description'}</div>
                            </div>
                          </div>
                          <div className="mt-4 md:mt-0 flex items-center justify-between md:gap-8 md:w-1/2 md:justify-end">
                            <div className="text-sm text-zinc-600 dark:text-zinc-400">
                              {format(new Date(entry.start_time), 'h:mm a')} - {entry.end_time ? format(new Date(entry.end_time), 'h:mm a') : 'Now'}
                            </div>
                            <div className="font-mono font-medium text-zinc-900 dark:text-zinc-100 w-24 text-right">
                              {formatDuration(entry.start_time, entry.end_time)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-lg w-full max-w-md border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">Edit Time Log</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Project</label>
                <select required value={editProjectId} onChange={(e) => setEditProjectId(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                  <option value="">Select Project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
                <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Date</label>
                <input type="date" required value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Start Time</label>
                  <input type="time" required value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">End Time</label>
                  <input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
                </div>
              </div>
              <div className="flex justify-between mt-6">
                <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md">Delete</button>
                <div className="space-x-3">
                  <button type="button" onClick={() => setEditingEntry(null)} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-800 dark:hover:bg-white">Save</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}