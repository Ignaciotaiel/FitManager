import apiClient from '../api/client';

// servicio desacoplado para interactuar con los endpoints de entrenamientos y series
export const workoutService = {
  // registrar una nueva sesion de entrenamiento (con o sin series)
  createSession: async (data: any, token?: string | null) => {
    return apiClient.post('/workouts/sessions', data, { token });
  },

  // agregar una serie a una sesion abierta
  addSetToSession: async (sessionId: number | string, data: any, token?: string | null) => {
    return apiClient.post(`/workouts/sessions/${sessionId}/sets`, data, { token });
  },

  // consultar detalle completo y series de una sesion especifica
  getSessionById: async (sessionId: number | string, token?: string | null) => {
    return apiClient.get(`/workouts/sessions/${sessionId}`, { token });
  },

  // consultar historial de sesiones (opcionalmente filtrado por member_id)
  getHistory: async (params: Record<string, any> = {}, token?: string | null) => {
    const query = new URLSearchParams();
    if (params.member_id) query.append('member_id', params.member_id);
    if (params.limit) query.append('limit', params.limit);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get(`/workouts/history${qs}`, { token });
  },

  // consultar ultimo peso y reps registradas para un ejercicio puntual
  getLastExerciseLog: async (exerciseId: number | string, token?: string | null) => {
    return apiClient.get(`/workouts/exercises/${exerciseId}/last`, { token });
  },

  // consultar historial cronologico de un ejercicio puntual
  getExerciseHistory: async (exerciseId: number | string, params: Record<string, any> = {}, token?: string | null) => {
    const query = new URLSearchParams();
    if (params.member_id) query.append('member_id', params.member_id);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get(`/workouts/exercises/${exerciseId}/history${qs}`, { token });
  },

  // obtener sesion activa en curso (si existe) para una rutina
  getActiveSession: async (routineId: number | string, token?: string | null) => {
    const qs = routineId ? `?routine_id=${routineId}` : '';
    return apiClient.get(`/workouts/sessions/active${qs}`, { token });
  },

  // finalizar formalmente una sesion de entrenamiento
  finishSession: async (sessionId: number | string, token?: string | null) => {
    return apiClient.patch(`/workouts/sessions/${sessionId}/finish`, {}, { token });
  },

  // corregir kilos o repeticiones de una serie propia
  updateSet: async (setId: number | string, data: any, token?: string | null) => {
    return apiClient.patch(`/workouts/sets/${setId}`, data, { token });
  },

  // eliminar una serie propia
  deleteSet: async (setId: number | string, token?: string | null) => {
    return apiClient.delete(`/workouts/sets/${setId}`, { token });
  },

  // obtener lista de socios asignados al entrenador autenticado
  getTrainerMembers: async (token?: string | null) => {
    return apiClient.get('/workouts/trainer/members', { token });
  }
};

export default workoutService;
