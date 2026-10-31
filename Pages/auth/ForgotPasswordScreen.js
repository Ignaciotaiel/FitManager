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

export function ForgotPasswordScreen({ navigation }) {
  const { colors, isDark, toggleTheme } = useTheme();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);

  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm({
    defaultValues: {
      email: ''
    }
  });

  const onSubmit = async (data) => {
    const cleanEmail = data.email.trim().toLowerCase();
    setErrorMessage(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      const response = await authService.forgotPassword(cleanEmail);

      // El backend siempre responde con 200 y mensaje genérico por seguridad (anti-enumeración)
      const successText =
        response?.message ||
        'Si el correo está registrado y cuenta con contraseña local, te enviamos un código de recuperación.';

      setInfoMessage(successText);

      // Avanzar a la pantalla de verificación del código tras breve pausa
      setTimeout(() => {
        navigation.navigate('VerifyResetCode', { email: cleanEmail });
      }, 1500);
    } catch (error) {
      if (error.code === 'TIMEOUT_ERROR') {
        setErrorMessage('El servidor tardó en responder. Por favor intentá nuevamente.');
      } else if (error.code === 'NETWORK_ERROR') {
        setErrorMessage('No se pudo conectar con el servidor. Verificá tu conexión a internet.');
      } else if (error.status === 400 && error.code === 'INVALID_EMAIL') {
        setErrorMessage('Debes ingresar un formato de correo electrónico válido.');
      } else {
        setErrorMessage(error.message || 'Error inesperado al solicitar la recuperación.');
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
          {/* Barra de navegación superior */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.backButton, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Volver al inicio de sesión"
            >
              <Text style={[styles.backText, { color: colors.textSecondary }]}>
                ‹ VOLVER
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

          {/* Encabezado y títulos */}
          <View style={styles.titleSection}>
            <Text style={[styles.brandLabel, { color: colors.primary }]}>
              RECUPERAR ACCESO
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              ¿OLVIDASTE TU CONTRASEÑA?
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Ingresá el correo asociado a tu cuenta para recibir un código de recuperación de 6 dígitos.
            </Text>
          </View>

          {/* Avisos de estado */}
          {errorMessage && <StatusBanner message={errorMessage} type="error" />}
          {infoMessage && <StatusBanner message={infoMessage} type="success" />}

          {/* Tarjeta con formulario */}
          <Card style={styles.formCard}>
            <Controller
              control={control}
              name="email"
              rules={{
                required: 'El correo electrónico es obligatorio',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Formato de correo electrónico inválido'
                }
              }}
              render={({ field: { onChange, value } }) => (
                <Input
                  label="CORREO ELECTRÓNICO"
                  placeholder="ejemplo@correo.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={value}
                  onChangeText={onChange}
                  error={errors.email?.message}
                />
              )}
            />

            <Button
              title="ENVIAR CÓDIGO"
              onPress={handleSubmit(onSubmit)}
              loading={loading}
              disabled={loading}
              style={styles.submitBtn}
            />
          </Card>

          {/* Nota aclaratoria sobre cuentas vinculadas con Google */}
          <View style={styles.socialNoticeCard}>
            <Text style={[styles.socialNoticeTitle, { color: colors.text }]}>
              ¿Iniciás sesión con Google?
            </Text>
            <Text style={[styles.socialNoticeBody, { color: colors.textSecondary }]}>
              Las cuentas creadas exclusivamente con Google no utilizan contraseña local. Si tenés problemas para acceder a tu correo de Google, recuperá el acceso desde la plataforma de Google o volvé a iniciar sesión con el botón Google.
            </Text>
          </View>

          {/* Pie de pantalla */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              ¿Recordaste tu contraseña?
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={[styles.footerLink, { color: colors.primary }]}>
                iniciá sesión
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
    fontSize: 24,
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
  socialNoticeCard: {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  socialNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4
  },
  socialNoticeBody: {
    fontSize: 12,
    lineHeight: 17
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    marginBottom: 10
  },
  footerText: {
    fontSize: 13
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700'
  }
});

export default ForgotPasswordScreen;
