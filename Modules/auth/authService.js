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
  },

  // verificacion del codigo de 6 digitos enviado por email
  verifyEmail: async (email, code) => {
    return apiClient.post('/auth/verify-email', { email, code });
  },

  // reenvio de codigo de verificacion de 6 digitos
  resendVerification: async (email) => {
    return apiClient.post('/auth/resend-verification', { email });
  },

  // recuperacion de contrasena: solicitar envio de codigo al correo
  forgotPassword: async (email) => {
    return apiClient.post('/auth/forgot-password', { email });
  },

  // recuperacion de contrasena: verificar codigo de 6 digitos y obtener reset_token temporal
  verifyResetCode: async (email, code) => {
    return apiClient.post('/auth/verify-reset-code', { email, code });
  },

  // recuperacion de contrasena: establecer nueva contrasena usando el reset_token de un solo uso
  resetPassword: async (resetToken, newPassword) => {
    return apiClient.post('/auth/reset-password', { resetToken, newPassword });
  }
};

export default authService;
