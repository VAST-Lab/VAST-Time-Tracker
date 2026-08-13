'use client'
import { useEffect, useState } from 'react'
import { getTeamMembers, updateTeamMemberRole } from '@/utils/supabase/api'
import { Profile, UserRole } from '@/types/supabase'
import { useAdmin } from '@/hooks/useAdmin'

export default function TeamsPage() {
  const isAdmin = useAdmin()
  const [team, setTeam] = useState<Profile[]>([])

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

  if (isAdmin === null) return <div>Loading...</div>
  if (!isAdmin) return <div>Access Denied. Administrators only.</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Team Members</h1>

      <div className="grid gap-4 md:hidden">
        {team.map(member => (
          <div key={member.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="font-medium text-zinc-900">{member.full_name}</div>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}