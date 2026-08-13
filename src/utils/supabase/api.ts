import { supabase } from './client';
import { Client, Project, Profile, UserRole } from '@/types/supabase';

// --- CLIENTS API ---

export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name');
  
  if (error) throw error;
  return data || [];
}

export async function createClient(name: string): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .insert([{ name, is_active: true }])
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

// --- PROJECTS API ---

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, clients(*)')
    .order('name');
    
  if (error) throw error;
  return data || [];
}

export async function createProject(project: Omit<Project, 'id' | 'is_active' | 'clients'>): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert([project])
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

// --- TEAMS (PROFILES) API ---

export async function getTeamMembers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name');
    
  if (error) throw error;
  return data || [];
}

export async function updateTeamMemberRole(id: string, role: UserRole): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}