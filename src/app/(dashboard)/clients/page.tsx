'use client'
import { useEffect, useState } from 'react'
import { getClients, createClient, updateClient, deleteClient } from '@/utils/supabase/api'
import { Client } from '@/types/supabase'
import { useAdmin } from '@/hooks/useAdmin'

export default function ClientsPage() {
  const isAdmin = useAdmin()
  const [clients, setClients] = useState<Client[]>([])
  const [newClientName, setNewClientName] = useState('')
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [editName, setEditName] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)

  useEffect(() => {
    loadClients()
  }, [])

  const loadClients = async () => {
    const data = await getClients()
    setClients(data)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClientName) return
    await createClient(newClientName)
    setNewClientName('')
    loadClients()
  }

  const openEditModal = (client: Client) => {
    setEditName(client.name)
    setEditIsActive(client.is_active)
    setEditingClient(client)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClient) return
    await updateClient(editingClient.id, { name: editName, is_active: editIsActive })
    setEditingClient(null)
    loadClients()
  }

  const handleDelete = async () => {
    if (!editingClient) return
    await deleteClient(editingClient.id)
    setEditingClient(null)
    loadClients()
  }

  if (isAdmin === null) return <div>Loading...</div>
  if (!isAdmin) return <div>Access Denied. Administrators only.</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Clients</h1>
      
      <form onSubmit={handleCreate} className="flex gap-4">
        <input
          type="text"
          value={newClientName}
          onChange={(e) => setNewClientName(e.target.value)}
          placeholder="New Client Name"
          className="rounded-md border border-zinc-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
        <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800">
          Add Client
        </button>
      </form>

      <div className="grid gap-4 md:hidden">
        {clients.map(client => (
          <div key={client.id} onClick={() => openEditModal(client)} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm cursor-pointer">
            <div className="font-medium text-zinc-900">{client.name}</div>
            <div className="text-sm text-zinc-500">Status: {client.is_active ? 'Active' : 'Inactive'}</div>
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 font-medium">
            <tr>
              <th className="px-6 py-4">Client Name</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-zinc-50">
                <td className="px-6 py-4 font-medium text-zinc-900">{client.name}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${client.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-700'}`}>
                    {client.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => openEditModal(client)} className="text-sm text-blue-600 hover:text-blue-800">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Edit Client</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Name</label>
                <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="clientActive" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} className="rounded border-zinc-300" />
                <label htmlFor="clientActive" className="text-sm font-medium text-zinc-700">Active</label>
              </div>
              <div className="flex justify-between mt-6">
                <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md">Delete</button>
                <div className="space-x-3">
                  <button type="button" onClick={() => setEditingClient(null)} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">Cancel</button>
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