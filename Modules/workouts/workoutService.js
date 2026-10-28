import apiClient from '../api/client.js';

// servicio desacoplado para interactuar con los endpoints de entrenamientos y series
export const workoutService = {
  // registrar una nueva sesion de entrenamiento (con o sin series)
  createSession: async (data, token) => {
    return apiClient.post('/workouts/sessions', data, { token });
  },

  // agregar una serie a una sesion abierta
  addSetToSession: async (sessionId, data, token) => {
    return apiClient.post(`/workouts/sessions/${sessionId}/sets`, data, { token });
  },

  // consultar historial de sesiones (opcionalmente filtrado por member_id)
  getHistory: async (params = {}, token) => {
    const query = new URLSearchParams();
    if (params.member_id) query.append('member_id', params.member_id);
    if (params.limit) query.append('limit', params.limit);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get(`/workouts/history${qs}`, { token });
  },

  // consultar ultimo peso y reps registradas para un ejercicio puntual
  getLastExerciseLog: async (exerciseId, token) => {
    return apiClient.get(`/workouts/exercises/${exerciseId}/last`, { token });
  },

  // consultar historial cronologico de un ejercicio puntual
  getExerciseHistory: async (exerciseId, params = {}, token) => {
    const query = new URLSearchParams();
    if (params.member_id) query.append('member_id', params.member_id);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get(`/workouts/exercises/${exerciseId}/history${qs}`, { token });
  },

  // corregir kilos o repeticiones de una serie propia
  updateSet: async (setId, data, token) => {
    return apiClient.patch(`/workouts/sets/${setId}`, data, { token });
  },

  // eliminar una serie propia
  deleteSet: async (setId, token) => {
    return apiClient.delete(`/workouts/sets/${setId}`, { token });
  }
};

export default workoutService;
