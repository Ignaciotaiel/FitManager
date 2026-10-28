// Adaptador web para Google Sign-In: No importa ni ejecuta ningún módulo nativo
export async function configureGoogleSignIn(_webClientId) {
  // En web no se ejecuta la configuración nativa
}

export async function hasPlayServices() {
  return false;
}

export async function signInGoogle() {
  throw new Error('google_signin_not_supported_on_web');
}

export async function signOutGoogle() {
  // En web no hay sesión nativa que cerrar
}

export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE'
};
