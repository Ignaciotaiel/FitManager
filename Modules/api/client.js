import { Platform } from 'react-native';

// determinacion de la url base por defecto segun la plataforma
// en emulador android: 10.0.2.2 apunta al localhost del equipo anfitrion
// en web o simuladores locales: 127.0.0.1
function getDefaultApiUrl() {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api';
  }
  return 'http://127.0.0.1:3000/api';
}

// url base configurable mediante variable de entorno publica de expo
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || getDefaultApiUrl();

// timeout por defecto de 10 segundos para peticiones http
const DEFAULT_TIMEOUT_MS = 10000;

// funcion auxiliar para peticiones con timeout seguro
async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('tiempo de espera agotado al conectar con el servidor');
      timeoutError.code = 'TIMEOUT_ERROR';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

// funcion principal para peticiones http
export async function apiRequest(endpoint, { method = 'GET', body = null, token = null, headers = {} } = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${API_BASE_URL}${cleanEndpoint}`;

  const requestHeaders = {
    'Content-Type': 'application/json',
    ...headers
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    method,
    headers: requestHeaders
  };

  if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetchWithTimeout(fullUrl, fetchOptions);

    let data = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      const textData = await response.text();
      data = textData ? { message: textData } : null;
    }

    if (!response.ok) {
      const errorMsg = data?.error?.message || data?.message || `error en la peticion (codigo ${response.status})`;
      const apiError = new Error(errorMsg);
      apiError.status = response.status;
      apiError.code = data?.error?.code || 'API_ERROR';
      apiError.details = data;
      throw apiError;
    }

    return data;
  } catch (error) {
    // control de errores de conexion sin ocultar la causa
    if (error.code === 'TIMEOUT_ERROR') {
      throw error;
    }
    if (error.message?.includes('Network request failed') || error.message?.includes('fetch failed')) {
      const netError = new Error('no se pudo conectar con el servidor. verifica tu conexion a internet o la url del backend');
      netError.code = 'NETWORK_ERROR';
      netError.status = 0;
      throw netError;
    }
    throw error;
  }
}

// clientes con metodos http estandar
export const apiClient = {
  get: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'PUT', body }),
  patch: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'PATCH', body }),
  delete: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'DELETE' })
};

export default apiClient;
