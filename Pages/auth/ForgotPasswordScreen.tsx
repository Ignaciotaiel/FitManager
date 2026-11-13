// Permite solicitar un código de recuperación de contraseña por correo electrónico.
import React, { useState } from 'react';
import type { ScreenProps } from '../../Scripts/navigation/types';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { useTheme } from '../../contexto/themeContext';
import { authService } from '../../Modules/auth/authService';
import {
  Button,
  Input,
  Card,
  StatusBanner
} from '../../Modules/components/index';
import { styles } from './ForgotPasswordScreen.styles';

// Pantalla para solicitar el envío de un código de recuperación de contraseña.
export function ForgotPasswordScreen({ navigation }: ScreenProps<'ForgotPassword'>) {
  const { colors, isDark, toggleTheme } = useTheme();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<any>(null);
  const [infoMessage, setInfoMessage] = useState<any>(null);

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
          <View style={[styles.socialNoticeCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
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

export default ForgotPasswordScreen;
