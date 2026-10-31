import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { useTheme } from '../../contexto/themeContext.js';
import { authService } from '../../Modules/auth/authService.js';
import {
  Button,
  Input,
  Card,
  StatusBanner
} from '../../Modules/components/index.js';

export function ResetPasswordScreen({ route, navigation }) {
  const { colors, isDark, toggleTheme } = useTheme();

  // resetToken recibido en memoria a través de route.params
  const resetToken = route?.params?.resetToken;
  const email = route?.params?.email || '';

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm({
    defaultValues: {
      password: '',
      confirmPassword: ''
    }
  });

  const passwordValue = watch('password');

  const onSubmit = async (data) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!resetToken) {
      setErrorMessage('La sesión de recuperación caducó o no es válida. Solicitá un nuevo código.');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.resetPassword(resetToken, data.password);

      if (response?.ok) {
        setSuccessMessage('¡Contraseña actualizada con éxito! Redirigiendo al inicio de sesión...');
        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login', params: { verifiedEmail: email } }]
          });
        }, 1500);
      } else {
        setErrorMessage(response?.error?.message || 'No fue posible actualizar la contraseña.');
      }
    } catch (error) {
      if (error?.status === 400) {
        if (error.code === 'RESET_TOKEN_ALREADY_USED') {
          setErrorMessage('Este enlace o token de recuperación ya fue utilizado. Solicitá un nuevo código.');
        } else if (error.code === 'RESET_TOKEN_EXPIRED') {
          setErrorMessage('El tiempo para cambiar la contraseña expiró (15 min). Solicitá un nuevo código.');
        } else if (error.code === 'INVALID_PASSWORD') {
          setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
        } else {
          setErrorMessage(error.message || 'Datos de recuperación inválidos.');
        }
      } else if (error?.status === 401) {
        setErrorMessage('El token de recuperación no es válido o ya caducó. Solicitá uno nuevo.');
      } else if (error.code === 'TIMEOUT_ERROR') {
        setErrorMessage('El servidor tardó en responder. Por favor intentá nuevamente.');
      } else if (error.code === 'NETWORK_ERROR') {
        setErrorMessage('No se pudo conectar con el servidor. Verificá tu conexión a internet.');
      } else {
        setErrorMessage(error.message || 'Error inesperado al cambiar la contraseña.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={[styles.backButton, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Volver al inicio de sesión"
            >
              <Text style={[styles.backText, { color: colors.textSecondary }]}>
                ‹ VOLVER AL LOGIN
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleTheme}
              style={[styles.backButton, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Cambiar tema visual"
            >
              <Text style={[styles.backText, { color: colors.textSecondary }]}>
                {isDark ? 'CLARO' : 'OSCURO'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Título de la pantalla */}
          <View style={styles.titleSection}>
            <Text style={[styles.brandLabel, { color: colors.primary }]}>
              NUEVAS CREDENCIALES
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              CREAR NUEVA CONTRASEÑA
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Ingresá una nueva contraseña segura para tu cuenta ({email || 'usuario'}).
            </Text>
          </View>

          {/* Banners de estado */}
          {errorMessage && <StatusBanner message={errorMessage} type="error" />}
          {successMessage && <StatusBanner message={successMessage} type="success" />}

          {/* Formulario */}
          <Card style={styles.formCard}>
            <Controller
              control={control}
              name="password"
              rules={{
                required: 'La nueva contraseña es obligatoria',
                minLength: {
                  value: 6,
                  message: 'La contraseña debe tener al menos 6 caracteres'
                }
              }}
              render={({ field: { onChange, value } }) => (
                <Input
                  label="NUEVA CONTRASEÑA"
                  placeholder="Mínimo 6 caracteres"
                  isPassword
                  value={value}
                  onChangeText={onChange}
                  error={errors.password?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              rules={{
                required: 'Debes confirmar tu nueva contraseña',
                validate: (value) =>
                  value === passwordValue || 'Las contraseñas ingresadas no coinciden'
              }}
              render={({ field: { onChange, value } }) => (
                <Input
                  label="CONFIRMAR NUEVA CONTRASEÑA"
                  placeholder="Repetí la contraseña"
                  isPassword
                  value={value}
                  onChangeText={onChange}
                  error={errors.confirmPassword?.message}
                />
              )}
            />

            <Button
              title="CAMBIAR CONTRASEÑA"
              onPress={handleSubmit(onSubmit)}
              loading={loading}
              disabled={loading || !resetToken}
              style={styles.submitBtn}
            />
          </Card>

          {/* Información de seguridad sobre sesiones */}
          <View style={styles.securityInfo}>
            <Text style={[styles.securityTitle, { color: colors.text }]}>
              🛡️ Protección de sesiones activas
            </Text>
            <Text style={[styles.securityText, { color: colors.textSecondary }]}>
              Al restablecer tu contraseña, todas las sesiones abiertas previamente en otros dispositivos serán cerradas de forma automática por seguridad.
            </Text>
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6
  },
  formCard: {
    marginTop: 4,
    padding: 16
  },
  submitBtn: {
    marginTop: 12
  },
  securityInfo: {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  securityTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4
  },
  securityText: {
    fontSize: 12,
    lineHeight: 17
  }
});

export default ResetPasswordScreen;
