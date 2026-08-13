'use client'
import { useState, useEffect, useMemo } from 'react'
import { format, subDays, differenceInMinutes } from 'date-fns'
import Papa from 'papaparse'
import { Download } from 'lucide-react'
import { getProjects, getTeamMembers } from '@/utils/supabase/api'
import { getReportEntries } from '@/utils/supabase/reportApi'
import { Project, Profile, TimeEntry } from '@/types/supabase'

export default function ReportsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [team, setTeam] = useState<Profile[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Filter States
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedUser, setSelectedUser] = useState('')

  useEffect(() => {
    getProjects().then(setProjects)
    getTeamMembers().then(setTeam)
  }, [])

  useEffect(() => {
    loadReportData()
  }, [startDate, endDate, selectedProject, selectedUser])

  const loadReportData = async () => {
    setIsLoading(true)
    try {
      const data = await getReportEntries(startDate, endDate, selectedProject, selectedUser)
      setEntries(data)
    } catch (error) {
      console.error("Failed to fetch report:", error)
    }
    setIsLoading(false)
  }

  // Aggregate Data: Group by Project -> Group by User -> Sum Hours
  const aggregatedData = useMemo(() => {
    const summary: Record<string, { projectName: string; users: Record<string, { userName: string; totalMinutes: number }> }> = {}

    entries.forEach(entry => {
      const pId = entry.project_id
      const pName = entry.projects?.name || 'Unknown Project'
      const uId = entry.user_id
      const uName = entry.profiles?.full_name || 'Unknown User'
      
      const mins = entry.end_time ? differenceInMinutes(new Date(entry.end_time), new Date(entry.start_time)) : 0

      if (!summary[pId]) {
        summary[pId] = { projectName: pName, users: {} }
      }
      if (!summary[pId].users[uId]) {
        summary[pId].users[uId] = { userName: uName, totalMinutes: 0 }
      }
      
      summary[pId].users[uId].totalMinutes += mins
    })

    return summary
  }, [entries])

  const handleExportCSV = () => {
    // Flatten aggregated data for CSV export
    const exportData: any[] = []
    
    Object.values(aggregatedData).forEach(project => {
      Object.values(project.users).forEach(user => {
        exportData.push({
          'Project': project.projectName,
          'User': user.userName,
          'Total Hours': (user.totalMinutes / 60).toFixed(2)
        })
      })
    })

    if (exportData.length === 0) return

    const csv = Papa.unparse(exportData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.setAttribute('download', `time-report-${startDate}-to-${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatHours = (minutes: number) => {
    return (minutes / 60).toFixed(2) + ' hrs'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-2xl font-bold text-zinc-900">Reports</h1>
        <button 
          onClick={handleExportCSV}
          disabled={entries.length === 0}
          className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-md hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          <Download size={16} />
          Export to CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">End Date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Filter by Project</label>
          <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Filter by User</label>
          <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
            <option value="">All Team Members</option>
            {team.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>
      </div>

      {/* Aggregated Data View */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-zinc-500">Loading report...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">No completed time entries found for these filters.</div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {Object.values(aggregatedData).map((project, idx) => (
              <div key={idx} className="p-0">
                <div className="bg-zinc-50 px-6 py-3 border-b border-zinc-200">
                  <h3 className="font-semibold text-zinc-900">{project.projectName}</h3>
                </div>
                <ul className="divide-y divide-zinc-100">
                  {Object.values(project.users).map((user, uIdx) => (
                    <li key={uIdx} className="px-6 py-3 flex justify-between items-center hover:bg-zinc-50/50">
                      <span className="text-sm font-medium text-zinc-700">{user.userName}</span>
                      <span className="text-sm font-mono text-zinc-900 bg-zinc-100 px-2 py-1 rounded">
                        {formatHours(user.totalMinutes)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}