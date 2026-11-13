// Adaptador nativo de Google Sign-In para dispositivos Android.
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

let isConfigured = false;
let currentWebClientId: string | null = null;

// Inicializa la configuración del cliente nativo de Google Sign-In en Android.
export async function configureGoogleSignIn(webClientId: string) {
  if (isConfigured && currentWebClientId === webClientId) {
    return;
  }
  GoogleSignin.configure({
    webClientId,
    offlineAccess: false,
    scopes: ['profile', 'email']
  });
  isConfigured = true;
  currentWebClientId = webClientId;
}

// Verifica que el dispositivo Android cuente con Google Play Services disponibles.
export async function hasPlayServices() {
  return GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
}

// Abre el selector nativo de cuentas de Google y devuelve el idToken obtenido.
export async function signInGoogle() {
  const result: any = await GoogleSignin.signIn();

  // Si el usuario canceló voluntariamente el selector (en v16 devuelve type === 'cancelled')
  if (result?.type === 'cancelled') {
    return { cancelled: true, idToken: null, user: null };
  }

  // 1. Extraer idToken de la respuesta directa (v16 data.idToken o idToken en versiones anteriores)
  let idToken = result?.data?.idToken || result?.idToken || null;

  // 2. Si el diálogo finalizó pero el objeto no trajo idToken (comportamiento en cuentas previamente seleccionadas en Android),
  // se solicita explícitamente a través de getTokens()
  if (!idToken) {
    try {
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens?.idToken || null;
    } catch (tokenErr) {
      console.warn('aviso al obtener tokens de google:', tokenErr?.message);
    }
  }

  return { cancelled: false, idToken, user: result?.data?.user || result?.user || null };
}

// Cierra la sesión activa del cliente nativo de Google en el dispositivo.
export async function signOutGoogle() {
  try {
    const isSigned = await GoogleSignin.hasPreviousSignIn();
    if (isSigned) {
      await GoogleSignin.signOut();
    }
  } catch (error) {
    console.warn('aviso al cerrar sesion de google en android:', error?.message);
  }
}

// Función de compatibilidad sin efecto en Android para el flujo OAuth web.
export function startGoogleWebOAuth(_apiBaseUrl: string) {
  // No-op en nativo; en Android se utiliza el flujo nativo de Google Play Services
}

export { statusCodes };
