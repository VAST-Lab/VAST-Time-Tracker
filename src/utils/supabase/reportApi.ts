import { supabase } from './client';
import { TimeEntry } from '@/types/supabase';

export async function getReportEntries(
  startDate: string, 
  endDate: string, 
  projectId?: string, 
  userId?: string
): Promise<TimeEntry[]> {
  let query = supabase
    .from('time_entries')
    .select('*, projects(*), profiles(*)')
    .gte('start_time', `${startDate}T00:00:00.000Z`)
    .lte('start_time', `${endDate}T23:59:59.999Z`)
    .not('end_time', 'is', null) // Only fetch completed entries
    .order('start_time', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }
  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
    
  if (error) throw error;
  return data || [];
}