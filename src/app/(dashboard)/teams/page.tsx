'use client'
import { useEffect, useState } from 'react'
import { 
  getTeamMembers, updateTeamMemberRole, updateTeamMemberName, updateTeamMemberGroup, deleteTeamMember,
  getGroups, createGroup, deleteGroup, getGroupClients, updateGroupClients, getClients
} from '@/utils/supabase/api'
import { Profile, UserRole, Group, Client } from '@/types/supabase'
import { useAdmin } from '@/hooks/useAdmin'

export default function TeamsPage() {
  const isAdmin = useAdmin()
  const [team, setTeam] = useState<Profile[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [clients, setClients] = useState<Client[]>([])
  
  const [editingMember, setEditingMember] = useState<Profile | null>(null)
  const [editName, setEditName] = useState('')

  const [newGroupName, setNewGroupName] = useState('')
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [selectedGroupClients, setSelectedGroupClients] = useState<string[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [teamData, groupData, clientData] = await Promise.all([getTeamMembers(), getGroups(), getClients()])
    setTeam(teamData)
    setGroups(groupData)
    setClients(clientData)
  }

  const handleRoleChange = async (id: string, newRole: UserRole) => {
    await updateTeamMemberRole(id, newRole)
    loadData()
  }

  const handleGroupChange = async (id: string, groupId: string) => {
    await updateTeamMemberGroup(id, groupId === 'none' ? null : groupId)
    loadData()
  }

  const openMemberModal = (member: Profile) => {
    setEditName(member.full_name)
    setEditingMember(member)
  }

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMember) return
    await updateTeamMemberName(editingMember.id, editName)
    setEditingMember(null)
    loadData()
  }

  const handleMemberDelete = async () => {
    if (!editingMember) return
    await deleteTeamMember(editingMember.id)
    setEditingMember(null)
    loadData()
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGroupName) return
    await createGroup(newGroupName)
    setNewGroupName('')
    loadData()
  }

  const openGroupModal = async (group: Group) => {
    const activeClients = await getGroupClients(group.id)
    setSelectedGroupClients(activeClients)
    setEditingGroup(group)
  }

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingGroup) return
    await updateGroupClients(editingGroup.id, selectedGroupClients)
    setEditingGroup(null)
    loadData()
  }

  const handleGroupDelete = async () => {
    if (!editingGroup) return
    await deleteGroup(editingGroup.id)
    setEditingGroup(null)
    loadData()
  }

  const toggleClientSelection = (clientId: string) => {
    setSelectedGroupClients(prev => 
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    )
  }

  if (isAdmin === null) return <div className="dark:text-zinc-100">Loading...</div>
  if (!isAdmin) return <div className="dark:text-zinc-100">Access Denied. Administrators only.</div>

  return (
    <div className="space-y-12">
      
      {/* TEAM MEMBERS SECTION */}
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Team Members</h1>
        <div className="hidden md:block overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-medium">
              <tr>
                <th className="px-6 py-4 text-zinc-900 dark:text-zinc-100">Name</th>
                <th className="px-6 py-4 text-zinc-900 dark:text-zinc-100">Role</th>
                <th className="px-6 py-4 text-zinc-900 dark:text-zinc-100">Access Group</th>
                <th className="px-6 py-4 text-right text-zinc-900 dark:text-zinc-100">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {team.map((member) => (
                <tr key={member.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">{member.full_name}</td>
                  <td className="px-6 py-4">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}
                      className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={member.group_id || 'none'}
                      onChange={(e) => handleGroupChange(member.id, e.target.value)}
                      className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="none">None</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openMemberModal(member)} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ACCESS GROUPS SECTION */}
      <div className="space-y-6 border-t border-zinc-200 dark:border-zinc-800 pt-8">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Access Groups</h2>
        
        <form onSubmit={handleCreateGroup} className="flex gap-4">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="New Group Name"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
          />
          <button type="submit" className="rounded-md bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white font-medium">
            Add Group
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {groups.map(group => (
            <div key={group.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm flex items-center justify-between">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{group.name}</span>
              <button onClick={() => openGroupModal(group)} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">Edit Access</button>
            </div>
          ))}
        </div>
      </div>

      {/* MEMBER EDIT MODAL */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-lg w-full max-w-md border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">Edit Team Member</h2>
            <form onSubmit={handleMemberSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Full Name</label>
                <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100" />
              </div>
              <div className="flex justify-between mt-6">
                <button type="button" onClick={handleMemberDelete} className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md">Delete Profile</button>
                <div className="space-x-3">
                  <button type="button" onClick={() => setEditingMember(null)} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-800 dark:hover:bg-white">Save</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GROUP EDIT MODAL */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-lg w-full max-w-md border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">Edit Access: {editingGroup.name}</h2>
            <form onSubmit={handleGroupSubmit} className="space-y-4">
              <div className="max-h-60 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-md p-3 space-y-2">
                {clients.map(client => (
                  <div key={client.id} className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id={`client-${client.id}`}
                      checked={selectedGroupClients.includes(client.id)}
                      onChange={() => toggleClientSelection(client.id)}
                      className="rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                    />
                    <label htmlFor={`client-${client.id}`} className="text-sm text-zinc-900 dark:text-zinc-100 cursor-pointer flex-1">
                      {client.name}
                    </label>
                  </div>
                ))}
                {clients.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">No clients available.</p>}
              </div>
              <div className="flex justify-between mt-6">
                <button type="button" onClick={handleGroupDelete} className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md">Delete Group</button>
                <div className="space-x-3">
                  <button type="button" onClick={() => setEditingGroup(null)} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Cancel</button>
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