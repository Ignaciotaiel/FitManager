// Centraliza las solicitudes HTTP del panel administrativo (auditoría, avisos, incidencias y exportación).
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

// Construye la cadena de parámetros URL ignorando valores vacíos o nulos.
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
  // Consulta el historial de actividad aplicando filtros opcionales de usuario, categoría y fechas.
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

  // Obtiene todas las notificaciones registradas en el panel de administración.
  getNotifications: async (token?: string | null) => {
    return apiClient.get<{ notifications: AdminNotification[] }>('/admin/notifications', { token });
  },

  // Publica una nueva notificación interna dirigida a todos los usuarios o a un rol específico.
  createNotification: async (data: NotificationInput, token?: string | null) => {
    return apiClient.post('/admin/notifications', data, { token });
  },

  // Actualiza el título, contenido, rol destinatario o visibilidad de una notificación.
  updateNotification: async (id: number | string, data: Partial<NotificationInput>, token?: string | null) => {
    return apiClient.put(`/admin/notifications/${id}`, data, { token });
  },

  // Elimina de forma permanente una notificación administrativa.
  deleteNotification: async (id: number | string, token?: string | null) => {
    return apiClient.delete(`/admin/notifications/${id}`, { token });
  },

  // Obtiene las notificaciones activas dirigidas al rol del usuario autenticado y la cantidad de no leídas.
  getActiveNotifications: async (token?: string | null) => {
    return apiClient.get<{ notifications: AdminNotification[]; unread_count?: number }>(
      '/admin/notifications/active',
      { token }
    );
  },

  // Marca como leídas las notificaciones activas del usuario autenticado de forma individual.
  markNotificationsRead: async (notificationIds?: number[], token?: string | null) => {
    const body = Array.isArray(notificationIds) && notificationIds.length > 0 ? { notificationIds } : {};
    return apiClient.post<{ marked_count: number; unread_count: number }>(
      '/admin/notifications/read',
      body,
      { token }
    );
  },

  // Obtiene el listado de incidencias filtrado opcionalmente por estado y categoría.
  getIncidents: async (
    filters: { status?: string | null; category?: string | null },
    token?: string | null
  ) => {
    const query = buildQuery({ status: filters.status, category: filters.category });
    return apiClient.get<{ incidents: Incident[] }>(`/admin/incidents${query}`, { token });
  },

  // Registra una nueva incidencia operativa o de equipamiento.
  createIncident: async (data: IncidentInput, token?: string | null) => {
    return apiClient.post('/admin/incidents', data, { token });
  },

  // Actualiza el estado, notas de resolución o datos de una incidencia existente.
  updateIncident: async (id: number | string, data: IncidentUpdate, token?: string | null) => {
    return apiClient.patch(`/admin/incidents/${id}`, data, { token });
  },

  // Elimina una incidencia del registro administrativo.
  deleteIncident: async (id: number | string, token?: string | null) => {
    return apiClient.delete(`/admin/incidents/${id}`, { token });
  },

  // Solicita los registros completos de una entidad para su exportación a CSV.
  getExportData: async (entity: ExportEntity, token?: string | null) => {
    return apiClient.get<{ entity: string; records: Record<string, any>[] }>(
      `/admin/export/${entity}`,
      { token }
    );
  }
};

export default adminService;

