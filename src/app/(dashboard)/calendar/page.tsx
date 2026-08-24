'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { EventDropArg, EventClickArg, DateSelectArg, EventContentArg } from '@fullcalendar/core'
import { EventResizeDoneArg } from '@fullcalendar/interaction'
import { useAuth } from '@/context/AuthContext'
import { useTimer } from '@/context/TimerContext'
import { getProjects, getTeamMembers } from '@/utils/supabase/api'
import { getMyRecentEntries, addManualEntry, updateTimeEntry, deleteTimeEntry } from '@/utils/supabase/timeApi'
import { Project, TimeEntry, Profile } from '@/types/supabase'
import { format, differenceInMinutes, startOfWeek, addWeeks, subWeeks, startOfToday, differenceInCalendarWeeks, differenceInCalendarDays, subDays } from 'date-fns'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAdmin } from '@/hooks/useAdmin'
import DescriptionAutocomplete from '@/components/DescriptionAutocomplete'

function renderEventContent(eventInfo: EventContentArg) {
  const { event } = eventInfo;
  const { projectName, description, durationStr, colorHex, isActive, isTentative } = event.extendedProps;
  
  const start = event.start;
  const end = event.end || new Date();
  const durationMins = start ? differenceInMinutes(end, start) : 60;
  const isShort = durationMins <= 45;
  
  return (
    <div 
      className={`w-full h-full flex ${isShort ? 'flex-row items-center px-1.5' : 'flex-col p-1.5'} rounded-sm shadow-sm overflow-hidden bg-zinc-100 dark:bg-zinc-800 transition-all ${isActive ? 'ring-1 ring-red-500/50 opacity-95' : ''}`}
      style={{ 
        borderLeft: `4px ${isTentative ? 'dashed' : 'solid'} ${colorHex}`,
        opacity: isTentative ? 0.7 : 1
      }}
    >
      <div className={`font-bold truncate ${isShort ? 'text-[10px] flex-1' : 'text-xs'}`} style={{ color: colorHex }}>
        {projectName} {isTentative && '(Tentative)'}
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
  const isAdmin = useAdmin()
  const { activeEntry } = useTimer()
  const [dbEvents, setDbEvents] = useState<any[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [team, setTeam] = useState<Profile[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [currentTime, setCurrentTime] = useState(new Date())

  // Custom Header States
  const calendarRef = useRef<any>(null)
  const [currentView, setCurrentView] = useState('timeGridWeek')
  const [currentDate, setCurrentDate] = useState(startOfToday())
  const [calendarTitle, setCalendarTitle] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalProjectId, setModalProjectId] = useState('')
  const [modalDesc, setModalDesc] = useState('')
  const [modalDate, setModalDate] = useState('')
  const [modalStartTime, setModalStartTime] = useState('')
  const [modalEndTime, setModalEndTime] = useState('')
  const [modalIsTentative, setModalIsTentative] = useState(false)

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editId, setEditId] = useState('')
  const [editProjectId, setEditProjectId] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [editIsTentative, setEditIsTentative] = useState(false)

  // Tick the current time every minute for the active timer block
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
	if (user) {
	  if (!selectedUserId) setSelectedUserId(user.id)
	  loadCalendarData(selectedUserId || user.id)
	}
  }, [user, selectedUserId])

  useEffect(() => {
	if (isAdmin) getTeamMembers().then(setTeam)
  }, [isAdmin])

  const loadCalendarData = async (targetUserId: string) => {
	if (!user) return
	const [projData, timeData] = await Promise.all([
	  getProjects(),
	  getMyRecentEntries(targetUserId)
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
        isActive: false,
        isTentative: entry.is_tentative || false,
        isPersonal: !!entry.projects?.user_id
      }
    }))
    setDbEvents(mappedEvents)
  }

  // Merge the active timer block with the saved logs
 const calendarEvents = useMemo(() => {
	const allEvents = [...dbEvents]
	if (activeEntry && (!selectedUserId || selectedUserId === user?.id)) {
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
          isActive: true,
          isTentative: false,
          isPersonal: !!activeEntry.projects?.user_id
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

  // Calculate Totals based on visible events
  const totals = useMemo(() => {
    let totalMins = 0;
    let forecastedMins = 0;
    let personalMins = 0;

    const startBound = currentView === 'timeGridWeek' ? startOfWeek(currentDate) : currentDate;
    const endBound = currentView === 'timeGridWeek' ? addWeeks(startBound, 1) : new Date(currentDate.getTime() + 86400000);

    calendarEvents.forEach(e => {
      const eStart = new Date(e.start);
      if (eStart >= startBound && eStart < endBound) {
        const mins = differenceInMinutes(new Date(e.end), eStart);
        if (e.extendedProps.isPersonal) {
          personalMins += mins;
        } else {
          forecastedMins += mins;
          if (!e.extendedProps.isTentative) totalMins += mins;
        }
      }
    });

    const fTotal = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;
    return {
      total: fTotal(totalMins),
      forecasted: fTotal(forecastedMins),
      personal: personalMins > 0 ? fTotal(personalMins) : null,
      showForecasted: totalMins !== forecastedMins
    };
  }, [calendarEvents, currentView, currentDate]);

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
    setModalIsTentative(false)
    setIsModalOpen(true)
    selectInfo.view.calendar.unselect() 
  }

  const handleEventClick = (clickInfo: EventClickArg) => {
    const { event } = clickInfo
    if (event.extendedProps.isActive) return // Prevent editing the active live timer
    setEditId(event.id)
    setEditProjectId(event.extendedProps.projectId)
    setEditDesc(event.extendedProps.description || '')
    setEditIsTentative(event.extendedProps.isTentative)
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
    if (modalEndTime < modalStartTime) endDateObj.setDate(endDateObj.getDate() + 1)

      await addManualEntry({
      user_id: selectedUserId || user.id,
      project_id: modalProjectId,
      description: modalDesc,
      start_time: startIso,
      end_time: endDateObj.toISOString(),
      is_tentative: modalIsTentative
	  })

	  setIsModalOpen(false)
	  setModalProjectId('')
	  setModalDesc('')
	  loadCalendarData(selectedUserId || user.id)
	}

  const handleEditSubmit = async (e: React.FormEvent, forceTentativeValue?: boolean) => {
    e?.preventDefault()
    if (!user || !editId) return
    const startIso = new Date(`${editDate}T${editStartTime}`).toISOString()
    let endIso = null
    if (editEndTime) {
      const endDateObj = new Date(`${editDate}T${editEndTime}`)
      if (editEndTime < editStartTime) endDateObj.setDate(endDateObj.getDate() + 1)
      endIso = endDateObj.toISOString()
    }

    await updateTimeEntry(editId, {
      project_id: editProjectId,
      description: editDesc,
      start_time: startIso,
      end_time: endIso,
      is_tentative: forceTentativeValue !== undefined ? forceTentativeValue : editIsTentative
	  })

	  setIsEditModalOpen(false)
	  loadCalendarData(selectedUserId || user.id)
	}

  const handleDelete = async () => {
    if (!user || !editId) return
    await deleteTimeEntry(editId)
    setIsEditModalOpen(false)
    loadCalendarData(selectedUserId || user.id)
  }

  // Header Actions
  const handleViewChange = (view: string) => {
    setCurrentView(view)
    calendarRef.current?.getApi().changeView(view)
  }

  const navigatePreset = (preset: string) => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    let date = new Date()
    if (preset === 'This week' || preset === 'Today') date = new Date()
    else if (preset === 'Last week') date = subWeeks(new Date(), 1)
    else if (preset === '2 weeks ago') date = subWeeks(new Date(), 2)
    else if (preset === 'Yesterday') date = subDays(new Date(), 1)
    else if (preset.endsWith('days ago')) {
      const days = parseInt(preset.split(' ')[0])
      date = subDays(new Date(), days)
    }
    
    api.gotoDate(date)
    setIsDropdownOpen(false)
  }

  const navigateArrow = (dir: 'prev' | 'next') => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    api[dir]()
  }

  const getDropdownLabel = () => {
    const today = startOfToday()
    if (currentView === 'timeGridWeek') {
      const diff = differenceInCalendarWeeks(today, currentDate, { weekStartsOn: 0 })
      if (diff === 0) return 'This week'
      if (diff === 1) return 'Last week'
      if (diff === 2) return '2 weeks ago'
      return `Week of ${format(startOfWeek(currentDate), 'MMM d')}`
    } else {
      const diff = differenceInCalendarDays(today, currentDate)
      if (diff === 0) return 'Today'
      if (diff === 1) return 'Yesterday'
      if (diff > 1 && diff <= 7) return `${diff} days ago`
      return format(currentDate, 'MMM d, yyyy')
    }
  }

  const dropdownPresets = currentView === 'timeGridWeek' 
    ? ['This week', 'Last week', '2 weeks ago']
    : ['Today', 'Yesterday', '2 days ago', '3 days ago', '4 days ago', '5 days ago', '6 days ago', '7 days ago']

  return (
    <div className="h-full flex flex-col space-y-4">
      <style>{`
        .dark {
          --fc-border-color: #27272a;
          --fc-today-bg-color: rgba(39, 39, 42, 0.5);
        }
        :root { --fc-now-indicator-color: #ef4444; }
        .fc-timegrid-event-harness > .fc-timegrid-event {
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
      `}</style>
      
      {/* CUSTOM HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-6 w-full md:w-auto">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-md p-1 shrink-0">
            <button onClick={() => handleViewChange('timeGridWeek')} className={`px-3 py-1 text-sm font-medium rounded ${currentView === 'timeGridWeek' ? 'bg-white dark:bg-zinc-950 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'}`}>Week</button>
            <button onClick={() => handleViewChange('timeGridDay')} className={`px-3 py-1 text-sm font-medium rounded ${currentView === 'timeGridDay' ? 'bg-white dark:bg-zinc-950 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'}`}>Day</button>
          </div>
          <div className="hidden md:block font-bold text-zinc-900 dark:text-zinc-100 text-lg">
            {calendarTitle}
          </div>
        </div>
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          {isAdmin && team.length > 0 && (
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-md text-xs md:text-sm px-2 py-1 text-zinc-900 dark:text-zinc-100 outline-none"
          >
            {team.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
          )}
          <div className="text-xs md:text-sm text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Total: {totals.total}</span>
            {totals.showForecasted && <span className="text-zinc-500 dark:text-zinc-400 ml-1">(Forecasted: {totals.forecasted})</span>}
            {totals.personal && <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">Personal: {totals.personal}</span>}
          </div>
          
          <div className="relative">
            <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800">
              {getDropdownLabel()}
              <ChevronDown size={16} />
            </button>
            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg z-50 overflow-hidden max-h-60 overflow-y-auto">
                {dropdownPresets.map(preset => (
                  <button key={preset} onClick={() => navigatePreset(preset)} className="block w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {preset}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => navigateArrow('prev')} className="p-2 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800"><ChevronLeft size={20} /></button>
            <button onClick={() => navigateArrow('next')} className="p-2 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800"><ChevronRight size={20} /></button>
          </div>
        </div>
      </div>

      <div className="md:hidden font-bold text-center text-zinc-900 dark:text-zinc-100 text-base">
        {calendarTitle}
      </div>
      
      <div className="flex-1 bg-white dark:bg-zinc-900 p-2 md:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm min-h-[500px] md:min-h-[600px] dark:text-zinc-100">
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={false}
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
          datesSet={(arg) => {
            setCalendarTitle(arg.view.title)
            setCurrentDate(arg.view.currentStart)
          }}
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
                <div className="flex justify-between items-end mb-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Description (Optional)</label>
                  {modalDesc.length >= 120 && <span className="text-[10px] text-red-500">{modalDesc.length}/80</span>}
                </div>
                <DescriptionAutocomplete
                  value={modalDesc}
                  onChange={(val, projId) => {
                  setModalDesc(val);
                  if (projId) setModalProjectId(projId);
                  }}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100"
                />
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
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="modalTentative" checked={modalIsTentative} onChange={(e) => setModalIsTentative(e.target.checked)} className="rounded border-zinc-300" />
                <label htmlFor="modalTentative" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Mark as Tentative</label>
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
                <div className="flex justify-between items-end mb-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</label>
                  {editDesc.length >= 120 && <span className="text-[10px] text-red-500">{editDesc.length}/80</span>}
                </div>
                <DescriptionAutocomplete
                  value={editDesc}
                  onChange={(val, projId) => {
                  setEditDesc(val);
                  if (projId) setEditProjectId(projId);
                  }}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100"
                />
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
              
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="editTentative" checked={editIsTentative} onChange={(e) => setEditIsTentative(e.target.checked)} className="rounded border-zinc-300" />
                <label htmlFor="editTentative" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Mark as Tentative</label>
              </div>

              <div className="flex justify-between mt-6 items-center">
                <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md">Delete</button>
                <div className="space-x-3">
                  <button type="button" onClick={(e) => handleEditSubmit(e, !editIsTentative)} className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md">
                    {editIsTentative ? 'Confirm Time' : 'Make Tentative'}
                  </button>
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