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
  return data || null;
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

export async function addManualEntry(entry: { user_id: string; project_id: string; start_time: string; end_time: string; description: string }): Promise<TimeEntry> {
  const { data, error } = await supabase
    .from('time_entries')
    .insert([entry])
    .select()
    .single();
    
  if (error) throw error;
  return data;
}

export async function getMyRecentEntries(userId: string): Promise<TimeEntry[]> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*, projects(*)')
    .eq('user_id', userId)
    .not('end_time', 'is', null)
    .order('start_time', { ascending: false })
    .limit(50);
    
  if (error) throw error;
  return data || [];
}