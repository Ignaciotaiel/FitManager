import apiClient from '../api/client';

// servicio desacoplado para interactuar con los endpoints de rutinas
export const routineService = {
  // obtener rutinas filtradas por el rol del usuario autenticado
  getRoutines: async (token?: string | null) => {
    return apiClient.get('/routines', { token });
  },

  // obtener detalle de una rutina con sus ejercicios ordenados
  getRoutineById: async (id: number | string, token?: string | null) => {
    return apiClient.get(`/routines/${id}`, { token });
  },

  // crear una rutina en transaccion atomica con sus ejercicios
  createRoutine: async (data: any, token?: string | null) => {
    return apiClient.post('/routines', data, { token });
  },

  // actualizar metadatos y asignacion de socio de una rutina
  updateRoutine: async (id: number | string, data: any, token?: string | null) => {
    return apiClient.patch(`/routines/${id}`, data, { token });
  },

  // asignar multiples socios a una rutina
  assignMembers: async (id: number | string, memberIds: Array<number | string>, token?: string | null) => {
    return apiClient.post(`/routines/${id}/assignments`, { member_ids: memberIds }, { token });
  },

  // quitar la asignacion de un socio particular
  removeAssignment: async (id: number | string, memberId: number | string, token?: string | null) => {
    return apiClient.delete(`/routines/${id}/assignments/${memberId}`, { token });
  },

  // eliminar rutina y sus relaciones en transaccion atomica
  deleteRoutine: async (id: number | string, token?: string | null) => {
    return apiClient.delete(`/routines/${id}`, { token });
  }
};

export default routineService;
