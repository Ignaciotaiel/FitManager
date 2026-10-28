import apiClient from '../api/client.js';

// servicio desacoplado para operaciones de autenticacion con el backend
export const authService = {
  // inicio de sesion local con credenciales
  login: async (email, password) => {
    return apiClient.post('/auth/login', { email, password });
  },

  // registro de nuevo usuario (rol member asignado por el servidor)
  register: async (name, email, password) => {
    return apiClient.post('/auth/register', { name, email, password });
  },

  // verificacion del perfil y validez del token en el servidor
  getProfile: async (token) => {
    return apiClient.get('/auth/me', { token });
  },

  // comprobacion del estado de integracion de proveedores oauth
  checkOAuthStatus: async (provider) => {
    return apiClient.get(`/auth/${provider}`);
  },

  // verificacion e intercambio seguro de token o codigo de google
  verifyGoogle: async (payload) => {
    return apiClient.post('/auth/google/verify', payload);
  }
};

export default authService;
