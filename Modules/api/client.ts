import { Platform } from 'react-native';
import { ApiResponse } from '../types';

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  token?: string | null;
  headers?: Record<string, string>;
}

export interface ApiCustomError extends Error {
  status?: number;
  code?: string;
  details?: any;
}

// determinacion de la url base por defecto segun la plataforma
// en emulador android: 10.0.2.2 apunta al localhost del equipo anfitrion
// en web o simuladores locales: 127.0.0.1
function getDefaultApiUrl(): string {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api';
  }
  return 'http://127.0.0.1:3000/api';
}

function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    const trimmed = envUrl.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  return getDefaultApiUrl();
}

// url base configurable mediante variable de entorno publica de expo (garantiza prefijo /api)
export const API_BASE_URL: string = getApiBaseUrl();

// timeout por defecto de 25 segundos para peticiones http (tolera el arranque en frío de Render)
const DEFAULT_TIMEOUT_MS = 25000;

// funcion auxiliar para peticiones con timeout seguro
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      const timeoutError: ApiCustomError = new Error('tiempo de espera agotado al conectar con el servidor');
      timeoutError.code = 'TIMEOUT_ERROR';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

// funcion principal para peticiones http
export async function apiRequest<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
  const { method = 'GET', body = null, token = null, headers = {} } = options;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${API_BASE_URL}${cleanEndpoint}`;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers: requestHeaders
  };

  if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetchWithTimeout(fullUrl, fetchOptions);

    let data: any = null;
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
      const apiError: ApiCustomError = new Error(errorMsg);
      apiError.status = response.status;
      apiError.code = data?.error?.code || 'API_ERROR';
      apiError.details = data;
      throw apiError;
    }

    return data;
  } catch (error: any) {
    // control de errores de conexion sin ocultar la causa
    if (error.code === 'TIMEOUT_ERROR') {
      throw error;
    }
    if (error.message?.includes('Network request failed') || error.message?.includes('fetch failed')) {
      const netError: ApiCustomError = new Error('no se pudo conectar con el servidor. verifica tu conexion a internet o la url del backend');
      netError.code = 'NETWORK_ERROR';
      netError.status = 0;
      throw netError;
    }
    throw error;
  }
}

// clientes con metodos http estandar
export const apiClient = {
  get: <T = any>(endpoint: string, options: Omit<ApiRequestOptions, 'method'> = {}) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),
  post: <T = any>(endpoint: string, body?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),
  put: <T = any>(endpoint: string, body?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),
  patch: <T = any>(endpoint: string, body?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) =>
    apiRequest<T>(endpoint, { ...options, method: 'PATCH', body }),
  delete: <T = any>(endpoint: string, options: Omit<ApiRequestOptions, 'method'> = {}) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' })
};

export default apiClient;

