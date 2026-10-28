import apiClient from '../api/client.js';

// servicio desacoplado para interactuar con los endpoints de membresias
export const membershipService = {
  // obtener listado de membresias (solo admin)
  // query puede incluir { status, user_id }
  getMemberships: async (token, query = {}) => {
    const params = new URLSearchParams();
    if (query.status) params.append('status', query.status);
    if (query.user_id) params.append('user_id', query.user_id);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get(`/memberships${queryString}`, { token });
  },

  // obtener la membresia del socio autenticado (member o admin)
  getMyMembership: async (token) => {
    return apiClient.get('/memberships/my', { token });
  },

  // obtener detalle de membresia por ID (solo admin)
  getMembershipById: async (id, token) => {
    return apiClient.get(`/memberships/${id}`, { token });
  },

  // crear y asignar una nueva membresia a un socio (solo admin)
  // data: { user_id, start_date, end_date, status }
  createMembership: async (data, token) => {
    return apiClient.post('/memberships', data, { token });
  },

  // actualizar datos o estado de una membresia (solo admin)
  // data: { start_date, end_date, status }
  updateMembership: async (id, data, token) => {
    return apiClient.patch(`/memberships/${id}`, data, { token });
  }
};

export default membershipService;
