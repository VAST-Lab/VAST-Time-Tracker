'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useTimer } from '@/context/TimerContext'
import { getProjects } from '@/utils/supabase/api'
import { getMyRecentEntries, updateTimeEntry, deleteTimeEntry, addManualEntry } from '@/utils/supabase/timeApi'
import { Project, TimeEntry } from '@/types/supabase'
import { format, differenceInSeconds, parseISO, startOfWeek, endOfWeek, startOfHour, addHours } from 'date-fns'
import { Play, Plus, X } from 'lucide-react'
import DescriptionAutocomplete from '@/components/DescriptionAutocomplete'

export default function DashboardPage() {
  const { user } = useAuth()
  const { activeEntry, handleStart, handleStop, handleDiscard, refreshTrigger, triggerRefresh, timeFormat } = useTimer()
  const [projects, setProjects] = useState<Project[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // Create Manual Modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  const [manualProjectId, setManualProjectId] = useState('')
  const [manualDesc, setManualDesc] = useState('')
  const [manualDate, setManualDate] = useState('')
  const [manualStartTime, setManualStartTime] = useState('')
  const [manualEndTime, setManualEndTime] = useState('')
  const [manualIsTentative, setManualIsTentative] = useState(false)

  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [editProjectId, setEditProjectId] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [editIsTentative, setEditIsTentative] = useState(false)

  useEffect(() => {
	  getProjects(true).then(setProjects)
  }, [])

  useEffect(() => {
	  if (user) loadEntries()
  }, [user, refreshTrigger])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const loadEntries = () => {
    if (user) getMyRecentEntries(user.id).then(setEntries)
  }

  // --- QUICK START LOGIC ---
  const quickStarts = useMemo(() => {
    const qsMap = new Map<string, { project_id: string, description: string, project: any, count: number, last_used: number }>()
    
    entries.forEach(e => {
      if (!e.project_id) return // Don't suggest items without projects
      const key = `${e.project_id}|${e.description || ''}`
      if (!qsMap.has(key)) {
        qsMap.set(key, { 
          project_id: e.project_id, 
          project: e.projects, 
          description: e.description || '', 
          count: 0, 
          last_used: new Date(e.start_time).getTime() 
        })
      }
      qsMap.get(key)!.count++
    })

    return Array.from(qsMap.values())
      .sort((a, b) => b.count - a.count || b.last_used - a.last_used)
      .slice(0, 8)
  }, [entries])

  const handleQuickStartPlay = async (qs: any) => {
    if (activeEntry) {
      const durationSecs = differenceInSeconds(new Date(), new Date(activeEntry.start_time))
      
      if (durationSecs < 30) {
        await handleDiscard()
      } else {
        if (!activeEntry.project_id) {
          alert("Please assign a project to your currently running timer before switching.")
          return
        }
        await handleStop(activeEntry.project_id)
      }
    }
    // Start the new one
    await handleStart(qs.project_id, qs.description)
  }

  // --- EDIT MODAL LOGIC ---
  const openManualModal = () => {
    const nowRounded = startOfHour(new Date())
    const later = addHours(nowRounded, 1)
    setManualDate(format(nowRounded, 'yyyy-MM-dd'))
    setManualStartTime(format(nowRounded, 'HH:mm'))
    setManualEndTime(format(later, 'HH:mm'))
    setManualProjectId('')
    setManualDesc('')
    setManualIsTentative(false)
    setIsManualModalOpen(true)
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !manualProjectId) return
    const startIso = new Date(`${manualDate}T${manualStartTime}`).toISOString()
    const endDateObj = new Date(`${manualDate}T${manualEndTime}`)
    if (manualEndTime < manualStartTime) endDateObj.setDate(endDateObj.getDate() + 1)

    await addManualEntry({
      user_id: user.id,
      project_id: manualProjectId,
      description: manualDesc,
      start_time: startIso,
      end_time: endDateObj.toISOString(),
      is_tentative: manualIsTentative
    })
    setIsManualModalOpen(false)
    triggerRefresh()
  }

  const openEditModal = (entry: TimeEntry) => {
    const start = parseISO(entry.start_time)
    setEditProjectId(entry.project_id || '')
    setEditDescription(entry.description || '')
    setEditIsTentative(entry.is_tentative || false)
    setEditDate(format(start, 'yyyy-MM-dd'))
    setEditStartTime(format(start, 'HH:mm'))
    setEditEndTime(entry.end_time ? format(parseISO(entry.end_time), 'HH:mm') : '')
    setEditingEntry(entry)
  }

  const handleEditSubmit = async (e: React.FormEvent, forceTentativeValue?: boolean) => {
    e?.preventDefault()
    if (!editingEntry) return
    const startIso = new Date(`${editDate}T${editStartTime}`).toISOString()
    let endIso = null
    if (editEndTime) {
      const endDateObj = new Date(`${editDate}T${editEndTime}`)
      if (editEndTime < editStartTime) endDateObj.setDate(endDateObj.getDate() + 1)
      endIso = endDateObj.toISOString()
    }
    await updateTimeEntry(editingEntry.id, {
      project_id: editProjectId || null as any,
      description: editDescription,
      start_time: startIso,
      end_time: endIso,
      is_tentative: forceTentativeValue !== undefined ? forceTentativeValue : editIsTentative
    })
    setEditingEntry(null)
    triggerRefresh()
  }

  const handleDelete = async () => {
    if (!editingEntry) return
    await deleteTimeEntry(editingEntry.id)
    setEditingEntry(null)
    triggerRefresh()
  }

  // --- FORMATTING LOGIC ---
  const formatTimeValue = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600)
    const m = Math.floor((totalSecs % 3600) / 60)
    const s = totalSecs % 60
    if (timeFormat === 'colon') {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${h}h ${m}m`
  }

  const formatDuration = (start: string, end: string | null) => {
    let secs = differenceInSeconds(end ? new Date(end) : currentTime, new Date(start))
    if (secs < 0) secs += 86400
    return formatTimeValue(secs)
  }

  const groupedData = useMemo(() => {
    const groups = new Map<string, {
      startDate: Date,
      totalSecs: number,
      forecastedSecs: number,
      personalSecs: number,
      days: Map<string, { date: Date, totalSecs: number, forecastedSecs: number, personalSecs: number, entries: TimeEntry[] }>
    }>();

    entries.forEach(entry => {
      const start = new Date(entry.start_time);
      const wStart = startOfWeek(start);
      const wEnd = endOfWeek(start);
      const weekLabel = `Week of ${format(wStart, 'MMM d')} - ${format(wEnd, 'MMM d')}`;
      const dayLabel = format(start, 'EEEE, MMM d');

      let secs = entry.end_time ? differenceInSeconds(new Date(entry.end_time), start) : Math.max(0, differenceInSeconds(currentTime, start));
      if (secs < 0) secs += 86400; // Handle midnight crossover just in case

      const isPersonal = !!entry.projects?.user_id;
      const isTentative = !!entry.is_tentative;

      if (!groups.has(weekLabel)) {
        groups.set(weekLabel, { startDate: wStart, totalSecs: 0, forecastedSecs: 0, personalSecs: 0, days: new Map() });
      }

      const weekData = groups.get(weekLabel)!;
      if (!weekData.days.has(dayLabel)) {
        weekData.days.set(dayLabel, { date: start, totalSecs: 0, forecastedSecs: 0, personalSecs: 0, entries: [] });
      }

      const dayData = weekData.days.get(dayLabel)!;

      if (isPersonal) {
        weekData.personalSecs += secs;
        dayData.personalSecs += secs;
      } else {
        weekData.forecastedSecs += secs;
        dayData.forecastedSecs += secs;
        if (!isTentative) {
          weekData.totalSecs += secs;
          dayData.totalSecs += secs;
        }
      }

      dayData.entries.push(entry);
    }); 

    return Array.from(groups.entries())
      .map(([label, data]) => ({
        label,
        startDate: data.startDate,
        totalSecs: data.totalSecs,
        forecastedSecs: data.forecastedSecs,
        personalSecs: data.personalSecs,
        days: Array.from(data.days.entries())
          .map(([dLabel, dData]) => ({
            label: dLabel,
            date: dData.date,
            totalSecs: dData.totalSecs,
            forecastedSecs: dData.forecastedSecs,
            personalSecs: dData.personalSecs,
            entries: dData.entries.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime())
        }))
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  }, [entries, currentTime, timeFormat]);

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl">
      
      {/* QUICK START SECTION */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 md:mb-6">Quick Start</h1>
        
        {quickStarts.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-500 dark:text-zinc-400 shadow-sm">
            Track some time to see your frequent projects appear here!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {quickStarts.map((qs, idx) => (
              <div 
                key={idx} 
                className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group"
              >
                <div className="mb-4">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm md:text-base line-clamp-2 mb-1 leading-snug">
                    {qs.description || 'No Description'}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: qs.project?.color_hex || '#ccc' }} />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{qs.project?.name}</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => handleQuickStartPlay(qs)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium transition-colors border border-zinc-200 dark:border-zinc-700"
                >
                  <Play size={14} className="group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
                  Start Timer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RECENT LOGS SECTION */}
      <div>
        <div className="flex justify-between items-center mb-3 md:mb-4">
          <h2 className="text-base md:text-lg font-semibold text-zinc-800 dark:text-zinc-200">Recent Logs</h2>
          <button onClick={openManualModal} className="flex items-center gap-2 text-sm font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 rounded-md hover:bg-zinc-800 dark:hover:bg-white transition-colors">
            <Plus size={16} /> Add Manual Time
          </button>
        </div>
        
        {groupedData.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-500 dark:text-zinc-400">
            No time entries logged yet.
          </div>
        ) : (
          groupedData.map((week, wIdx) => (
            <div key={wIdx} className="mb-6 md:mb-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 md:mb-4 text-xs md:text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider gap-1">
                <span>{week.label}</span>
                <div className="normal-case tracking-normal text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">Total: {formatTimeValue(week.totalSecs)}</span>
                  {week.totalSecs !== week.forecastedSecs && <span className="text-zinc-500 dark:text-zinc-400 ml-1">(Forecasted: {formatTimeValue(week.forecastedSecs)})</span>}
                  {week.personalSecs > 0 && <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">Personal: {formatTimeValue(week.personalSecs)}</span>}
                </div>
              </div>
              
              <div className="space-y-3 md:space-y-4">
                {week.days.map((day, dIdx) => (
                  <div key={dIdx} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                    <div className="bg-zinc-50 dark:bg-zinc-950/50 px-3 md:px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                      <span className="text-xs md:text-sm font-medium text-zinc-700 dark:text-zinc-300">{day.label}</span>
                      <div className="text-xs md:text-sm font-mono text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">Total: {formatTimeValue(day.totalSecs)}</span>
                        {day.totalSecs !== day.forecastedSecs && <span className="text-zinc-500 dark:text-zinc-400 ml-1">(Forecasted: {formatTimeValue(day.forecastedSecs)})</span>}
                        {day.personalSecs > 0 && <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">Personal: {formatTimeValue(day.personalSecs)}</span>}
                      </div>
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {day.entries.map(entry => (
                        <div key={entry.id} onClick={() => openEditModal(entry)} className={`p-3 md:p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer gap-2 sm:gap-4 ${entry.is_tentative ? 'opacity-70 border-l-2 border-dashed border-zinc-400' : ''}`}>
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.projects?.color_hex || '#ccc' }} />
                            <div className="min-w-0">
                              <div className="font-medium text-zinc-900 dark:text-zinc-100 text-xs md:text-sm truncate">
                                {entry.description || 'No description'} {entry.is_tentative && <span className="ml-1 text-[10px] text-zinc-500 font-semibold">(Tentative)</span>}
                              </div>
                              <div className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 truncate">{entry.projects?.name || 'No Project'}</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                            <div className="text-xs md:text-sm text-zinc-600 dark:text-zinc-400">
                              {format(new Date(entry.start_time), 'h:mm a')} - {entry.end_time ? format(new Date(entry.end_time), 'h:mm a') : 'Now'}
                            </div>
                            <div className="font-mono font-medium text-zinc-900 dark:text-zinc-100 text-xs md:text-sm text-right shrink-0">
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

      {/* ADD MANUAL MODAL */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-lg w-full max-w-md border border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Log Time Block</h2>
              <button type="button" onClick={() => setIsManualModalOpen(false)} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"><X size={24} /></button>
            </div>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Project</label>
              <select required value={manualProjectId} onChange={(e) => setManualProjectId(e.target.value)} style={{ color: projects.find(p => p.id === manualProjectId)?.color_hex || 'inherit' }} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                <option value="" style={{ color: 'inherit' }}>Select Project...</option>
                {projects.map(p => <option key={p.id} value={p.id} style={{ color: p.color_hex, fontWeight: '500' }}>● {p.name}</option>)}
              </select>
              </div>
              <div>
                <DescriptionAutocomplete
                  placeholder="Description"
                  value={manualDesc}
                  onChange={(val, projId) => {
                  setManualDesc(val);
                  if (projId) setManualProjectId(projId);
                  }}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <input type="date" required value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>
              <div className="flex gap-4">
                <input type="time" required value={manualStartTime} onChange={(e) => setManualStartTime(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
                <input type="time" value={manualEndTime} onChange={(e) => setManualEndTime(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="dashManualTentative" checked={manualIsTentative} onChange={(e) => setManualIsTentative(e.target.checked)} className="rounded border-zinc-300" />
                <label htmlFor="dashManualTentative" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Mark as Tentative</label>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsManualModalOpen(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md text-sm font-medium">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-lg w-full max-w-md border border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Edit Time Log</h2>
              <button type="button" onClick={() => setEditingEntry(null)} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"><X size={24} /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Project</label>
              <select required value={editProjectId} onChange={(e) => setEditProjectId(e.target.value)} style={{ color: projects.find(p => p.id === editProjectId)?.color_hex || 'inherit' }} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                <option value="" style={{ color: 'inherit' }}>Select Project...</option>
                {projects.map(p => <option key={p.id} value={p.id} style={{ color: p.color_hex, fontWeight: '500' }}>● {p.name}</option>)}
              </select>
              </div>
              <div>
              <div className="flex justify-between items-end mb-1">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</label>
                  {editDescription.length >= 150 && <span className="text-[10px] text-red-500">{editDescription.length}/500</span>}
                </div>
                <DescriptionAutocomplete
                  value={editDescription}
                  onChange={(val, projId) => {
                  setEditDescription(val);
                  if (projId) setEditProjectId(projId);
                  }}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
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
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="dashEditTentative" checked={editIsTentative} onChange={(e) => setEditIsTentative(e.target.checked)} className="rounded border-zinc-300" />
                <label htmlFor="dashEditTentative" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Mark as Tentative</label>
              </div>
              <div className="flex justify-between mt-6 items-center">
                <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md">Delete</button>
                <div className="space-x-3">
                  <button type="button" onClick={(e) => handleEditSubmit(e, !editIsTentative)} className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md">
                    {editIsTentative ? 'Confirm Time' : 'Make Tentative'}
                  </button>
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