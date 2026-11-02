import apiClient from '../api/client';
import type {
  ActivityLog,
  AdminNotification,
  Incident,
  IncidentCategory,
  IncidentStatus,
  NotificationTarget
} from '../types';

export interface ActivityLogFilters {
  userId?: number | string | null;
  category?: string | null;
  startDate?: string | null; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  limit?: number;
  offset?: number;
}

export interface NotificationInput {
  title: string;
  content: string;
  target_role: NotificationTarget;
  is_active?: boolean;
}

export interface IncidentInput {
  title: string;
  description: string;
  category: IncidentCategory;
}

export interface IncidentUpdate extends Partial<IncidentInput> {
  status?: IncidentStatus;
  resolution_notes?: string | null;
}

export type ExportEntity =
  | 'users'
  | 'trainers'
  | 'members'
  | 'exercises'
  | 'routines'
  | 'activity_logs'
  | 'incidents';

function buildQuery(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      search.append(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

// servicio que conecta las pantallas de administracion con los endpoints /api/admin del backend
// (todos los endpoints exigen jwt valido y rol admin salvo notifications/active)
export const adminService = {
  // ---- registro de actividad ----
  getActivityLogs: async (filters: ActivityLogFilters, token?: string | null) => {
    const query = buildQuery({
      userId: filters.userId,
      category: filters.category,
      // se amplian las fechas para cubrir el dia completo
      startDate: filters.startDate ? `${filters.startDate} 00:00:00` : null,
      endDate: filters.endDate ? `${filters.endDate} 23:59:59` : null,
      limit: filters.limit,
      offset: filters.offset
    });
    return apiClient.get<{ logs: ActivityLog[] }>(`/admin/activity-logs${query}`, { token });
  },

  // ---- centro de notificaciones ----
  getNotifications: async (token?: string | null) => {
    return apiClient.get<{ notifications: AdminNotification[] }>('/admin/notifications', { token });
  },

  createNotification: async (data: NotificationInput, token?: string | null) => {
    return apiClient.post('/admin/notifications', data, { token });
  },

  updateNotification: async (id: number | string, data: Partial<NotificationInput>, token?: string | null) => {
    return apiClient.put(`/admin/notifications/${id}`, data, { token });
  },

  deleteNotification: async (id: number | string, token?: string | null) => {
    return apiClient.delete(`/admin/notifications/${id}`, { token });
  },

  // notificaciones activas dirigidas al rol del usuario autenticado (admin, entrenador o socio)
  getActiveNotifications: async (token?: string | null) => {
    return apiClient.get<{ notifications: AdminNotification[] }>('/admin/notifications/active', { token });
  },

  // ---- gestion de incidencias ----
  getIncidents: async (
    filters: { status?: string | null; category?: string | null },
    token?: string | null
  ) => {
    const query = buildQuery({ status: filters.status, category: filters.category });
    return apiClient.get<{ incidents: Incident[] }>(`/admin/incidents${query}`, { token });
  },

  createIncident: async (data: IncidentInput, token?: string | null) => {
    return apiClient.post('/admin/incidents', data, { token });
  },

  updateIncident: async (id: number | string, data: IncidentUpdate, token?: string | null) => {
    return apiClient.patch(`/admin/incidents/${id}`, data, { token });
  },

  deleteIncident: async (id: number | string, token?: string | null) => {
    return apiClient.delete(`/admin/incidents/${id}`, { token });
  },

  // ---- exportacion de informes ----
  getExportData: async (entity: ExportEntity, token?: string | null) => {
    return apiClient.get<{ entity: string; records: Record<string, any>[] }>(
      `/admin/export/${entity}`,
      { token }
    );
  }
};

export default adminService;

