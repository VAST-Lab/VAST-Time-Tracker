'use client'
import { useEffect, useState } from 'react'
import { getProjects, createProject, updateProject, deleteProject, getClients } from '@/utils/supabase/api'
import { Project, Client } from '@/types/supabase'
import { useAdmin } from '@/hooks/useAdmin'
import { useAuth } from '@/context/AuthContext'

export default function ProjectsPage() {
  const { user } = useAuth()
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
    if (!formData.name || !user) return
    // If not admin, force it to be a personal project
    const isPersonal = !isAdmin || formData.client_id === 'personal'
    
    await createProject({
      name: formData.name,
      client_id: isPersonal ? null : formData.client_id,
      user_id: isPersonal ? user.id : null,
      color_hex: formData.color_hex
    })
    setFormData({ name: '', client_id: '', color_hex: '#FF5733' })
    loadData()
  }

  const openEditModal = (project: Project) => {
    // Prevent non-admins from editing shared projects
    if (!isAdmin && project.client_id) return

    setEditName(project.name)
    setEditClientId(project.user_id ? 'personal' : (project.client_id || ''))
    setEditColor(project.color_hex)
    setEditIsActive(project.is_active)
    setEditingProject(project)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProject || !user) return
    const isPersonal = !isAdmin || editClientId === 'personal'

    await updateProject(editingProject.id, { 
      name: editName, 
      client_id: isPersonal ? null : editClientId, 
      user_id: isPersonal ? user.id : null,
      color_hex: editColor, 
      is_active: editIsActive 
    })
    setEditingProject(null)
    loadData()
  }

  const handleDelete = async () => {
    if (!editingProject) return
    await deleteProject(editingProject.id)
    setEditingProject(null)
    loadData()
  }

  if (isAdmin === null) return <div className="dark:text-zinc-100">Loading...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Projects</h1>
      
      <form onSubmit={handleCreate} className="flex flex-wrap gap-4 items-center bg-white dark:bg-zinc-900 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg">
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="New Project Name"
          className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 min-w-[200px]"
          required
        />
        {isAdmin && (
          <select 
            value={formData.client_id}
            onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100"
            required
          >
            <option value="">Select Client...</option>
            <option value="personal">-- Personal Project --</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-600 dark:text-zinc-400">Color:</label>
          <input
            type="color"
            value={formData.color_hex}
            onChange={(e) => setFormData({ ...formData, color_hex: e.target.value })}
            className="h-9 w-9 rounded cursor-pointer border-0 p-0 bg-transparent"
          />
        </div>
        <button type="submit" className="rounded-md bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white font-medium">
          Add Project
        </button>
      </form>

      <div className="hidden md:block overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-medium">
            <tr>
              <th className="px-6 py-4 text-zinc-900 dark:text-zinc-100">Project</th>
              <th className="px-6 py-4 text-zinc-900 dark:text-zinc-100">Client / Type</th>
              <th className="px-6 py-4 text-zinc-900 dark:text-zinc-100">Color Tag</th>
              <th className="px-6 py-4 text-right text-zinc-900 dark:text-zinc-100">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {projects.map((project) => {
              const canEdit = isAdmin || project.user_id === user?.id;
              return (
                <tr key={project.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">{project.name}</td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                    {project.user_id ? <span className="text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider">Personal</span> : project.clients?.name}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-700" style={{ backgroundColor: project.color_hex }} />
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase">{project.color_hex}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {canEdit ? (
                      <button onClick={() => openEditModal(project)} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">Edit</button>
                    ) : (
                      <span className="text-sm text-zinc-400 dark:text-zinc-600">Read Only</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-lg w-full max-w-md border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">Edit Project</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Name</label>
                <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100" />
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Client</label>
                  <select required value={editClientId} onChange={(e) => setEditClientId(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100">
                    <option value="personal">-- Personal Project --</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Color:</label>
                <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-9 w-9 rounded cursor-pointer border-0 p-0 bg-transparent" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="projectActive" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} className="rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950" />
                <label htmlFor="projectActive" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Active</label>
              </div>
              <div className="flex justify-between mt-6">
                <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md">Delete</button>
                <div className="space-x-3">
                  <button type="button" onClick={() => setEditingProject(null)} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Cancel</button>
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