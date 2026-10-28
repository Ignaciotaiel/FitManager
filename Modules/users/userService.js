import apiClient from '../api/client.js';

// servicio para interactuar con los endpoints de usuarios existentes en el backend
export const userService = {
  // obtener listado completo de usuarios (restringido a admin)
  getUsers: async (token) => {
    return apiClient.get('/users', { token });
  },

  // obtener detalle de un usuario especifico
  getUserById: async (id, token) => {
    return apiClient.get(`/users/${id}`, { token });
  },

  // actualizar rol o estado activo/inactivo (restringido a admin)
  updateUser: async (id, data, token) => {
    return apiClient.patch(`/users/${id}`, data, { token });
  }
};

export default userService;
