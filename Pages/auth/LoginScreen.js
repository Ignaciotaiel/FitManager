import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { useTheme } from '../../contexto/themeContext.js';
import { useAuth } from '../../contexto/authContext.js';
import { authService } from '../../Modules/auth/authService.js';
import {
  Button,
  Input,
  Card,
  StatusBanner
} from '../../Modules/components/index.js';
import {
  configureGoogleSignIn,
  hasPlayServices,
  signInGoogle,
  statusCodes
} from '../../Modules/auth/googleAuth.js';

export function LoginScreen({ navigation }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { login } = useAuth();

  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [socialInfo, setSocialInfo] = useState(null);

  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm({
    defaultValues: {
      email: '',
      password: ''
    }
  });

  // envio del formulario de inicio de sesion local
  const onSubmit = async (data) => {
    setErrorMessage(null);
    setSocialInfo(null);
    setLoading(true);

    try {
      const response = await authService.login(data.email.trim(), data.password);

      if (response?.ok && response?.data?.token) {
        // persistencia segura y actualizacion del contexto
        await login(response.data.token, response.data.user);
      } else {
        setErrorMessage(response?.error?.message || 'no fue posible iniciar sesion');
      }
    } catch (error) {
      if (error.status === 401) {
        setErrorMessage('correo o contrasena incorrectos');
      } else if (error.status === 403) {
        setErrorMessage('tu cuenta se encuentra desactivada. contacta al administrador');
      } else if (error.status === 400 && error.code === 'SOCIAL_ACCOUNT_ONLY') {
        setErrorMessage('esta cuenta fue creada mediante inicio social, ingresa con tu proveedor');
      } else if (error.code === 'TIMEOUT_ERROR') {
        setErrorMessage('el servidor tardó demasiado en responder. por favor, intenta nuevamente.');
      } else if (error.code === 'NETWORK_ERROR') {
        setErrorMessage('no se pudo conectar con el servidor. verifica tu conexion a internet.');
      } else {
        setErrorMessage(error.message || 'error inesperado al iniciar sesion');
      }
    } finally {
      setLoading(false);
    }
  };

  // manejo de inicio de sesion social nativo con Google Sign-In para Android
  const handleSocialLogin = async (provider) => {
    if (socialLoading || loading) {
      return;
    }

    setErrorMessage(null);
    setSocialInfo(null);

    if (provider === 'google') {
      if (Platform.OS === 'web') {
        setSocialInfo(
          'El inicio de sesión con Google está disponible únicamente en la aplicación móvil.'
        );
        return;
      }

      setSocialLoading(true);

      try {
        // 1. Obtener el Web Client ID (audiencia necesaria para el id_token)
        const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

        if (!webClientId) {
          setErrorMessage(
            'El inicio con Google requiere configurar EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID en el archivo .env de la aplicación.'
          );
          setSocialLoading(false);
          return;
        }

        // 2. Configurar GoogleSignin con el Web Client ID
        await configureGoogleSignIn(webClientId);

        // 3. Verificar disponibilidad de Google Play Services
        await hasPlayServices();

        // 4. Iniciar diálogo nativo de Google Sign-In
        const signInResult = await signInGoogle();

        // Si el usuario canceló voluntariamente el diálogo, salir silenciosamente
        if (signInResult?.cancelled) {
          setSocialLoading(false);
          return;
        }

        const idToken = signInResult?.idToken;

        if (!idToken) {
          setErrorMessage('Google no proporcionó el token de identidad necesario. Por favor, intenta de nuevo.');
          setSocialLoading(false);
          return;
        }

        // 5. Enviar id_token al backend para validación segura contra tokeninfo de Google
        const verifyRes = await authService.verifyGoogle({ id_token: idToken });

        if (verifyRes?.ok && verifyRes?.data?.token) {
          await login(verifyRes.data.token, verifyRes.data.user);
        } else {
          setErrorMessage(verifyRes?.error?.message || 'Error al validar la cuenta de Google con el servidor.');
        }
      } catch (error) {
        if (error.code === statusCodes?.SIGN_IN_CANCELLED || error.code === 'SIGN_IN_CANCELLED' || error.code === 12501) {
          // Cancelación voluntaria por excepción nativa: cerrar silenciosamente
          return;
        } else if (error.code === statusCodes?.IN_PROGRESS || error.code === 'IN_PROGRESS') {
          setSocialInfo('El inicio de sesión con Google ya se encuentra en curso.');
        } else if (error.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE || error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
          setErrorMessage('Los servicios de Google Play no están disponibles en este dispositivo o requieren actualización.');
        } else if (error.code === 'TIMEOUT_ERROR') {
          setErrorMessage('El servidor tardó en responder la validación de Google. El servicio puede estar iniciando; por favor, reintenta.');
        } else if (error.code === 'NETWORK_ERROR') {
          setErrorMessage('No se pudo conectar con el servidor para validar tu cuenta de Google.');
        } else if (error.status === 401) {
          setErrorMessage(error.message || 'El token de Google fue rechazado por el servidor.');
        } else if (error.status === 403) {
          setErrorMessage('Tu cuenta vinculada a Google se encuentra desactivada.');
        } else {
          setErrorMessage(error.message || 'Error al procesar el inicio de sesión con Google.');
        }
      } finally {
        setSocialLoading(false);
      }
      return;
    }

    // Para github y discord (Fase 2B)
    try {
      setSocialLoading(true);
      await authService.checkOAuthStatus(provider);
      setSocialInfo(`proveedor ${provider} preparado para la siguiente fase.`);
    } catch (error) {
      if (error.code === 'OAUTH_NOT_CONFIGURED' || error.status === 501) {
        setSocialInfo(
          `el inicio de sesion con ${provider} requiere credenciales oauth en backend/.env (aun no configuradas).`
        );
      } else if (error.code === 'NETWORK_ERROR') {
        setErrorMessage('no se pudo verificar el proveedor social. el servidor no responde.');
      } else {
        setSocialInfo(`estado de ${provider}: ${error.message}`);
      }
    } finally {
      setSocialLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* barra de navegacion superior */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.backButton, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="volver"
            >
              <Text style={[styles.backText, { color: colors.textSecondary }]}>
                VOLVER
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleTheme}
              style={[styles.backButton, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="cambiar tema"
            >
              <Text style={[styles.backText, { color: colors.textSecondary }]}>
                {isDark ? 'CLARO' : 'OSCURO'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* titulo y presentacion */}
          <View style={styles.titleSection}>
            <Text style={[styles.brandLabel, { color: colors.primary }]}>
              ACCESO A TU CUENTA
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              INICIAR SESIÓN
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              ingresá tus datos para ingresar a tu panel de entrenamiento
            </Text>
          </View>

          {/* avisos visuales de estado */}
          {errorMessage && <StatusBanner message={errorMessage} type="error" />}
          {socialInfo && <StatusBanner message={socialInfo} type="warning" />}

          {/* formulario principal */}
          <Card style={styles.formCard}>
            <Controller
              control={control}
              name="email"
              rules={{
                required: 'el correo electronico es obligatorio',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'formato de correo electronico invalido'
                }
              }}
              render={({ field: { onChange, value } }) => (
                <Input
                  label="correo electronico"
                  placeholder="ejemplo@correo.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={value}
                  onChangeText={onChange}
                  error={errors.email?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              rules={{
                required: 'la contrasena es obligatoria'
              }}
              render={({ field: { onChange, value } }) => (
                <Input
                  label="contrasena"
                  placeholder="ingresa tu contrasena"
                  isPassword
                  value={value}
                  onChangeText={onChange}
                  error={errors.password?.message}
                />
              )}
            />

            <Button
              title="INGRESAR"
              onPress={handleSubmit(onSubmit)}
              loading={loading}
              disabled={loading}
              style={styles.submitBtn}
            />
          </Card>

          {/* seccion de proveedores sociales */}
          <View style={styles.socialSection}>
            <View style={styles.dividerContainer}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textMuted }]}>
                O CONTINUAR CON
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <View style={styles.socialButtonsRow}>
              <TouchableOpacity
                onPress={() => handleSocialLogin('google')}
                disabled={socialLoading || loading}
                style={[
                  styles.socialButton,
                  { borderColor: colors.border, backgroundColor: colors.card },
                  (Platform.OS === 'web' || socialLoading || loading) && { opacity: 0.6 }
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  Platform.OS === 'web'
                    ? 'Google (disponible únicamente en la app móvil)'
                    : 'iniciar con google'
                }
              >
                <Text style={[styles.socialButtonText, { color: colors.text }]}>
                  {socialLoading ? 'CONECTANDO...' : 'GOOGLE'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSocialLogin('github')}
                style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.card }]}
                accessibilityRole="button"
                accessibilityLabel="iniciar con github"
              >
                <Text style={[styles.socialButtonText, { color: colors.text }]}>
                  GITHUB
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSocialLogin('discord')}
                style={[styles.socialButton, { borderColor: colors.border, backgroundColor: colors.card }]}
                accessibilityRole="button"
                accessibilityLabel="iniciar con discord"
              >
                <Text style={[styles.socialButtonText, { color: colors.text }]}>
                  DISCORD
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* pie de pantalla hacia registro */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              ¿todavia no tenes cuenta?
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={[styles.footerLink, { color: colors.primary }]}>
                registrate aqui
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  keyboardContainer: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingVertical: 14
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  backText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  titleSection: {
    marginBottom: 16
  },
  brandLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4
  },
  formCard: {
    marginTop: 8,
    padding: 16
  },
  submitBtn: {
    marginTop: 10
  },
  socialSection: {
    marginTop: 20
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12
  },
  dividerLine: {
    flex: 1,
    height: 1
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  socialButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between'
  },
  socialButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  socialButtonText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 28,
    marginBottom: 20
  },
  footerText: {
    fontSize: 13
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700'
  }
});

export default LoginScreen;
