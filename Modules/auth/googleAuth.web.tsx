// Adaptador web para Google Sign-In en navegadores (Chrome / escritorio)
// Utiliza el flujo OAuth 2.0 Authorization Code con validacion de state contra CSRF
// y canje de ticket de un solo uso en el backend (sin exponer secretos ni JWT en la URL).

export async function configureGoogleSignIn(_webClientId: string) {
  // En web la configuracion se gestiona en el endpoint OAuth del servidor
}

// Devuelve verdadero en web para mantener compatibilidad con la interfaz del adaptador.
export async function hasPlayServices() {
  return true;
}

// Función de compatibilidad para la interfaz unificada de autenticación con Google.
export async function signInGoogle(): Promise<{
  cancelled: boolean;
  idToken: string | null;
  user: any;
}> {
  return { cancelled: false, idToken: null, user: null };
}

// Redirige el navegador al endpoint OAuth 2.0 del backend indicando el origen de retorno.
export function startGoogleWebOAuth(apiBaseUrl: string) {
  if (typeof window === 'undefined') return;
  const origin = window.location.origin;
  const cleanBase = apiBaseUrl.replace(/\/+$/, '');
  const targetUrl = `${cleanBase}/auth/google?platform=web&return_origin=${encodeURIComponent(origin)}`;
  window.location.assign(targetUrl);
}

// Función de limpieza de sesión Google en entorno web.
export async function signOutGoogle() {
  // En web la sesion local se limpia eliminando el JWT de FitManager
}

export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE'
};
