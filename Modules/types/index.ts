// Definiciones de tipos fundamentales de FitManager

export type UserRole = 'admin' | 'trainer' | 'member';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: number | boolean;
  email_verified_at?: string | null;
  token_version?: number;
  created_at?: string;
}

export interface ActivityLog {
  id: number;
  user_id: number | null;
  user_name?: string | null;
  user_email?: string;
  user_role?: UserRole;
  action_type: string; // ej. CREATE, UPDATE, DELETE, LOGIN, EXPORT
  category: string; // ej. USERS, ROUTINES, EXERCISES, INCIDENTS, NOTIFICATIONS, SYSTEM
  description: string;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export type NotificationTarget = 'all' | 'trainer' | 'member';

export interface AdminNotification {
  id: number;
  title: string;
  content: string;
  target_role: NotificationTarget;
  is_active: number | boolean;
  created_by?: number;
  created_by_name?: string | null;
  created_at: string;
  updated_at?: string;
}

export type IncidentCategory = 'equipment' | 'facility' | 'safety' | 'cleanliness' | 'other';
export type IncidentStatus = 'pending' | 'in_progress' | 'resolved';

export interface Incident {
  id: number;
  title: string;
  description: string;
  category: IncidentCategory;
  status: IncidentStatus;
  created_by: number;
  created_by_name?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at?: string;
  resolved_at?: string | null;
}

export interface Exercise {
  id: number;
  name: string;
  description?: string;
  muscle_group?: string;
  equipment_needed?: string;
  video_url?: string;
  is_active?: number | boolean;
  created_at?: string;
}

export interface RoutineExercise {
  id?: number;
  routine_id?: number;
  exercise_id: number;
  exercise_name?: string;
  muscle_group?: string;
  target_sets: number;
  target_reps: number;
  order_index?: number;
  notes?: string;
}

export interface Routine {
  id: number;
  name: string;
  description?: string;
  trainer_id?: number;
  trainer_name?: string;
  is_active?: number | boolean;
  created_at?: string;
  exercises?: RoutineExercise[];
  assigned_members?: User[];
}

export interface ApiResponse<T = any> {
  ok: boolean;
  message?: string;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
}

