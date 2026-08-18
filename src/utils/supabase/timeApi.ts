import { supabase } from './client';
import { TimeEntry } from '@/types/supabase';

export async function getActiveTimer(userId: string): Promise<TimeEntry | null> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*, projects(*)')
    .eq('user_id', userId)
    .is('end_time', null)
    .single();
    
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
  return (data as TimeEntry) || null;
}

export async function startTimer(userId: string, projectId: string, description: string): Promise<TimeEntry> {
  const { data, error } = await supabase
    .from('time_entries')
    .insert([{ 
      user_id: userId, 
      project_id: projectId, 
      description,
      start_time: new Date().toISOString() 
    }])
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function stopTimer(entryId: string): Promise<TimeEntry> {
  const { data, error } = await supabase
    .from('time_entries')
    .update({ end_time: new Date().toISOString() })
    .eq('id', entryId)
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function addManualEntry(entry: Omit<TimeEntry, 'id' | 'projects' | 'profiles'>): Promise<TimeEntry> {
  const payload = { is_tentative: false, ...entry };
  const { data, error } = await supabase.from('time_entries').insert([payload]).select().single();
  if (error) throw error;
  return data;
}

export async function getMyRecentEntries(userId: string): Promise<TimeEntry[]> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*, projects(*, clients(*))')
    .eq('user_id', userId)
    .order('start_time', { ascending: false })
    .limit(100);
  
  if (error) throw error;
  return data || [];
}

export async function updateTimeEntry(id: string, updates: Partial<TimeEntry>): Promise<TimeEntry> {
  const { data, error } = await supabase.from('time_entries').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const { error } = await supabase.from('time_entries').delete().eq('id', id);
  if (error) throw error;
}

export async function bulkInsertTimeEntries(entries: Omit<TimeEntry, 'id' | 'projects' | 'profiles'>[]): Promise<void> {
  const { error } = await supabase.from('time_entries').insert(entries);
  if (error) throw error;
}

export async function bulkUpdateTimeEntries(ids: string[], updates: Partial<TimeEntry>): Promise<void> {
  const chunkSize = 200;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { error } = await supabase.from('time_entries').update(updates).in('id', chunk);
    if (error) throw error;
  }
}