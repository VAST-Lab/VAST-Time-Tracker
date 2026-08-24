'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/utils/supabase/client'
import { getProjects, getTeamMembers, getClients, createProject, getGroups } from '@/utils/supabase/api'
import { updateTimeEntry, deleteTimeEntry, bulkInsertTimeEntries, bulkUpdateTimeEntries } from '@/utils/supabase/timeApi'
import { Project, Profile, TimeEntry, Client, Group } from '@/types/supabase'
import { format, subDays, differenceInMinutes, parseISO, startOfWeek, endOfWeek, startOfToday } from 'date-fns'
import { Download, ChevronDown, Upload, X, Edit2, Trash2 } from 'lucide-react'
import { useAdmin } from '@/hooks/useAdmin'
import { useAuth } from '@/context/AuthContext'
import DateRangePicker from '@/components/DateRangePicker'
import DescriptionAutocomplete from '@/components/DescriptionAutocomplete'

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
  const { user } = useAuth()
  const isAdmin = useAdmin()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [team, setTeam] = useState<Profile[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  
  const [startDate, setStartDate] = useState(format(startOfWeek(startOfToday()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfWeek(startOfToday()), 'yyyy-MM-dd'))
  
  // Filter States
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)
  const clientDropdownRef = useRef<HTMLDivElement>(null)

  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false)
  const projectDropdownRef = useRef<HTMLDivElement>(null)
  
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)
  const userDropdownRef = useRef<HTMLDivElement>(null)

  const [filterDescription, setFilterDescription] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Group States
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false)
  const groupDropdownRef = useRef<HTMLDivElement>(null)

  // Edit States
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [editProjectId, setEditProjectId] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')

  // Bulk Edit States
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false)
  const [bulkEditProjectId, setBulkEditProjectId] = useState('')
  const [bulkEditUserId, setBulkEditUserId] = useState('')
  const [bulkEditDescription, setBulkEditDescription] = useState('')
  const [bulkClearDescription, setBulkClearDescription] = useState(false)
  const [isBulkEditing, setIsBulkEditing] = useState(false)

  // Import Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importStep, setImportStep] = useState<1 | 2>(1)
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  
  const [csvUsers, setCsvUsers] = useState<string[]>([])
  const [csvProjects, setCsvProjects] = useState<string[]>([])
  
  const [userMapping, setUserMapping] = useState<Record<string, string>>({})
  const [projectMapping, setProjectMapping] = useState<Record<string, string>>({})

  // Cleanup Modal States
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false)
  const [cleanupDate, setCleanupDate] = useState('')
  const [cleanupUserId, setCleanupUserId] = useState('')
  const [isCleaning, setIsCleaning] = useState(false)

  // Inline Create Project States
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false)
  const [createProjectCsvKey, setCreateProjectCsvKey] = useState('')
  const [createProjectName, setCreateProjectName] = useState('')
  const [createProjectClientId, setCreateProjectClientId] = useState('')
  const [createProjectColor, setCreateProjectColor] = useState('#FF5733')

  useEffect(() => {
    Promise.all([getProjects(), getTeamMembers(), getClients(), getGroups()]).then(([p, t, c, g]) => {
      setProjects(p)
      setTeam(t)
      setGroups(g)
      const activeClients = c.filter(client => client.is_active)
      setClients(activeClients)
      // Default to all actual clients, explicitly excluding 'personal'
      setSelectedClients(activeClients.map(client => client.id))
    })

    const handleClickOutside = (event: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false)
      }
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false)
      }
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(event.target as Node)) {
        setIsGroupDropdownOpen(false)
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false)
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

  const toggleClient = (id: string) => {
    setSelectedClients(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const toggleProject = (id: string) => {
    setSelectedProjects(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const toggleGroup = (id: string) => {
    setSelectedGroups(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const toggleUser = (id: string) => {
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const processedData = useMemo(() => {
    let filtered = entries.filter(e => !e.is_tentative);

    // Filter by Client
    filtered = filtered.filter(e => {
      const cId = e.projects?.client_id || 'personal'
      return selectedClients.includes(cId)
    })

    if (selectedProjects.length > 0) {
      filtered = filtered.filter(e => selectedProjects.includes(e.project_id))
    }

    // Filter by Access Group
    if (selectedGroups.length > 0) {
      const validUserIds = team.filter(u => u.group_id && selectedGroups.includes(u.group_id)).map(u => u.id)
      filtered = filtered.filter(e => validUserIds.includes(e.user_id))
    }

    if (selectedUsers.length > 0) {
      filtered = filtered.filter(e => selectedUsers.includes(e.user_id))
    }

    // Filter by description
    if (filterDescription) {
      filtered = filtered.filter(e => e.description?.toLowerCase().includes(filterDescription.toLowerCase()))
    }

    const pSummary = new Map<string, { name: string, color: string, mins: number }>()
    const uSummary = new Map<string, { name: string, mins: number }>()
    const wGroups = new Map<string, { startDate: Date, mins: number, entries: TimeEntry[] }>()

    filtered.forEach(entry => {
      let mins = differenceInMinutes(parseISO(entry.end_time!), parseISO(entry.start_time))
      if (mins < 0) mins += 1440 // Fallback for legacy negative logs

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
      filteredEntries: filtered, // Expose filtered entries for bulk editing
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
  }, [entries, selectedClients, selectedProjects, selectedGroups, selectedUsers, filterDescription])

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
      const cId = e.projects?.client_id || 'personal'
      const passClient = selectedClients.includes(cId)
      const passProject = selectedProjects.length === 0 || selectedProjects.includes(e.project_id)
      
      let passGroup = true
      if (selectedGroups.length > 0) {
        const userObj = team.find(u => u.id === e.user_id)
        passGroup = !!userObj?.group_id && selectedGroups.includes(userObj.group_id)
      }

      const passUser = selectedUsers.length === 0 || selectedUsers.includes(e.user_id)

      if (passClient && passProject && passGroup && passUser) {
        let mins = differenceInMinutes(parseISO(e.end_time!), parseISO(e.start_time))
        if (mins < 0) mins += 1440
        const duration = mins / 60
        
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

    const initialUserMap: Record<string, string> = {}
    uniqueUsers.forEach(cu => {
      const match = team.find(t => t.full_name.toLowerCase() === cu.toLowerCase())
      if (match) initialUserMap[cu] = match.id
    })

    const initialProjectMap: Record<string, string> = {}
    uniqueProjects.forEach(cp => {
      const lowerCp = cp.toLowerCase()
      let match = projects.find(p => p.name.toLowerCase() === lowerCp)
      if (!match) {
        match = projects.find(p => p.name.toLowerCase().includes(lowerCp) || lowerCp.includes(p.name.toLowerCase()))
      }
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
    const uIdx = csvHeaders.indexOf('user')
    const pIdx = csvHeaders.indexOf('project')
    const dIdx = csvHeaders.indexOf('date')
    const startIdx = csvHeaders.indexOf('start time')
    const endIdx = csvHeaders.indexOf('end time')
    const descIdx = csvHeaders.indexOf('description')

    const toInsert = []
    
    for (const r of csvRows) {
      const uId = userMapping[r[uIdx]]
      const pId = projectMapping[r[pIdx]]
      
      if (!uId || !pId) continue

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
        
        if (parsedEnd < parsedStart) {
          parsedEnd.setDate(parsedEnd.getDate() + 1)
        }
        endIso = parsedEnd.toISOString()
      }

      toInsert.push({
        user_id: uId,
        project_id: pId,
        description: descIdx > -1 ? r[descIdx] : '',
        start_time: parsedStart.toISOString(),
        end_time: endIso,
      })
    }

    if (toInsert.length === 0) {
      alert("No mapped rows available to import.")
      return
    }

    try {
      const userIds = Array.from(new Set(toInsert.map(t => t.user_id)))
      const { data: existingData, error: fetchErr } = await supabase
        .from('time_entries')
        .select('user_id, project_id, start_time, end_time')
        .in('user_id', userIds)

      if (fetchErr) throw fetchErr

      const newEntries = toInsert.filter(newItem => {
        return !existingData?.some(existing => {
          const isSameUser = existing.user_id === newItem.user_id
          const isSameProject = existing.project_id === newItem.project_id
          
          // Compare exact numeric time values, as ISO string formatting (milliseconds, Z vs +00:00) can differ between JS and the DB
          const existingStart = new Date(existing.start_time).getTime()
          const newStart = new Date(newItem.start_time).getTime()
          const isSameStart = existingStart === newStart

          let isSameEnd = false
          if (!existing.end_time && !newItem.end_time) {
            isSameEnd = true
          } else if (existing.end_time && newItem.end_time) {
            isSameEnd = new Date(existing.end_time).getTime() === new Date(newItem.end_time).getTime()
          }

          return isSameUser && isSameProject && isSameStart && isSameEnd
        })
      })

      if (newEntries.length === 0) {
        alert("All mapped entries are duplicates. Nothing to import.")
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

  const handleCreateInlineProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createProjectName || !user) return

    const isPersonal = !isAdmin || createProjectClientId === 'personal'
    
    try {
      const newProj = await createProject({
        name: createProjectName,
        client_id: isPersonal ? null : createProjectClientId,
        user_id: isPersonal ? user.id : null,
        color_hex: createProjectColor
      })

      setProjects(prev => [...prev, newProj])
      
      if (createProjectCsvKey) {
        setProjectMapping(prev => ({...prev, [createProjectCsvKey]: newProj.id}))
      }

      setIsCreateProjectModalOpen(false)
      setCreateProjectName('')
      setCreateProjectCsvKey('')
    } catch (error: any) {
      alert(`Failed to create project: ${error.message}`)
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

  const rowsToImportCount = csvRows.filter(r => {
    const uIdx = csvHeaders.indexOf('user')
    const pIdx = csvHeaders.indexOf('project')
    return userMapping[r[uIdx]] && projectMapping[r[pIdx]]
  }).length

  const clientOptions = [...clients.map(c => ({ id: c.id, name: c.name })), { id: 'personal', name: 'Personal Projects' }]
  const visibleProjects = projects.filter(p => selectedClients.includes(p.client_id || 'personal'))
  const visibleUsers = selectedGroups.length > 0 ? team.filter(u => u.group_id && selectedGroups.includes(u.group_id)) : team

  // Edit entries
  const openEditModal = (entry: TimeEntry) => {
    const start = parseISO(entry.start_time)
    setEditProjectId(entry.project_id || '')
    setEditDescription(entry.description || '')
    setEditDate(format(start, 'yyyy-MM-dd'))
    setEditStartTime(format(start, 'HH:mm'))
    setEditEndTime(entry.end_time ? format(parseISO(entry.end_time), 'HH:mm') : '')
    setEditingEntry(entry)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEntry || editingEntry.user_id !== user?.id) return

    const startIso = new Date(`${editDate}T${editStartTime}`).toISOString()
    let endIso = null
    if (editEndTime) {
      const endDateObj = new Date(`${editDate}T${editEndTime}`)
      if (editEndTime < editStartTime) {
        endDateObj.setDate(endDateObj.getDate() + 1)
      }
      endIso = endDateObj.toISOString()
    }

    await updateTimeEntry(editingEntry.id, {
      project_id: editProjectId || null as any,
      description: editDescription,
      start_time: startIso,
      end_time: endIso
    })

    setEditingEntry(null)
    loadReport()
  }

  const handleDelete = async () => {
    if (!editingEntry) return
    await deleteTimeEntry(editingEntry.id)
    setEditingEntry(null)
    loadReport()
  }

  // Bulk Edit entries
  const handleBulkEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (processedData.filteredEntries.length === 0) return

    const updates: Partial<TimeEntry> = {}
    if (bulkEditProjectId) updates.project_id = bulkEditProjectId
    if (bulkEditUserId) updates.user_id = bulkEditUserId
    if (bulkClearDescription) {
      updates.description = ''
    } else if (bulkEditDescription) {
      updates.description = bulkEditDescription
    }

    if (Object.keys(updates).length === 0) {
      alert("No changes specified.")
      return
    }

    // Limit modifications to own logs unless Admin
    let targetIds = processedData.filteredEntries.map(e => e.id)
    if (!isAdmin) {
       targetIds = processedData.filteredEntries.filter(e => e.user_id === user?.id).map(e => e.id)
    }

    if (targetIds.length === 0) {
      alert("You do not have permission to edit the selected entries.")
      return
    }

    setIsBulkEditing(true)
    try {
      await bulkUpdateTimeEntries(targetIds, updates)
      alert(`Successfully updated ${targetIds.length} entries!`)
      setIsBulkEditModalOpen(false)
      setBulkEditProjectId('')
      setBulkEditUserId('')
      setBulkEditDescription('')
      setBulkClearDescription(false)
      loadReport()
    } catch (error: any) {
      alert(`Bulk edit failed: ${error.message}`)
    } finally {
      setIsBulkEditing(false)
    }
  }

  // --- CLEANUP LOGIC ---
  const handleCleanupDuplicates = async () => {
    if (!confirm("Are you sure you want to scan for and delete all duplicate time entries? This cannot be undone.")) return
    setIsCleaning(true)
    try {
      const { data: allEntries, error } = await supabase
        .from('time_entries')
        .select('id, user_id, project_id, start_time, end_time')

      if (error) throw error

      const seen = new Set<string>()
      const duplicateIds: string[] = []

      for (const e of allEntries || []) {
        const startMs = new Date(e.start_time).getTime()
        const endMs = e.end_time ? new Date(e.end_time).getTime() : 'null'
        const key = `${e.user_id}|${e.project_id}|${startMs}|${endMs}`

        if (seen.has(key)) {
          duplicateIds.push(e.id)
        } else {
          seen.add(key)
        }
      }

      if (duplicateIds.length === 0) {
        alert("No duplicates found!")
      } else {
        // Chunk deletions if there are too many to avoid URI too long errors
        const chunkSize = 500
        for (let i = 0; i < duplicateIds.length; i += chunkSize) {
          const chunk = duplicateIds.slice(i, i + chunkSize)
          await supabase.from('time_entries').delete().in('id', chunk)
        }
        alert(`Successfully removed ${duplicateIds.length} duplicate entries!`)
        loadReport()
      }
    } catch (error: any) {
      alert(`Failed to clean duplicates: ${error.message}`)
    } finally {
      setIsCleaning(false)
    }
  }

  const handleCleanupByDate = async () => {
    if (!cleanupDate) return
    if (!confirm(`Are you sure you want to delete ALL time entries before ${cleanupDate}? This cannot be undone.`)) return
    setIsCleaning(true)
    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .lt('start_time', `${cleanupDate}T00:00:00.000Z`)

      if (error) throw error
      alert(`Successfully deleted entries before ${cleanupDate}!`)
      setCleanupDate('')
      loadReport()
    } catch (error: any) {
      alert(`Failed to delete old entries: ${error.message}`)
    } finally {
      setIsCleaning(false)
    }
  }

  const handleCleanupByUser = async () => {
    if (!cleanupUserId) return
    const userToDelete = team.find(t => t.id === cleanupUserId)
    if (!confirm(`Are you sure you want to delete ALL time entries for ${userToDelete?.full_name}? This cannot be undone.`)) return
    setIsCleaning(true)
    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('user_id', cleanupUserId)

      if (error) throw error
      alert(`Successfully deleted all entries for ${userToDelete?.full_name}!`)
      setCleanupUserId('')
      loadReport()
    } catch (error: any) {
      alert(`Failed to delete user entries: ${error.message}`)
    } finally {
      setIsCleaning(false)
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 md:gap-4">
        <h1 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-zinc-100">Reports</h1>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          
          <button 
            onClick={() => setIsBulkEditModalOpen(true)}
            disabled={processedData.filteredEntries.length === 0}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 px-3 md:px-4 py-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-xs md:text-sm font-medium disabled:opacity-50"
          >
            <Edit2 size={16} />
            Bulk Edit
          </button>

          {isAdmin && (
            <>
              <button 
                onClick={() => setIsCleanupModalOpen(true)}
                className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 md:px-4 py-2 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-xs md:text-sm font-medium"
              >
                <Trash2 size={16} />
                Cleanup
              </button>
              <button 
                onClick={() => setIsImportModalOpen(true)}
                className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 px-3 md:px-4 py-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-xs md:text-sm font-medium"
              >
                <Upload size={16} />
                Import Data
              </button>
            </>
          )}
          <button 
            onClick={handleExportCSV}
            disabled={entries.length === 0}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 md:px-4 py-2 rounded-md hover:bg-zinc-800 dark:hover:bg-white disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:dark:text-zinc-500 transition-colors text-xs md:text-sm font-medium"
          >
            <Download size={16} />
            Export to CSV
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white dark:bg-zinc-900 p-3 md:p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 md:gap-4">
        
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Date Range</label>
          <DateRangePicker 
            startDate={startDate} 
            endDate={endDate} 
            onChange={(s, e) => { setStartDate(s); setEndDate(e); }} 
          />
        </div>

        {/* Filter by Client */}
        <div className="relative" ref={clientDropdownRef}>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Filter by Client</label>
          <div 
            onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
            className="w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 cursor-pointer flex justify-between items-center"
          >
            <span className="truncate">
              {selectedClients.length === clientOptions.length ? 'All Clients' : `${selectedClients.length} Selected`}
            </span>
            <ChevronDown size={14} className="text-zinc-500 shrink-0" />
          </div>
          
          {isClientDropdownOpen && (
            <div className="absolute z-10 mt-1 w-[250px] max-h-60 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg p-2 right-0 md:left-0">
              {clientOptions.map(c => (
                <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedClients.includes(c.id)}
                    onChange={() => toggleClient(c.id)}
                    className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-900"
                  />
                  <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{c.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Filter by Project */}
        <div className="relative" ref={projectDropdownRef}>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Filter by Project</label>
          <div 
            onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
            className="w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 cursor-pointer flex justify-between items-center"
          >
            <span className="truncate">
              {selectedProjects.length === 0 ? 'All Projects' : `${selectedProjects.length} Selected`}
            </span>
            <ChevronDown size={14} className="text-zinc-500 shrink-0" />
          </div>
          
          {isProjectDropdownOpen && (
            <div className="absolute z-10 mt-1 w-[350px] max-h-60 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg p-2 right-0 md:left-0">
              {visibleProjects.map(p => (
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
              {visibleProjects.length === 0 && (
                <div className="p-2 text-sm text-zinc-500 text-center">No projects in selected clients</div>
              )}
            </div>
          )}
        </div>

        {/* Filter by Group */}
        <div className="relative" ref={groupDropdownRef}>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Filter by Group</label>
          <div 
            onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
            className="w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 cursor-pointer flex justify-between items-center"
          >
            <span className="truncate">
              {selectedGroups.length === 0 ? 'All Groups' : `${selectedGroups.length} Selected`}
            </span>
            <ChevronDown size={14} className="text-zinc-500 shrink-0" />
          </div>

          {isGroupDropdownOpen && (
            <div className="absolute z-10 mt-1 w-[250px] max-h-60 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg p-2 right-0 md:left-0">
              {groups.map(g => (
                <label key={g.id} className="flex items-center gap-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedGroups.includes(g.id)}
                    onChange={() => toggleGroup(g.id)}
                    className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-900"
                  />
                  <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{g.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Filter by User */}
        <div className="relative" ref={userDropdownRef}>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Filter by User</label>
          <div 
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            className="w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 cursor-pointer flex justify-between items-center"
          >
            <span className="truncate">
              {selectedUsers.length === 0 ? 'All Team Members' : `${selectedUsers.length} Selected`}
            </span>
            <ChevronDown size={14} className="text-zinc-500 shrink-0" />
          </div>

          {isUserDropdownOpen && (
            <div className="absolute z-10 mt-1 w-[250px] max-h-60 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg p-2 right-0">
              {visibleUsers.map(u => (
                <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedUsers.includes(u.id)}
                    onChange={() => toggleUser(u.id)}
                    className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-900"
                  />
                  <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{u.full_name}</span>
                </label>
              ))}
              {visibleUsers.length === 0 && (
                <div className="p-2 text-sm text-zinc-500 text-center">No users in selected groups</div>
              )}
            </div>
          )}
        </div>

        {/* Filter by Description */}
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Filter by Description</label>
          <input
            type="text"
            value={filterDescription}
            onChange={e => setFilterDescription(e.target.value)}
            placeholder="Contains text..."
            className="w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
          />
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
          {/* SUMMARIES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-zinc-50 dark:bg-zinc-950 px-4 md:px-6 py-2 md:py-3 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="font-semibold text-xs md:text-sm text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Project Summary</h3>
              </div>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-48 md:max-h-64 overflow-y-auto">
                {processedData.projectSummaries.map((proj, idx) => (
                  <li key={idx} className="px-4 md:px-6 py-2.5 md:py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 md:gap-3 truncate pr-4">
                      <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />
                      <span className="font-medium text-xs md:text-sm text-zinc-900 dark:text-zinc-100 truncate">{proj.name}</span>
                    </div>
                    <span className="font-mono text-xs md:text-sm text-zinc-900 dark:text-zinc-100 shrink-0">{formatMins(proj.mins)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-zinc-50 dark:bg-zinc-950 px-4 md:px-6 py-2 md:py-3 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="font-semibold text-xs md:text-sm text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">User Summary</h3>
              </div>
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-48 md:max-h-64 overflow-y-auto">
                {processedData.userSummaries.map((user, idx) => (
                  <li key={idx} className="px-4 md:px-6 py-2.5 md:py-3 flex items-center justify-between">
                    <span className="font-medium text-xs md:text-sm text-zinc-900 dark:text-zinc-100 truncate pr-4">{user.name}</span>
                    <span className="font-mono text-xs md:text-sm text-zinc-900 dark:text-zinc-100 shrink-0">{formatMins(user.mins)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* DETAILED LIST */}
          <div className="space-y-4 md:space-y-6">
            {processedData.weeklyData.map((week, wIdx) => (
              <div key={wIdx} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="bg-zinc-50 dark:bg-zinc-950 px-4 md:px-6 py-2 md:py-3 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                  <h3 className="font-semibold text-xs md:text-sm text-zinc-900 dark:text-zinc-100">{week.label}</h3>
                  <span className="font-mono text-xs md:text-sm font-bold text-zinc-900 dark:text-zinc-100">{formatMins(week.mins)}</span>
                </div>
                
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {week.entries.map(entry => {
                    let itemMins = differenceInMinutes(parseISO(entry.end_time!), parseISO(entry.start_time));
                    if (itemMins < 0) itemMins += 1440;
                    
                    const duration = formatMins(itemMins);
                    const canEdit = entry.user_id === user?.id;
                    const canDelete = canEdit || isAdmin;

                    return (
                      <div key={entry.id} className="flex flex-col md:grid md:grid-cols-12 gap-1 md:gap-4 px-4 md:px-6 py-3 md:py-4 md:items-center hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                        
                        <div className="flex justify-between items-start md:col-span-2 md:block">
                          <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{entry.profiles?.full_name}</span>
                          <div className="flex items-center gap-2 md:hidden">
                            <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100 shrink-0">{duration}</span>
                            {(canEdit || canDelete) && (
                              <button onClick={() => openEditModal(entry)} className="text-zinc-400 hover:text-blue-500 p-1">
                                <Edit2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* Shrunk to col-span-3 to make room for actions */}
                        <div className="md:col-span-3 text-sm text-zinc-700 dark:text-zinc-300 truncate mb-2 md:mb-0">
                          {entry.description || '-'}
                        </div>
                        
                        <div className="flex justify-between items-center md:hidden gap-2">
                          <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.projects?.color_hex || '#ccc' }} />
                            <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 truncate uppercase tracking-wider">{entry.projects?.name}</span>
                          </div>
                          <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 shrink-0 text-right">
                            {format(parseISO(entry.start_time), 'MMM d, h:mm a')} <span className="mx-0.5">-</span> {format(parseISO(entry.end_time!), 'h:mm a')}
                          </div>
                        </div>

                        <div className="hidden md:flex md:col-span-2 items-center gap-2 overflow-hidden">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.projects?.color_hex || '#ccc' }} />
                          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate uppercase tracking-wider">{entry.projects?.name}</span>
                        </div>
                        
                        <div className="hidden md:block md:col-span-3 text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                          {format(parseISO(entry.start_time), 'MMM d, h:mm a')} <span className="mx-1 text-zinc-300 dark:text-zinc-700">-</span> {format(parseISO(entry.end_time!), 'h:mm a')}
                        </div>
                        
                        <div className="hidden md:block md:col-span-1 text-right font-mono text-sm text-zinc-900 dark:text-zinc-100">
                          {duration}
                        </div>
                        
                        <div className="hidden md:flex md:col-span-1 justify-end items-center">
                          {(canEdit || canDelete) && (
                            <button onClick={() => openEditModal(entry)} className="text-zinc-400 hover:text-blue-500 transition-colors p-1">
                              <Edit2 size={14} />
                            </button>
                          )}
                        </div>

                      </div>
                    )
                  })}
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
                        <option value="">Skip (Do not import)</option>
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
                      <div className="w-1/2 flex gap-2">
                        <select 
                          value={projectMapping[p] || ''} 
                          onChange={e => setProjectMapping({...projectMapping, [p]: e.target.value})}
                          className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                        >
                          <option value="">Skip (Do not import)</option>
                          {projects.map(dbP => <option key={dbP.id} value={dbP.id}>{dbP.name} {dbP.client_id ? `(${dbP.clients?.name})` : '(Personal)'}</option>)}
                        </select>
                        <button 
                          type="button"
                          onClick={() => {
                            setCreateProjectCsvKey(p)
                            setCreateProjectName(p)
                            setIsCreateProjectModalOpen(true)
                          }}
                          className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-medium shrink-0"
                        >
                          + New
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <button onClick={closeImportModal} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Cancel</button>
                  <button onClick={handleConfirmImport} className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-800 dark:hover:bg-white">
                    Confirm Import ({rowsToImportCount} Rows)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INLINE CREATE PROJECT MODAL */}
      {isCreateProjectModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-xl w-full max-w-md border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">Quick Create Project</h3>
            <form onSubmit={handleCreateInlineProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Project Name</label>
                <input 
                  type="text" 
                  required 
                  value={createProjectName} 
                  onChange={(e) => setCreateProjectName(e.target.value)} 
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Client</label>
                <select 
                  required 
                  value={createProjectClientId} 
                  onChange={(e) => setCreateProjectClientId(e.target.value)} 
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Select Client...</option>
                  <option value="personal">-- Personal Project --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Color:</label>
                <input 
                  type="color" 
                  value={createProjectColor} 
                  onChange={(e) => setCreateProjectColor(e.target.value)} 
                  className="h-9 w-9 rounded cursor-pointer border-0 p-0 bg-transparent" 
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsCreateProjectModalOpen(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-800 dark:hover:bg-white">Create & Select</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-xl w-full max-w-md border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">Edit Time Log</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Project</label>
                <select disabled={editingEntry.user_id !== user?.id} value={editProjectId} onChange={(e) => setEditProjectId(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 disabled:opacity-50">
                  <option value="">No Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
              <div className="flex justify-between items-end mb-1">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</label>
                  {editDescription.length >= 120 && <span className="text-[10px] text-red-500">{editDescription.length}/80</span>}
                </div>
                <DescriptionAutocomplete
                  disabled={editingEntry.user_id !== user?.id}
                  value={editDescription}
                  onChange={(val, projId) => {
                  setEditDescription(val);
                  if (projId) setEditProjectId(projId);
                  }}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Date</label>
                <input disabled={editingEntry.user_id !== user?.id} type="date" required value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 disabled:opacity-50" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Start Time</label>
                  <input disabled={editingEntry.user_id !== user?.id} type="time" required value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 disabled:opacity-50" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">End Time</label>
                  <input disabled={editingEntry.user_id !== user?.id} type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 disabled:opacity-50" />
                </div>
              </div>
              
              {!isAdmin && editingEntry.user_id !== user?.id && (
                <div className="text-xs text-red-500 mt-2">You can only edit logs that belong to you.</div>
              )}

              <div className="flex justify-between mt-6">
                {(editingEntry.user_id === user?.id || isAdmin) ? (
                  <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md">Delete</button>
                ) : <div />}
                
                <div className="space-x-3">
                  <button type="button" onClick={() => setEditingEntry(null)} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Cancel</button>
                  {editingEntry.user_id === user?.id && (
                    <button type="submit" className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-800 dark:hover:bg-white">Save</button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Edit Entries Modal */}
      {isBulkEditModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Edit2 size={20} />
                Bulk Edit Entries
              </h2>
              <button onClick={() => setIsBulkEditModalOpen(false)} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"><X size={20} /></button>
            </div>
            
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
              You are about to edit <span className="font-bold text-zinc-900 dark:text-zinc-100">{processedData.filteredEntries.length}</span> entries matching your current filters. Leave a field blank to keep its current value.
              {!isAdmin && <span className="block mt-1 text-red-500">Note: You can only bulk edit entries you created.</span>}
            </p>

            <form onSubmit={handleBulkEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">New Project</label>
                <select value={bulkEditProjectId} onChange={(e) => setBulkEditProjectId(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                  <option value="">-- No Change --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              
              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">New User</label>
                  <select value={bulkEditUserId} onChange={(e) => setBulkEditUserId(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                    <option value="">-- No Change --</option>
                    {team.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">New Description</label>
                  {bulkEditDescription.length >= 120 && <span className="text-[10px] text-red-500">{bulkEditDescription.length}/80</span>}
                </div>
                <DescriptionAutocomplete
                  value={bulkEditDescription}
                  onChange={(val, projId) => {
                  setBulkEditDescription(val);
                  if (projId) setBulkEditProjectId(projId);
                  }}
                  disabled={bulkClearDescription}
                  placeholder="-- No Change --"
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 disabled:opacity-50"
                />
                <label className="flex items-center gap-2 mt-2">
                  <input type="checkbox" checked={bulkClearDescription} onChange={e => setBulkClearDescription(e.target.checked)} className="rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950" />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">Clear description on all entries</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button type="button" onClick={() => setIsBulkEditModalOpen(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Cancel</button>
                <button type="submit" disabled={isBulkEditing || (!bulkEditProjectId && !bulkEditUserId && !bulkEditDescription && !bulkClearDescription)} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {isBulkEditing ? 'Applying...' : 'Apply Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cleanup Modal */}
      {isCleanupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-lg w-full max-w-md border border-zinc-200 dark:border-zinc-800 flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h2 className="text-xl font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                <Trash2 size={20} />
                Data Cleanup
              </h2>
              <button onClick={() => setIsCleanupModalOpen(false)} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"><X size={20} /></button>
            </div>
            
            <div className="space-y-6">
              {/* Duplicates */}
              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 mb-1">Remove Duplicates</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">Scans the entire database for entries with the exact same user, project, start time, and end time, and deletes the extras.</p>
                <button 
                  onClick={handleCleanupDuplicates}
                  disabled={isCleaning}
                  className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-md text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  {isCleaning ? 'Processing...' : 'Find & Delete Duplicates'}
                </button>
              </div>

              {/* By Date */}
              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 mb-1">Purge Old Logs</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">Permanently delete all time entries logged before a specific date.</p>
                <div className="flex gap-2">
                  <input 
                    type="date" 
                    value={cleanupDate} 
                    onChange={e => setCleanupDate(e.target.value)} 
                    className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                  <button 
                    onClick={handleCleanupByDate}
                    disabled={!cleanupDate || isCleaning}
                    className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 shrink-0"
                  >
                    Delete Logs
                  </button>
                </div>
              </div>

              {/* By User */}
              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 mb-1">Purge By User</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">Permanently delete all time entries belonging to a specific user.</p>
                <div className="flex gap-2">
                  <select 
                    value={cleanupUserId} 
                    onChange={e => setCleanupUserId(e.target.value)} 
                    className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">Select User...</option>
                    {team.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </select>
                  <button 
                    onClick={handleCleanupByUser}
                    disabled={!cleanupUserId || isCleaning}
                    className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 shrink-0"
                  >
                    Delete Logs
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}