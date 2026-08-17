'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { EventDropArg, EventClickArg, DateSelectArg, EventContentArg } from '@fullcalendar/core'
import { EventResizeDoneArg } from '@fullcalendar/interaction'
import { useAuth } from '@/context/AuthContext'
import { useTimer } from '@/context/TimerContext'
import { getProjects } from '@/utils/supabase/api'
import { getMyRecentEntries, addManualEntry, updateTimeEntry, deleteTimeEntry } from '@/utils/supabase/timeApi'
import { Project, TimeEntry } from '@/types/supabase'
import { format, differenceInMinutes } from 'date-fns'

function renderEventContent(eventInfo: EventContentArg) {
  const { event } = eventInfo;
  const { projectName, description, durationStr, colorHex, isActive } = event.extendedProps;
  
  const start = event.start;
  const end = event.end || new Date();
  const durationMins = start ? differenceInMinutes(end, start) : 60;
  const isShort = durationMins <= 45;
  
  return (
    <div 
      className={`w-full h-full flex ${isShort ? 'flex-row items-center px-1.5' : 'flex-col p-1.5'} rounded-sm shadow-sm overflow-hidden border-l-4 bg-zinc-100 dark:bg-zinc-800 transition-all ${isActive ? 'ring-1 ring-red-500/50 opacity-95' : ''}`}
      style={{ borderLeftColor: colorHex }}
    >
      <div className={`font-bold truncate ${isShort ? 'text-[10px] flex-1' : 'text-xs'}`} style={{ color: colorHex }}>
        {projectName}
      </div>
      
      {!isShort && description && (
        <div className="text-xs text-zinc-700 dark:text-zinc-300 truncate mt-0.5 leading-tight">
          {description}
        </div>
      )}
      
      <div className={`${isShort ? 'relative ml-1 text-[9px]' : 'absolute bottom-1 right-1 text-[10px]'} font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100/90 dark:bg-zinc-800/90 px-1 rounded backdrop-blur-sm shrink-0`}>
        {durationStr}
      </div>
    </div>
  );
}

const getExactDuration = (start: string, end: string | Date) => {
  const mins = differenceInMinutes(new Date(end), new Date(start))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

export default function CalendarPage() {
  const { user } = useAuth()
  const { activeEntry } = useTimer()
  const [dbEvents, setDbEvents] = useState<any[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalProjectId, setModalProjectId] = useState('')
  const [modalDesc, setModalDesc] = useState('')
  const [modalDate, setModalDate] = useState('')
  const [modalStartTime, setModalStartTime] = useState('')
  const [modalEndTime, setModalEndTime] = useState('')

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editId, setEditId] = useState('')
  const [editProjectId, setEditProjectId] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')

  // Tick the current time every minute for the active timer block
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (user) loadCalendarData()
  }, [user])

  const loadCalendarData = async () => {
    if (!user) return
    const [projData, timeData] = await Promise.all([
      getProjects(),
      getMyRecentEntries(user.id)
    ])
    
    setProjects(projData)
    
    const mappedEvents = timeData.map((entry: TimeEntry) => ({
      id: entry.id,
      start: entry.start_time,
      end: entry.end_time || new Date().toISOString(),
      extendedProps: {
        projectId: entry.project_id,
        projectName: entry.projects?.name,
        description: entry.description,
        colorHex: entry.projects?.color_hex || '#3788d8',
        durationStr: getExactDuration(entry.start_time, entry.end_time || new Date()),
        isActive: false
      }
    }))
    setDbEvents(mappedEvents)
  }

  // Merge the active timer block with the saved logs
  const calendarEvents = useMemo(() => {
    const allEvents = [...dbEvents]
    if (activeEntry) {
      // Remove any overlapping saved entry for the active block before pushing the live one
      const filtered = allEvents.filter(e => e.id !== activeEntry.id)
      filtered.push({
        id: activeEntry.id,
        start: activeEntry.start_time,
        end: currentTime.toISOString(),
        extendedProps: {
          projectId: activeEntry.project_id,
          projectName: activeEntry.projects?.name || 'Running Project',
          description: activeEntry.description,
          colorHex: activeEntry.projects?.color_hex || '#3788d8',
          durationStr: getExactDuration(activeEntry.start_time, currentTime),
          isActive: true
        }
      })
      return filtered
    }
    return allEvents
  }, [dbEvents, activeEntry, currentTime])

  // Helper to calculate duration for the UI Modals
  const calcDuration = (start: string, end: string) => {
    if (!start || !end) return '0h 0m'
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    let mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins < 0) mins += 24 * 60 // Handle midnight crossover
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  const handleEventDrop = async (dropInfo: EventDropArg) => {
    const { event } = dropInfo
    if (event.extendedProps.isActive) return dropInfo.revert()
    if (!event.start) return dropInfo.revert()
    try {
      await updateTimeEntry(event.id, {
        start_time: event.start.toISOString(),
        end_time: event.end ? event.end.toISOString() : null
      })
    } catch (error) {
      console.error('Error updating event:', error)
      dropInfo.revert()
    }
  }

  const handleEventResize = async (resizeInfo: EventResizeDoneArg) => {
    const { event } = resizeInfo
    if (event.extendedProps.isActive) return resizeInfo.revert()
    if (!event.end) return resizeInfo.revert()
    try {
      await updateTimeEntry(event.id, { end_time: event.end.toISOString() })
    } catch (error) {
      console.error('Error resizing event:', error)
      resizeInfo.revert()
    }
  }

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    setModalDate(format(selectInfo.start, 'yyyy-MM-dd'))
    setModalStartTime(format(selectInfo.start, 'HH:mm'))
    setModalEndTime(format(selectInfo.end, 'HH:mm'))
    setIsModalOpen(true)
    selectInfo.view.calendar.unselect() 
  }

  const handleEventClick = (clickInfo: EventClickArg) => {
    const { event } = clickInfo
    if (event.extendedProps.isActive) return // Prevent editing the active live timer
    setEditId(event.id)
    setEditProjectId(event.extendedProps.projectId)
    setEditDesc(event.extendedProps.description || '')
    if (event.start) {
      setEditDate(format(event.start, 'yyyy-MM-dd'))
      setEditStartTime(format(event.start, 'HH:mm'))
    }
    setEditEndTime(event.end ? format(event.end, 'HH:mm') : '')
    setIsEditModalOpen(true)
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !modalProjectId) return
    const startIso = new Date(`${modalDate}T${modalStartTime}`).toISOString()
    
    const endDateObj = new Date(`${modalDate}T${modalEndTime}`)
    if (modalEndTime < modalStartTime) {
      endDateObj.setDate(endDateObj.getDate() + 1)
    }
    const endIso = endDateObj.toISOString()

    await addManualEntry({
      user_id: user.id,
      project_id: modalProjectId,
      description: modalDesc,
      start_time: startIso,
      end_time: endIso
    })

    setIsModalOpen(false)
    setModalProjectId('')
    setModalDesc('')
    loadCalendarData()
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editId) return
    const startIso = new Date(`${editDate}T${editStartTime}`).toISOString()
    
    let endIso = null
    if (editEndTime) {
      const endDateObj = new Date(`${editDate}T${editEndTime}`)
      if (editEndTime < editStartTime) {
        endDateObj.setDate(endDateObj.getDate() + 1)
      }
      endIso = endDateObj.toISOString()
    }

    await updateTimeEntry(editId, {
      project_id: editProjectId,
      description: editDesc,
      start_time: startIso,
      end_time: endIso
    })

    setIsEditModalOpen(false)
    loadCalendarData()
  }

  const handleDelete = async () => {
    if (!editId) return
    await deleteTimeEntry(editId)
    setIsEditModalOpen(false)
    loadCalendarData()
  }

  const calendarRef = useRef<any>(null)

  useEffect(() => {
    const handleResize = () => {
      if (calendarRef.current) {
        const api = calendarRef.current.getApi()
        const isMobile = window.innerWidth < 768
        if (isMobile && api.view.type !== 'timeGridDay') {
          api.changeView('timeGridDay')
        } else if (!isMobile && api.view.type !== 'timeGridWeek') {
          api.changeView('timeGridWeek')
        }
      }
    }
    // Delay slightly to ensure FullCalendar has initialized
    const timeout = setTimeout(handleResize, 100)
    window.addEventListener('resize', handleResize)
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <div className="h-full flex flex-col space-y-4">
      <style>{`
        .dark {
          --fc-border-color: #27272a;
          --fc-today-bg-color: rgba(39, 39, 42, 0.5);
        }
        :root {
          --fc-now-indicator-color: #ef4444;
        }
        .fc-timegrid-event-harness > .fc-timegrid-event {
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        /* Mobile adjustments for calendar header */
        .fc .fc-toolbar.fc-header-toolbar {
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        @media (max-width: 768px) {
          .fc .fc-toolbar-title { font-size: 1.125rem !important; }
          .fc .fc-button { padding: 0.25rem 0.5rem !important; font-size: 0.875rem !important; }
        }
      `}</style>
      
      <div className="flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-zinc-100">Calendar</h1>
      </div>
      
      <div className="flex-1 bg-white dark:bg-zinc-900 p-2 md:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm min-h-[500px] md:min-h-[600px] dark:text-zinc-100">
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridWeek,timeGridDay'
          }}
          events={calendarEvents}
          eventContent={renderEventContent}
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          nowIndicator={true}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          select={handleDateSelect}
          eventClick={handleEventClick}
          height="100%"
          scrollTime="09:00:00"
        />
      </div>

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-lg w-full max-w-md border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">Log Time Block</h2>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Project</label>
                <select required value={modalProjectId} onChange={(e) => setModalProjectId(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100">
                  <option value="">Select Project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
                <input type="text" value={modalDesc} onChange={(e) => setModalDesc(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Date</label>
                <input type="date" required value={modalDate} onChange={(e) => setModalDate(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100" />
              </div>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Start Time</label>
                  <input type="time" required value={modalStartTime} onChange={(e) => setModalStartTime(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">End Time</label>
                  <input type="time" required value={modalEndTime} onChange={(e) => setModalEndTime(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100" />
                </div>
                <div className="flex-1 mb-2 text-sm font-mono text-zinc-600 dark:text-zinc-400 text-right">
                  {calcDuration(modalStartTime, modalEndTime)}
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-800 dark:hover:bg-white">Save Time</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-lg w-full max-w-md border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">Edit Time Block</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Project</label>
                <select required value={editProjectId} onChange={(e) => setEditProjectId(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100">
                  <option value="">Select Project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
                <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Date</label>
                <input type="date" required value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100" />
              </div>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Start Time</label>
                  <input type="time" required value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">End Time</label>
                  <input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100" />
                </div>
                <div className="flex-1 mb-2 text-sm font-mono text-zinc-600 dark:text-zinc-400 text-right">
                  {calcDuration(editStartTime, editEndTime)}
                </div>
              </div>
              <div className="flex justify-between mt-6">
                <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md">Delete</button>
                <div className="space-x-3">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Cancel</button>
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