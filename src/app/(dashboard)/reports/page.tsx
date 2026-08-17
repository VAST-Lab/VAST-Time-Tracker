'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { getProjects, getTeamMembers } from '@/utils/supabase/api'
import { bulkInsertTimeEntries } from '@/utils/supabase/timeApi'
import { Project, Profile, TimeEntry } from '@/types/supabase'
import { format, subDays, differenceInMinutes, parseISO, startOfWeek, endOfWeek } from 'date-fns'
import { Download, ChevronDown, Upload, X } from 'lucide-react'
import { useAdmin } from '@/hooks/useAdmin'

type ReportUser = {
  userName: string;
  totalMinutes: number;
  entries: TimeEntry[];
}

type ReportProject = {
  projectName: string;
  users: Record<string, ReportUser>;
}

function parseCSVLine(text: string) {
  const ret = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') inQuote = !inQuote;
    else if (text[i] === ',' && !inQuote) {
      ret.push(cur.trim());
      cur = '';
    } else {
      cur += text[i];
    }
  }
  ret.push(cur.trim());
  return ret.map(s => s.replace(/^"|"$/g, '').trim());
}

export default function ReportsPage() {
  const isAdmin = useAdmin()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [team, setTeam] = useState<Profile[]>([])
  
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const [selectedUser, setSelectedUser] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Import Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importStep, setImportStep] = useState<1 | 2>(1)
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  
  const [csvUsers, setCsvUsers] = useState<string[]>([])
  const [csvProjects, setCsvProjects] = useState<string[]>([])
  
  const [userMapping, setUserMapping] = useState<Record<string, string>>({})
  const [projectMapping, setProjectMapping] = useState<Record<string, string>>({})

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

      if (!pSummary.has(pId)) {
        pSummary.set(pId, { name: entry.projects?.name || 'Unknown', color: entry.projects?.color_hex || '#ccc', mins: 0 })
      }
      pSummary.get(pId)!.mins += mins

      if (!uSummary.has(uId)) {
        uSummary.set(uId, { name: entry.profiles?.full_name || 'Unknown User', mins: 0 })
      }
      uSummary.get(uId)!.mins += mins

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

  const formatHours = (mins: number) => {
    return `${(mins / 60).toFixed(1)}h`
  }
  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  }

  const handleExportCSV = () => {
    let csv = 'Project,Description,Client,User,Date,Start Time,End Time,Duration (h)\n'
    entries.forEach(e => {
      if ((selectedProjects.length === 0 || selectedProjects.includes(e.project_id)) && 
          (!selectedUser || e.user_id === selectedUser)) {
        
        const duration = differenceInMinutes(parseISO(e.end_time!), parseISO(e.start_time)) / 60
        const date = format(parseISO(e.start_time), 'yyyy-MM-dd')
        const start = format(parseISO(e.start_time), 'HH:mm')
        const end = format(parseISO(e.end_time!), 'HH:mm')
        
        const desc = `"${(e.description || '').replace(/"/g, '""')}"`
        const projectName = `"${(e.projects?.name || '').replace(/"/g, '""')}"`
        const clientName = `"${(e.projects?.clients?.name || 'Personal').replace(/"/g, '""')}"`
        const userName = `"${(e.profiles?.full_name || '').replace(/"/g, '""')}"`
        
        csv += `${projectName},${desc},${clientName},${userName},${date},${start},${end},${duration.toFixed(2)}\n`
      }
    })

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timetracker-report-${startDate}-to-${endDate}.csv`
    a.click()
  }

  // --- IMPORT LOGIC ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return alert("File appears to be empty or missing data.")

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase())
    const rows = lines.slice(1).map(parseCSVLine).filter(r => r.length === headers.length)

    const reqCols = ['project', 'user', 'date', 'start time', 'end time']
    const missing = reqCols.filter(c => !headers.includes(c))
    if (missing.length > 0) {
      return alert(`Missing required columns: ${missing.join(', ')}`)
    }

    const uIdx = headers.indexOf('user')
    const pIdx = headers.indexOf('project')

    const uniqueUsers = Array.from(new Set(rows.map(r => r[uIdx]).filter(Boolean)))
    const uniqueProjects = Array.from(new Set(rows.map(r => r[pIdx]).filter(Boolean)))

    // Auto-map based on exact string match
    const initialUserMap: Record<string, string> = {}
    uniqueUsers.forEach(cu => {
      const match = team.find(t => t.full_name.toLowerCase() === cu.toLowerCase())
      if (match) initialUserMap[cu] = match.id
    })

    const initialProjectMap: Record<string, string> = {}
    uniqueProjects.forEach(cp => {
      const match = projects.find(p => p.name.toLowerCase() === cp.toLowerCase())
      if (match) initialProjectMap[cp] = match.id
    })

    setCsvHeaders(headers)
    setCsvRows(rows)
    setCsvUsers(uniqueUsers)
    setCsvProjects(uniqueProjects)
    setUserMapping(initialUserMap)
    setProjectMapping(initialProjectMap)
    setImportStep(2)
  }

  const handleConfirmImport = async () => {
    const missingUser = csvUsers.find(u => !userMapping[u])
    if (missingUser) return alert(`Please map a user for: ${missingUser}`)
    
    const missingProj = csvProjects.find(p => !projectMapping[p])
    if (missingProj) return alert(`Please map a project for: ${missingProj}`)

    const uIdx = csvHeaders.indexOf('user')
    const pIdx = csvHeaders.indexOf('project')
    const dIdx = csvHeaders.indexOf('date')
    const startIdx = csvHeaders.indexOf('start time')
    const endIdx = csvHeaders.indexOf('end time')
    const descIdx = csvHeaders.indexOf('description')

    const toInsert = []
    
    for (const r of csvRows) {
      const dateVal = r[dIdx]
      const startVal = r[startIdx]
      const endVal = r[endIdx]

      const parsedStart = new Date(`${dateVal} ${startVal}`)
      if (isNaN(parsedStart.getTime())) {
        return alert(`Invalid date/time format for row: ${dateVal} ${startVal}`)
      }

      let endIso = null
      if (endVal) {
        const parsedEnd = new Date(`${dateVal} ${endVal}`)
        if (isNaN(parsedEnd.getTime())) {
          return alert(`Invalid date/time format for row: ${dateVal} ${endVal}`)
        }
        endIso = parsedEnd.toISOString()
      }

      toInsert.push({
        user_id: userMapping[r[uIdx]],
        project_id: projectMapping[r[pIdx]],
        description: descIdx > -1 ? r[descIdx] : '',
        start_time: parsedStart.toISOString(),
        end_time: endIso,
      })
    }

    try {
      const userIds = Array.from(new Set(toInsert.map(t => t.user_id)))
      const { data: existingData, error: fetchErr } = await supabase
        .from('time_entries')
        .select('user_id, project_id, start_time, end_time')
        .in('user_id', userIds)

      if (fetchErr) throw fetchErr

      const newEntries = toInsert.filter(newItem => {
        return !existingData?.some(existing => 
          existing.user_id === newItem.user_id &&
          existing.project_id === newItem.project_id &&
          existing.start_time === newItem.start_time &&
          existing.end_time === newItem.end_time
        )
      })

      if (newEntries.length === 0) {
        alert("All entries are duplicates. Nothing to import.")
        closeImportModal()
        return
      }

      await bulkInsertTimeEntries(newEntries)
      alert(`Successfully imported ${newEntries.length} time entries! (${toInsert.length - newEntries.length} duplicates skipped)`)
      closeImportModal()
      loadReport()
    } catch (error: any) {
      alert(`Import failed: ${error.message}`)
    }
  }

  const closeImportModal = () => {
    setIsImportModalOpen(false)
    setImportStep(1)
    setCsvRows([])
    setCsvHeaders([])
    setUserMapping({})
    setProjectMapping({})
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Reports</h1>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 px-4 py-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-medium"
            >
              <Upload size={16} />
              Import Data
            </button>
          )}
          <button 
            onClick={handleExportCSV}
            disabled={entries.length === 0}
            className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-md hover:bg-zinc-800 dark:hover:bg-white disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:dark:text-zinc-500 transition-colors text-sm font-medium"
          >
            <Download size={16} />
            Export to CSV
          </button>
        </div>
      </div>

      {/* FILTERS */}
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

      {/* IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-lg w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Bulk Import Time Logs</h2>
              <button onClick={closeImportModal} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"><X size={20} /></button>
            </div>
            
            {importStep === 1 ? (
              <div className="flex-1">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                  Upload a CSV file. It must include the following column headers exactly: 
                  <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1 mx-1 rounded">Project</span>, 
                  <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1 mx-1 rounded">User</span>, 
                  <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1 mx-1 rounded">Date</span> (YYYY-MM-DD), 
                  <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1 mx-1 rounded">Start Time</span> (HH:mm), and 
                  <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1 mx-1 rounded">End Time</span> (HH:mm). 
                  <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1 mx-1 rounded">Description</span> is optional.
                </p>
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-zinc-500 dark:text-zinc-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-zinc-100 file:text-zinc-700
                    dark:file:bg-zinc-800 dark:file:text-zinc-200
                    hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700"
                />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3 border-b border-zinc-200 dark:border-zinc-800 pb-2">Map Users</h3>
                  {csvUsers.map(u => (
                    <div key={u} className="flex items-center justify-between mb-3">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium truncate pr-4">{u}</span>
                      <select 
                        value={userMapping[u] || ''} 
                        onChange={e => setUserMapping({...userMapping, [u]: e.target.value})}
                        className="w-1/2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="">Select User...</option>
                        {team.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3 border-b border-zinc-200 dark:border-zinc-800 pb-2">Map Projects</h3>
                  {csvProjects.map(p => (
                    <div key={p} className="flex items-center justify-between mb-3">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium truncate pr-4">{p}</span>
                      <select 
                        value={projectMapping[p] || ''} 
                        onChange={e => setProjectMapping({...projectMapping, [p]: e.target.value})}
                        className="w-1/2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="">Select Project...</option>
                        {projects.map(dbP => <option key={dbP.id} value={dbP.id}>{dbP.name} {dbP.client_id ? `(${dbP.clients?.name})` : '(Personal)'}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <button onClick={closeImportModal} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Cancel</button>
                  <button onClick={handleConfirmImport} className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-800 dark:hover:bg-white">Confirm Import ({csvRows.length} Rows)</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}