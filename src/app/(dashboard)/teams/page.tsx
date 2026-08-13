'use client'
import { useEffect, useState } from 'react'
import { getTeamMembers, updateTeamMemberRole, updateTeamMemberName, deleteTeamMember } from '@/utils/supabase/api'
import { Profile, UserRole } from '@/types/supabase'
import { useAdmin } from '@/hooks/useAdmin'

export default function TeamsPage() {
  const isAdmin = useAdmin()
  const [team, setTeam] = useState<Profile[]>([])
  
  const [editingMember, setEditingMember] = useState<Profile | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    loadTeam()
  }, [])

  const loadTeam = async () => {
    const data = await getTeamMembers()
    setTeam(data)
  }

  const handleRoleChange = async (id: string, newRole: UserRole) => {
    await updateTeamMemberRole(id, newRole)
    loadTeam()
  }

  const openEditModal = (member: Profile) => {
    setEditName(member.full_name)
    setEditingMember(member)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMember) return
    await updateTeamMemberName(editingMember.id, editName)
    setEditingMember(null)
    loadTeam()
  }

  const handleDelete = async () => {
    if (!editingMember) return
    await deleteTeamMember(editingMember.id)
    setEditingMember(null)
    loadTeam()
  }

  if (isAdmin === null) return <div>Loading...</div>
  if (!isAdmin) return <div>Access Denied. Administrators only.</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Team Members</h1>

      <div className="grid gap-4 md:hidden">
        {team.map(member => (
          <div key={member.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="font-medium text-zinc-900 cursor-pointer" onClick={() => openEditModal(member)}>{member.full_name}</div>
            <select
              value={member.role}
              onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}
              className="mt-2 text-sm rounded-md border border-zinc-300 px-2 py-1"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 font-medium">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {team.map((member) => (
              <tr key={member.id} className="hover:bg-zinc-50">
                <td className="px-6 py-4 font-medium text-zinc-900">{member.full_name}</td>
                <td className="px-6 py-4">
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-sm bg-transparent"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => openEditModal(member)} className="text-sm text-blue-600 hover:text-blue-800">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Edit Team Member</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Full Name</label>
                <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2" />
              </div>
              <div className="flex justify-between mt-6">
                <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md">Delete Profile</button>
                <div className="space-x-3">
                  <button type="button" onClick={() => setEditingMember(null)} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">Cancel</button>
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