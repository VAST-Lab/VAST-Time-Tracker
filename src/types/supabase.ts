export type UserRole = 'admin' | 'user';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
}

export interface Client {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  color_hex: string;
  is_active: boolean;
  clients?: Client; // For joined queries
}

export interface TimeEntry {
  id: string;
  user_id: string;
  project_id: string;
  start_time: string;
  end_time: string | null;
  description: string | null;
  projects?: Project; // For joined queries
  profiles?: Profile; // For joined queries
}