'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { getProjects, getTeamMembers } from '@/utils/supabase/api'
import { Project, Profile, TimeEntry } from '@/types/supabase'
import { format, subDays, differenceInMinutes, parseISO } from 'date-fns'
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

  const formatHours = (mins: number) => {
    return `${(mins / 60).toFixed(1)}h`
  }

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
        
        {/* Custom Multi-Select Dropdown for Projects */}
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

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">Loading report...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">No completed time entries found for these filters.</div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {Object.values(aggregatedData).map((project, idx) => (
              <div key={idx} className="p-0">
                <div className="bg-zinc-50 dark:bg-zinc-950 px-6 py-3 border-b border-zinc-200 dark:border-zinc-800">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{project.projectName}</h3>
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {Object.values(project.users).map((user, uIdx) => (
                    <div key={uIdx} className="px-6 py-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{user.userName}</span>
                        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {formatHours(user.totalMinutes)}
                        </span>
                      </div>
                      
                      {/* Individual Entries List */}
                      <div className="space-y-2">
                        {user.entries.map((entry) => (
                          <div key={entry.id} className="flex justify-between items-center text-sm pl-4 border-l-2 border-zinc-200 dark:border-zinc-700">
                            <div className="flex flex-col">
                              <span className="text-zinc-800 dark:text-zinc-200">{entry.description || 'No description'}</span>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                {format(parseISO(entry.start_time), 'MMM d, h:mm a')} - {format(parseISO(entry.end_time!), 'h:mm a')}
                              </span>
                            </div>
                            <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                              {formatHours(differenceInMinutes(parseISO(entry.end_time!), parseISO(entry.start_time)))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}