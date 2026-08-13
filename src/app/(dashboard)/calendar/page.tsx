'use client'
import { useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { EventDropArg } from '@fullcalendar/core'
import { EventResizeDoneArg } from '@fullcalendar/interaction'
import { DateSelectArg } from '@fullcalendar/core'
import { useAuth } from '@/context/AuthContext'
import { getProjects } from '@/utils/supabase/api'
import { getMyRecentEntries, addManualEntry, updateTimeEntry } from '@/utils/supabase/timeApi'
import { Project, TimeEntry } from '@/types/supabase'

export default function CalendarPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<any[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedRange, setSelectedRange] = useState<{ start: Date; end: Date } | null>(null)
  const [modalProjectId, setModalProjectId] = useState('')
  const [modalDesc, setModalDesc] = useState('')

  useEffect(() => {
    if (user) {
      loadCalendarData()
    }
  }, [user])

  const loadCalendarData = async () => {
    if (!user) return
    const [projData, timeData] = await Promise.all([
      getProjects(),
      getMyRecentEntries(user.id) // In a production app, you would filter this by the calendar's active date range
    ])
    
    setProjects(projData)
    
    // Map time_entries to FullCalendar event objects
    const mappedEvents = timeData.map((entry: TimeEntry) => ({
      id: entry.id,
      title: `${entry.projects?.name}${entry.description ? ': ' + entry.description : ''}`,
      start: entry.start_time,
      end: entry.end_time || new Date().toISOString(), // Fallback for running timers
      backgroundColor: entry.projects?.color_hex || '#3788d8',
      borderColor: entry.projects?.color_hex || '#3788d8',
      extendedProps: {
        projectId: entry.project_id,
        description: entry.description
      }
    }))
    setEvents(mappedEvents)
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
      await updateTimeEntry(event.id, {
        end_time: event.end.toISOString()
      })
    } catch (error) {
      console.error('Error resizing event:', error)
      resizeInfo.revert()
    }
  }

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    setSelectedRange({ start: selectInfo.start, end: selectInfo.end })
    setIsModalOpen(true)
    const calendarApi = selectInfo.view.calendar
    calendarApi.unselect() 
  }

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedRange || !modalProjectId) return

    await addManualEntry({
      user_id: user.id,
      project_id: modalProjectId,
      description: modalDesc,
      start_time: selectedRange.start.toISOString(),
      end_time: selectedRange.end.toISOString()
    })

    setIsModalOpen(false)
    setModalProjectId('')
    setModalDesc('')
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
          editable={true} // Enables drag/drop and resize
          selectable={true} // Enables click-and-drag to create
          selectMirror={true}
          dayMaxEvents={true}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          select={handleDateSelect}
          height="100%"
          slotMinTime="06:00:00" // Customize based on typical working hours
          slotMaxTime="22:00:00"
        />
      </div>

      {/* New Time Block Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Log Time Block</h2>
            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Project</label>
                <select 
                  required 
                  value={modalProjectId} 
                  onChange={(e) => setModalProjectId(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2"
                >
                  <option value="">Select Project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Description (Optional)</label>
                <input 
                  type="text" 
                  value={modalDesc} 
                  onChange={(e) => setModalDesc(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-zinc-900 text-white rounded-md text-sm font-medium hover:bg-zinc-800"
                >
                  Save Time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}