'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { getProjects, getTeamMembers } from '@/utils/supabase/api'
import { Project, Profile, TimeEntry } from '@/types/supabase'
import { format, subDays, differenceInMinutes, parseISO, startOfWeek, endOfWeek } from 'date-fns'
import { Download, ChevronDown } from 'lucide-react'

type ReportUser = {
  userName: string;
  totalMinutes: number;
  entries: TimeEntry[];
}

type ReportProject = {
  projectName: string;
  users: Record<string, ReportUser>;
}

export default function ReportsPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [team, setTeam] = useState<Profile[]>([])
  
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  
  // Array of project IDs instead of a single string
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const [selectedUser, setSelectedUser] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([getProjects(), getTeamMembers()]).then(([p, t]) => {
      setProjects(p)
      setTeam(t)
    })

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    loadReport()
  }, [startDate, endDate])

  const loadReport = async () => {
    setIsLoading(true)
    const { data } = await supabase
      .from('time_entries')
      .select('*, projects(*, clients(*)), profiles(full_name)')
      .gte('start_time', `${startDate}T00:00:00.000Z`)
      .lte('start_time', `${endDate}T23:59:59.999Z`)
      .not('end_time', 'is', null)
    
    setEntries(data || [])
    setIsLoading(false)
  }

  const toggleProject = (projectId: string) => {
    setSelectedProjects(prev => 
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    )
  }

  const aggregatedData = useMemo(() => {
    let filtered = entries

    if (selectedProjects.length > 0) {
      filtered = filtered.filter(e => selectedProjects.includes(e.project_id))
    }
    if (selectedUser) {
      filtered = filtered.filter(e => e.user_id === selectedUser)
    }

    const report: Record<string, ReportProject> = {}

    filtered.forEach(entry => {
      const pId = entry.project_id
      const uId = entry.user_id
      const mins = differenceInMinutes(parseISO(entry.end_time!), parseISO(entry.start_time))

      if (!report[pId]) {
        report[pId] = { projectName: entry.projects?.name || 'Unknown', users: {} }
      }
      if (!report[pId].users[uId]) {
        report[pId].users[uId] = { userName: entry.profiles?.full_name || 'Unknown User', totalMinutes: 0, entries: [] }
      }

      report[pId].users[uId].totalMinutes += mins
      report[pId].users[uId].entries.push(entry)
    })

    // Sort entries by date descending within users
    Object.values(report).forEach(p => {
      Object.values(p.users).forEach(u => {
        u.entries.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
      })
    })

    return report
  }, [entries, selectedProjects, selectedUser])

  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  }

  const formatHours = (mins: number) => {
    return `${(mins / 60).toFixed(1)}h`
  }

  const processedData = useMemo(() => {
    let filtered = entries

    if (selectedProjects.length > 0) {
      filtered = filtered.filter(e => selectedProjects.includes(e.project_id))
    }
    if (selectedUser) {
      filtered = filtered.filter(e => e.user_id === selectedUser)
    }

    const pSummary = new Map<string, { name: string, color: string, mins: number }>()
    const uSummary = new Map<string, { name: string, mins: number }>()
    const wGroups = new Map<string, { startDate: Date, mins: number, entries: TimeEntry[] }>()

    filtered.forEach(entry => {
      const mins = differenceInMinutes(parseISO(entry.end_time!), parseISO(entry.start_time))
      const pId = entry.project_id
      const uId = entry.user_id

      // Aggregate Project Summary
      if (!pSummary.has(pId)) {
        pSummary.set(pId, { name: entry.projects?.name || 'Unknown', color: entry.projects?.color_hex || '#ccc', mins: 0 })
      }
      pSummary.get(pId)!.mins += mins

      // Aggregate User Summary
      if (!uSummary.has(uId)) {
        uSummary.set(uId, { name: entry.profiles?.full_name || 'Unknown User', mins: 0 })
      }
      uSummary.get(uId)!.mins += mins

      // Aggregate Weekly Groups
      const start = parseISO(entry.start_time)
      const wStart = startOfWeek(start, { weekStartsOn: 1 })
      const wEnd = endOfWeek(start, { weekStartsOn: 1 })
      const weekLabel = `Week of ${format(wStart, 'MMM d')} - ${format(wEnd, 'MMM d')}`

      if (!wGroups.has(weekLabel)) {
        wGroups.set(weekLabel, { startDate: wStart, mins: 0, entries: [] })
      }
      const wData = wGroups.get(weekLabel)!
      wData.mins += mins
      wData.entries.push(entry)
    })

    return {
      projectSummaries: Array.from(pSummary.values()).sort((a, b) => b.mins - a.mins),
      userSummaries: Array.from(uSummary.values()).sort((a, b) => b.mins - a.mins),
      weeklyData: Array.from(wGroups.entries())
        .map(([label, data]) => ({
          label,
          startDate: data.startDate,
          mins: data.mins,
          entries: data.entries.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
        }))
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
    }
  }, [entries, selectedProjects, selectedUser])

  const handleExportCSV = () => {
    // Basic CSV export
    let csv = 'Project,Client,User,Date,Start,End,Duration (h),Description\n'
    entries.forEach(e => {
      if ((selectedProjects.length === 0 || selectedProjects.includes(e.project_id)) && 
          (!selectedUser || e.user_id === selectedUser)) {
        
        const duration = differenceInMinutes(parseISO(e.end_time!), parseISO(e.start_time)) / 60
        const date = format(parseISO(e.start_time), 'yyyy-MM-dd')
        const start = format(parseISO(e.start_time), 'HH:mm')
        const end = format(parseISO(e.end_time!), 'HH:mm')
        const desc = (e.description || '').replace(/,/g, '') // strip commas for basic csv
        const clientName = e.projects?.clients?.name || 'Personal'
        
        csv += `${e.projects?.name},${clientName},${e.profiles?.full_name},${date},${start},${end},${duration.toFixed(2)},${desc}\n`
      }
    })

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timetracker-report-${startDate}-to-${endDate}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Reports</h1>
        <button 
          onClick={handleExportCSV}
          disabled={entries.length === 0}
          className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-md hover:bg-zinc-800 dark:hover:bg-white disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:dark:text-zinc-500 transition-colors text-sm font-medium"
        >
          <Download size={16} />
          Export to CSV
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">End Date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" />
        </div>
        
        <div className="relative" ref={dropdownRef}>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Filter by Project</label>
          <div 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 cursor-pointer flex justify-between items-center"
          >
            <span className="truncate">
              {selectedProjects.length === 0 ? 'All Projects' : `${selectedProjects.length} Selected`}
            </span>
            <ChevronDown size={14} className="text-zinc-500" />
          </div>
          
          {isDropdownOpen && (
            <div className="absolute z-10 mt-1 w-[350px] max-h-60 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg p-2">
              {projects.map(p => (
                <label key={p.id} className="flex items-center gap-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedProjects.includes(p.id)}
                    onChange={() => toggleProject(p.id)}
                    className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-900"
                  />
                  <div className="flex-1 flex justify-between items-center overflow-hidden">
                    <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{p.name}</span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-2 shrink-0">{p.user_id ? 'Personal' : p.clients?.name}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Filter by User</label>
          <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
            <option value="">All Team Members</option>
            {team.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-500 dark:text-zinc-400 shadow-sm">
          Loading report...
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-zinc-500 dark:text-zinc-400 shadow-sm">
          No completed time entries found for these filters.
        </div>
      ) : (
        <>
          {/* Summaries Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="bg-zinc-50 dark:bg-zinc-950 px-6 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="font-semibold text-sm text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Project Summary</h3>
              </div>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-64 overflow-y-auto">
                {processedData.projectSummaries.map((proj, idx) => (
                  <li key={idx} className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 truncate pr-4">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />
                      <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{proj.name}</span>
                    </div>
                    <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100 shrink-0">{formatMins(proj.mins)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="bg-zinc-50 dark:bg-zinc-950 px-6 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="font-semibold text-sm text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">User Summary</h3>
              </div>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-64 overflow-y-auto">
                {processedData.userSummaries.map((user, idx) => (
                  <li key={idx} className="px-6 py-3 flex items-center justify-between">
                    <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate pr-4">{user.name}</span>
                    <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100 shrink-0">{formatMins(user.mins)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Detailed Entries Section */}
          <div className="space-y-6">
            {processedData.weeklyData.map((week, wIdx) => (
              <div key={wIdx} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="bg-zinc-50 dark:bg-zinc-950 px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                  <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{week.label}</h3>
                  <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">{formatMins(week.mins)}</span>
                </div>
                
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {week.entries.map(entry => (
                    <div key={entry.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-6 py-4 items-center hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <div className="md:col-span-2 font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
                        {entry.profiles?.full_name}
                      </div>
                      <div className="md:col-span-4 text-sm text-zinc-700 dark:text-zinc-300 truncate">
                        {entry.description || '-'}
                      </div>
                      <div className="md:col-span-2 flex items-center gap-2 overflow-hidden">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.projects?.color_hex || '#ccc' }} />
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate uppercase tracking-wider">{entry.projects?.name}</span>
                      </div>
                      <div className="md:col-span-3 text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                        {format(parseISO(entry.start_time), 'MMM d, h:mm a')} <span className="mx-1 text-zinc-300 dark:text-zinc-700">-</span> {format(parseISO(entry.end_time!), 'h:mm a')}
                      </div>
                      <div className="md:col-span-1 text-left md:text-right font-mono text-sm text-zinc-900 dark:text-zinc-100">
                        {formatMins(differenceInMinutes(parseISO(entry.end_time!), parseISO(entry.start_time)))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}