import apiClient from '../api/client.js';

// servicio desacoplado para interactuar con los endpoints de rutinas
export const routineService = {
  // obtener rutinas filtradas por el rol del usuario autenticado
  getRoutines: async (token) => {
    return apiClient.get('/routines', { token });
  },

  // obtener detalle de una rutina con sus ejercicios ordenados
  getRoutineById: async (id, token) => {
    return apiClient.get(`/routines/${id}`, { token });
  },

  // crear una rutina en transaccion atomica con sus ejercicios
  createRoutine: async (data, token) => {
    return apiClient.post('/routines', data, { token });
  },

  // actualizar metadatos y asignacion de socio de una rutina
  updateRoutine: async (id, data, token) => {
    return apiClient.patch(`/routines/${id}`, data, { token });
  },

  // asignar multiples socios a una rutina
  assignMembers: async (id, memberIds, token) => {
    return apiClient.post(`/routines/${id}/assignments`, { member_ids: memberIds }, { token });
  },

  // quitar la asignacion de un socio particular
  removeAssignment: async (id, memberId, token) => {
    return apiClient.delete(`/routines/${id}/assignments/${memberId}`, { token });
  },

  // eliminar rutina y sus relaciones en transaccion atomica
  deleteRoutine: async (id, token) => {
    return apiClient.delete(`/routines/${id}`, { token });
  }
};

export default routineService;
