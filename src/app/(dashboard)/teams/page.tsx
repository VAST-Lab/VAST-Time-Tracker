'use client'
import { useEffect, useState } from 'react'
import { 
  getTeamMembers, updateTeamMemberRole, updateTeamMemberName, updateTeamMemberGroup, deleteTeamMember,
  getGroups, createGroup, deleteGroup, getGroupClients, updateGroupClients, getClients,
  getPendingInvitations, createInvitation, deleteInvitation
} from '@/utils/supabase/api'
import { Profile, UserRole, Group, Client, Invitation } from '@/types/supabase'
import { useAdmin } from '@/hooks/useAdmin'
import { Copy, Check } from 'lucide-react'

type UnifiedMember = {
  id: string;
  isInvite: boolean;
  email: string;
  full_name: string;
  role: UserRole;
  group_id: string | null;
  status: string;
}

export default function TeamsPage() {
  const isAdmin = useAdmin()
  const [unifiedTeam, setUnifiedTeam] = useState<UnifiedMember[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [clients, setClients] = useState<Client[]>([])
  
  // Member Edit State
  const [editingMember, setEditingMember] = useState<UnifiedMember | null>(null)
  const [editName, setEditName] = useState('')
  const [isCopied, setIsCopied] = useState(false)

  // Invite State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('user')
  const [inviteGroupId, setInviteGroupId] = useState('')
  const [generatedLink, setGeneratedLink] = useState('')

  // Group State
  const [newGroupName, setNewGroupName] = useState('')
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [selectedGroupClients, setSelectedGroupClients] = useState<string[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [teamData, invData, groupData, clientData] = await Promise.all([
      getTeamMembers(), getPendingInvitations(), getGroups(), getClients()
    ])
    
    const mappedTeam: UnifiedMember[] = teamData.map(t => ({
      id: t.id, isInvite: false, email: t.email || 'N/A', full_name: t.full_name, 
      role: t.role, group_id: t.group_id, status: 'Active'
    }))
    
    const mappedInvites: UnifiedMember[] = invData.map(i => ({
      id: i.id, isInvite: true, email: i.email, full_name: 'Pending Invite', 
      role: i.role, group_id: i.group_id, status: 'Pending'
    }))

    setUnifiedTeam([...mappedTeam, ...mappedInvites])
    setGroups(groupData)
    setClients(clientData)
  }

  const handleRoleChange = async (member: UnifiedMember, newRole: UserRole) => {
    if (member.isInvite) return // Roles for invites are set on creation
    await updateTeamMemberRole(member.id, newRole)
    loadData()
  }

  const handleGroupChange = async (member: UnifiedMember, groupId: string) => {
    if (member.isInvite) return 
    await updateTeamMemberGroup(member.id, groupId === 'none' ? null : groupId)
    loadData()
  }

  const openMemberModal = (member: UnifiedMember) => {
    if (member.isInvite) {
      // Dynamically extract the basePath by removing '/teams' from the current path
      const basePath = window.location.pathname.replace(/\/teams$/, '')
      setGeneratedLink(`${window.location.origin}${basePath}/login?email=${encodeURIComponent(member.email)}`)
    }
    setEditName(member.full_name)
    setEditingMember(member)
    setIsCopied(false)
  }

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMember || editingMember.isInvite) return
    await updateTeamMemberName(editingMember.id, editName)
    setEditingMember(null)
    loadData()
  }

  const handleMemberDelete = async () => {
    if (!editingMember) return
    if (editingMember.isInvite) {
      await deleteInvitation(editingMember.id)
    } else {
      await deleteTeamMember(editingMember.id)
    }
    setEditingMember(null)
    setGeneratedLink('')
    loadData()
  }

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    await createInvitation(inviteEmail, inviteRole, inviteGroupId === 'none' ? null : inviteGroupId)
    setInviteEmail('')
    setInviteRole('user')
    setInviteGroupId('')
    setIsInviteModalOpen(false)
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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  if (isAdmin === null) return <div className="dark:text-zinc-100">Loading...</div>
  if (!isAdmin) return <div className="dark:text-zinc-100">Access Denied. Administrators only.</div>

  return (
    <div className="space-y-8 md:space-y-12">

      {/* TEAM MEMBERS SECTION */}
      <div className="space-y-4 md:space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-zinc-100">Team Members</h1>
          <button onClick={() => setIsInviteModalOpen(true)} className="rounded-md bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 md:px-4 md:py-2 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white font-medium text-xs md:text-sm">
            Invite User
          </button>
        </div>
        
        {/* Mobile View */}
        <div className="grid gap-4 md:hidden">
          {unifiedTeam.map((member) => (
            <div key={member.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{member.full_name}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{member.email}</div>
                </div>
                <span className={`shrink-0 inline-flex rounded-full px-2 py-1 text-[10px] font-medium ${member.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                  {member.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-zinc-500 mb-1">Role</label>
                  <select
                    value={member.role}
                    disabled={member.isInvite}
                    onChange={(e) => handleRoleChange(member, e.target.value as UserRole)}
                    className="w-full rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 disabled:opacity-50"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-zinc-500 mb-1">Group</label>
                  <select
                    value={member.group_id || 'none'}
                    disabled={member.isInvite}
                    onChange={(e) => handleGroupChange(member, e.target.value)}
                    className="w-full rounded border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 disabled:opacity-50"
                  >
                    <option value="none">None</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800 mt-1">
                <button onClick={() => openMemberModal(member)} className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {member.isInvite ? 'Link / Remove' : 'Edit Profile'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-medium">
              <tr>
                <th className="px-6 py-4 text-zinc-900 dark:text-zinc-100">Name</th>
                <th className="px-6 py-4 text-zinc-900 dark:text-zinc-100">Email</th>
                <th className="px-6 py-4 text-zinc-900 dark:text-zinc-100">Role</th>
                <th className="px-6 py-4 text-zinc-900 dark:text-zinc-100">Access Group</th>
                <th className="px-6 py-4 text-zinc-900 dark:text-zinc-100">Status</th>
                <th className="px-6 py-4 text-right text-zinc-900 dark:text-zinc-100">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {unifiedTeam.map((member) => (
                <tr key={member.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">{member.full_name}</td>
                  <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{member.email}</td>
                  <td className="px-6 py-4">
                    <select
                      value={member.role}
                      disabled={member.isInvite}
                      onChange={(e) => handleRoleChange(member, e.target.value as UserRole)}
                      className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 disabled:opacity-50"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={member.group_id || 'none'}
                      disabled={member.isInvite}
                      onChange={(e) => handleGroupChange(member, e.target.value)}
                      className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 disabled:opacity-50"
                    >
                      <option value="none">None</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${member.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                      {member.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openMemberModal(member)} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                      {member.isInvite ? 'Link / Remove' : 'Edit'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ACCESS GROUPS SECTION */}
      <div className="space-y-4 md:space-y-6 border-t border-zinc-200 dark:border-zinc-800 pt-6 md:pt-8">
        <h2 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-zinc-100">Access Groups</h2>
        
        <form onSubmit={handleCreateGroup} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="New Group Name"
            className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
          />
          <button type="submit" className="rounded-md bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white font-medium text-sm">
            Add Group
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {groups.map(group => (
            <div key={group.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 md:p-4 shadow-sm flex items-center justify-between">
              <span className="font-medium text-sm md:text-base text-zinc-900 dark:text-zinc-100">{group.name}</span>
              <button onClick={() => openGroupModal(group)} className="text-xs md:text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">Edit Access</button>
            </div>
          ))}
        </div>
      </div>

      {/* INVITE MODAL */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-lg w-full max-w-md border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">Invite Team Member</h2>
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email</label>
                <input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Role</label>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as UserRole)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Access Group</label>
                <select value={inviteGroupId} onChange={(e) => setInviteGroupId(e.target.value)} className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100">
                  <option value="none">None</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsInviteModalOpen(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-800 dark:hover:bg-white">Generate Invite</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MEMBER EDIT / LINK MODAL */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-lg w-full max-w-md border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">{editingMember.isInvite ? 'Pending Invitation' : 'Edit Team Member'}</h2>
            
            {editingMember.isInvite ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Invite Link</label>
                  <p className="text-xs text-zinc-500 mb-2">Send this link to the user to allow them to create an account attached to this email.</p>
                  <div className="flex gap-2">
                    <input type="text" readOnly value={generatedLink} className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-zinc-600 dark:text-zinc-400 text-sm font-mono select-all outline-none focus:ring-0" />
                    <button 
                      type="button"
                      onClick={handleCopyLink}
                      className="flex items-center justify-center px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      title="Copy link"
                    >
                      {isCopied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between mt-6">
                  <button type="button" onClick={handleMemberDelete} className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md">Delete Invitation</button>
                  <button type="button" onClick={() => { setEditingMember(null); setGeneratedLink(''); }} className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-800 dark:hover:bg-white">Close</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleMemberSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Name</label>
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
            )}
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