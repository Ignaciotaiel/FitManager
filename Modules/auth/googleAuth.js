import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

let isConfigured = false;
let currentWebClientId = null;

export async function configureGoogleSignIn(webClientId) {
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

export async function hasPlayServices() {
  return GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
}

export async function signInGoogle() {
  const result = await GoogleSignin.signIn();

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

export { statusCodes };
