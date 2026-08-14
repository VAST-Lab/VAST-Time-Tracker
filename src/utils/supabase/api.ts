import { supabase } from './client';
import { Client, Project, Profile, UserRole, Group } from '@/types/supabase';

// --- AUTH UTILS ---
async function getUserAccess() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { isAdmin: false, group_id: null, allowedClientIds: [] as string[] };

  const { data: profile } = await supabase.from('profiles').select('role, group_id').eq('id', user.id).single();
  const isAdmin = profile?.role === 'admin';
  const allowedClientIds: string[] = [];

  if (!isAdmin && profile?.group_id) {
    const { data: gc } = await supabase.from('group_clients').select('client_id').eq('group_id', profile.group_id);
    if (gc) {
      gc.forEach(g => allowedClientIds.push(g.client_id as string));
    }
  }

  return { isAdmin, group_id: profile?.group_id, allowedClientIds };
}

// --- CLIENTS API ---
export async function getClients(): Promise<Client[]> {
  const { isAdmin, group_id, allowedClientIds } = await getUserAccess();
  if (!isAdmin && !group_id) return []; 

  const { data, error } = await supabase.from('clients').select('*').order('name');
  if (error) throw error;
  
  const clients = (data as Client[]) || [];
  if (!isAdmin) return clients.filter(c => allowedClientIds.includes(c.id));
  return clients;
}

export async function createClient(name: string): Promise<Client> {
  const { data, error } = await supabase.from('clients').insert([{ name, is_active: true }]).select().single();
  if (error) throw error;
  return data;
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<Client> {
  const { data, error } = await supabase.from('clients').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}

// --- PROJECTS API ---
export async function getProjects(): Promise<Project[]> {
  const { isAdmin, group_id, allowedClientIds } = await getUserAccess();
  if (!isAdmin && !group_id) return [];

  const { data, error } = await supabase.from('projects').select('*, clients(*)').order('name');
  if (error) throw error;

  const projects = (data as Project[]) || [];
  if (!isAdmin) return projects.filter(p => allowedClientIds.includes(p.client_id));
  return projects;
}

export async function createProject(project: Omit<Project, 'id' | 'is_active' | 'clients'>): Promise<Project> {
  const { data, error } = await supabase.from('projects').insert([project]).select().single();
  if (error) throw error;
  return data;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  const { data, error } = await supabase.from('projects').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

// --- TEAMS (PROFILES) API ---
export async function getTeamMembers(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*, groups(*)').order('full_name');
  if (error) throw error;
  return data || [];
}

export async function updateTeamMemberRole(id: string, role: UserRole): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update({ role }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function updateTeamMemberName(id: string, full_name: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update({ full_name }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function updateTeamMemberGroup(id: string, group_id: string | null): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update({ group_id }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTeamMember(id: string): Promise<void> {
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) throw error;
}

// --- GROUPS API ---
export async function getGroups(): Promise<Group[]> {
  const { data, error } = await supabase.from('groups').select('*').order('name');
  if (error) throw error;
  return data || [];
}

export async function createGroup(name: string): Promise<Group> {
  const { data, error } = await supabase.from('groups').insert([{ name }]).select().single();
  if (error) throw error;
  return data;
}

export async function deleteGroup(id: string): Promise<void> {
  const { error } = await supabase.from('groups').delete().eq('id', id);
  if (error) throw error;
}

export async function getGroupClients(group_id: string): Promise<string[]> {
  const { data, error } = await supabase.from('group_clients').select('client_id').eq('group_id', group_id);
  if (error) throw error;
  return data?.map(g => g.client_id) || [];
}

export async function updateGroupClients(group_id: string, client_ids: string[]): Promise<void> {
  await supabase.from('group_clients').delete().eq('group_id', group_id);
  if (client_ids.length > 0) {
    const inserts = client_ids.map(client_id => ({ group_id, client_id }));
    const { error } = await supabase.from('group_clients').insert(inserts);
    if (error) throw error;
  }
}