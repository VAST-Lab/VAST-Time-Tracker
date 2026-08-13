'use client'
import { useEffect, useState } from 'react'
import { getClients, createClient } from '@/utils/supabase/api'
import { Client } from '@/types/supabase'
import { useAdmin } from '@/hooks/useAdmin'

export default function ClientsPage() {
  const isAdmin = useAdmin()
  const [clients, setClients] = useState<Client[]>([])
  const [newClientName, setNewClientName] = useState('')

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

      {/* Mobile: Stacked Cards / Desktop: Table */}
      <div className="grid gap-4 md:hidden">
        {clients.map(client => (
          <div key={client.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}