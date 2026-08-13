'use client'
import { useEffect, useState } from 'react'
import { getProjects, createProject, updateProject, deleteProject, getClients } from '@/utils/supabase/api'
import { Project, Client } from '@/types/supabase'
import { useAdmin } from '@/hooks/useAdmin'

export default function ProjectsPage() {
  const isAdmin = useAdmin()
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [formData, setFormData] = useState({ name: '', client_id: '', color_hex: '#FF5733' })
  
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editName, setEditName] = useState('')
  const [editClientId, setEditClientId] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)

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

  const openEditModal = (project: Project) => {
    setEditName(project.name)
    setEditClientId(project.client_id)
    setEditColor(project.color_hex)
    setEditIsActive(project.is_active)
    setEditingProject(project)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProject) return
    await updateProject(editingProject.id, { name: editName, client_id: editClientId, color_hex: editColor, is_active: editIsActive })
    setEditingProject(null)
    loadData()
  }

  const handleDelete = async () => {
    if (!editingProject) return
    await deleteProject(editingProject.id)
    setEditingProject(null)
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
          <div key={project.id} onClick={() => openEditModal(project)} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm flex items-center justify-between cursor-pointer">
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
              <th className="px-6 py-4 text-right">Actions</th>
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
                <td className="px-6 py-4 text-right">
                  <button onClick={() => openEditModal(project)} className="text-sm text-blue-600 hover:text-blue-800">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Edit Project</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Name</label>
                <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Client</label>
                <select required value={editClientId} onChange={(e) => setEditClientId(e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2">
                  <option value="">Select Client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-zinc-700">Color:</label>
                <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-9 w-9 rounded cursor-pointer border-0 p-0" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="projectActive" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} className="rounded border-zinc-300" />
                <label htmlFor="projectActive" className="text-sm font-medium text-zinc-700">Active</label>
              </div>
              <div className="flex justify-between mt-6">
                <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md">Delete</button>
                <div className="space-x-3">
                  <button type="button" onClick={() => setEditingProject(null)} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">Cancel</button>
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