'use client'
import { useEffect, useState } from 'react'
import { getProjects, createProject, getClients } from '@/utils/supabase/api'
import { Project, Client } from '@/types/supabase'
import { useAdmin } from '@/hooks/useAdmin'

export default function ProjectsPage() {
  const isAdmin = useAdmin()
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [formData, setFormData] = useState({ name: '', client_id: '', color_hex: '#FF5733' })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [projData, clientData] = await Promise.all([getProjects(), getClients()])
    setProjects(projData)
    setClients(clientData.filter(c => c.is_active))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.client_id) return
    await createProject(formData)
    setFormData({ name: '', client_id: '', color_hex: '#FF5733' })
    loadData()
  }

  if (isAdmin === null) return <div>Loading...</div>
  if (!isAdmin) return <div>Access Denied. Administrators only.</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Projects</h1>
      
      <form onSubmit={handleCreate} className="flex flex-wrap gap-4 items-center bg-white p-4 border border-zinc-200 rounded-lg">
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Project Name"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 min-w-[200px]"
          required
        />
        <select 
          value={formData.client_id}
          onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
          className="rounded-md border border-zinc-300 px-3 py-2"
          required
        >
          <option value="">Select Client...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-600">Color:</label>
          <input
            type="color"
            value={formData.color_hex}
            onChange={(e) => setFormData({ ...formData, color_hex: e.target.value })}
            className="h-9 w-9 rounded cursor-pointer border-0 p-0"
          />
        </div>
        <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800">
          Add Project
        </button>
      </form>

      <div className="grid gap-4 md:hidden">
        {projects.map(project => (
          <div key={project.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="font-medium text-zinc-900">{project.name}</div>
              <div className="text-sm text-zinc-500">{project.clients?.name}</div>
            </div>
            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: project.color_hex }} />
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 font-medium">
            <tr>
              <th className="px-6 py-4">Project</th>
              <th className="px-6 py-4">Client</th>
              <th className="px-6 py-4">Color Tag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-zinc-50">
                <td className="px-6 py-4 font-medium text-zinc-900">{project.name}</td>
                <td className="px-6 py-4 text-zinc-600">{project.clients?.name}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border border-zinc-300" style={{ backgroundColor: project.color_hex }} />
                    <span className="text-xs text-zinc-500 uppercase">{project.color_hex}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}