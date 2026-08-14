export type UserRole = 'admin' | 'user';

export interface Group {
  id: string;
  name: string;
}

export interface GroupClient {
  group_id: string;
  client_id: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email?: string; // Added email
  role: UserRole;
  group_id: string | null;
  groups?: Group | null;
}

export interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  group_id: string | null;
  status: string;
  created_at: string;
  groups?: Group | null;
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
  clients?: Client; 
}

export interface TimeEntry {
  id: string;
  user_id: string;
  project_id: string;
  start_time: string;
  end_time: string | null;
  description: string | null;
  projects?: Project; 
  profiles?: Profile; 
}