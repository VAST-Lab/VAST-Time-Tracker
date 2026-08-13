'use client'
import { useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { EventDropArg, EventClickArg, DateSelectArg } from '@fullcalendar/core'
import { EventResizeDoneArg } from '@fullcalendar/interaction'
import { useAuth } from '@/context/AuthContext'
import { getProjects } from '@/utils/supabase/api'
import { getMyRecentEntries, addManualEntry, updateTimeEntry, deleteTimeEntry } from '@/utils/supabase/timeApi'
import { Project, TimeEntry } from '@/types/supabase'
import { format } from 'date-fns'

export default function CalendarPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<any[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  
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
      title: `${entry.projects?.name}${entry.description ? ': ' + entry.description : ''}`,
      start: entry.start_time,
      end: entry.end_time || new Date().toISOString(),
      backgroundColor: entry.projects?.color_hex || '#3788d8',
      borderColor: entry.projects?.color_hex || '#3788d8',
      extendedProps: {
        projectId: entry.project_id,
        description: entry.description
      }
    }))
    setEvents(mappedEvents)
  }

  // Helper to calculate duration for the UI
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
    const endIso = new Date(`${modalDate}T${modalEndTime}`).toISOString()

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
    const endIso = editEndTime ? new Date(`${editDate}T${editEndTime}`).toISOString() : null

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

  return (
    <div className="h-full flex flex-col space-y-4">
      <h1 className="text-2xl font-bold text-zinc-900">Calendar</h1>
      
      <div className="flex-1 bg-white p-4 rounded-xl border border-zinc-200 shadow-sm min-h-[600px]">
        <FullCalendar
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridWeek,timeGridDay'
          }}
          events={events}
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
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
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Log Time Block</h2>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Project</label>
                <select required value={modalProjectId} onChange={(e) => setModalProjectId(e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2">
                  <option value="">Select Project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Description (Optional)</label>
                <input type="text" value={modalDesc} onChange={(e) => setModalDesc(e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Date</label>
                <input type="date" required value={modalDate} onChange={(e) => setModalDate(e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2" />
              </div>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Start Time</label>
                  <input type="time" required value={modalStartTime} onChange={(e) => setModalStartTime(e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 mb-1">End Time</label>
                  <input type="time" required value={modalEndTime} onChange={(e) => setModalEndTime(e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2" />
                </div>
                <div className="flex-1 mb-2 text-sm font-mono text-zinc-600 text-right">
                  {calcDuration(modalStartTime, modalEndTime)}
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-zinc-900 text-white rounded-md text-sm font-medium hover:bg-zinc-800">Save Time</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Edit Time Block</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Project</label>
                <select required value={editProjectId} onChange={(e) => setEditProjectId(e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2">
                  <option value="">Select Project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
                <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Date</label>
                <input type="date" required value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2" />
              </div>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Start Time</label>
                  <input type="time" required value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 mb-1">End Time</label>
                  <input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2" />
                </div>
                <div className="flex-1 mb-2 text-sm font-mono text-zinc-600 text-right">
                  {calcDuration(editStartTime, editEndTime)}
                </div>
              </div>
              <div className="flex justify-between mt-6">
                <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md">Delete</button>
                <div className="space-x-3">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-zinc-900 text-white rounded-md text-sm font-medium hover:bg-zinc-800">Save</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}