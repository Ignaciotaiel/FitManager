import apiClient from '../api/client.js';

// servicio desacoplado para interactuar con los endpoints de ejercicios
export const exerciseService = {
  // obtener listado de ejercicios con soporte para filtros opcionales
  getExercises: async (filters = {}, token) => {
    let query = '';
    const params = new URLSearchParams();

    if (filters.muscle_group) params.append('muscle_group', filters.muscle_group);
    if (filters.difficulty) params.append('difficulty', filters.difficulty);
    if (filters.search) params.append('search', filters.search);

    const queryString = params.toString();
    if (queryString) {
      query = `?${queryString}`;
    }

    return apiClient.get(`/exercises${query}`, { token });
  },

  // obtener un ejercicio por identificador
  getExerciseById: async (id, token) => {
    return apiClient.get(`/exercises/${id}`, { token });
  },

  // crear ejercicio (admin y trainer)
  createExercise: async (data, token) => {
    return apiClient.post('/exercises', data, { token });
  },

  // actualizar ejercicio (admin y trainer)
  updateExercise: async (id, data, token) => {
    return apiClient.patch(`/exercises/${id}`, data, { token });
  },

  // eliminar ejercicio (solo admin; devuelve 409 si esta en uso)
  deleteExercise: async (id, token) => {
    return apiClient.delete(`/exercises/${id}`, { token });
  }
};

export default exerciseService;
