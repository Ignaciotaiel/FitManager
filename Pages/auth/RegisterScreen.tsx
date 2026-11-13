// Pantalla de registro público para crear nuevas cuentas de socio en FitManager.
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
import { useAuth } from '../../contexto/authContext';
import { authService } from '../../Modules/auth/authService';
import {
  Button,
  Input,
  Card,
  StatusBanner
} from '../../Modules/components/index';
import { styles } from './RegisterScreen.styles';

// Pantalla con formulario validado para registrar un nuevo socio.
export function RegisterScreen({ navigation }: ScreenProps<'Register'>) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { login } = useAuth();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<any>(null);
  const [successMessage, setSuccessMessage] = useState<any>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    }
  });

  const passwordValue = watch('password');

  // envio del formulario de registro local
  const onSubmit = async (data) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const response = await authService.register(
        data.name.trim(),
        data.email.trim(),
        data.password
      );

      if (response?.ok && response?.data?.requires_verification) {
        setSuccessMessage('¡Cuenta creada! Te enviamos un código de verificación a tu correo.');
        setTimeout(() => {
          navigation.navigate('EmailVerification', { email: data.email.trim() });
        }, 800);
      } else if (response?.ok && response?.data?.token) {
        // Fallback por si en algún entorno devolviese token directo
        setSuccessMessage('cuenta creada exitosamente. ingresando...');
        setTimeout(async () => {
          await login(response.data.token, response.data.user);
        }, 800);
      } else {
        setErrorMessage(response?.error?.message || 'no fue posible completar el registro');
      }
    } catch (error) {
      if (error.status === 409 || error.code === 'EMAIL_ALREADY_EXISTS') {
        setErrorMessage('el correo electrónico ya está registrado. intentá iniciar sesión');
      } else if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT_ERROR') {
        setErrorMessage('no se pudo conectar con el servidor. verificá que el backend esté activo');
      } else {
        setErrorMessage(error.message || 'error inesperado al registrar usuario');
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
              NUEVO SOCIO
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              CREAR CUENTA
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              registrate para acceder a tus rutinas de entrenamiento
            </Text>
          </View>

          {/* avisos visuales de estado */}
          {errorMessage && <StatusBanner message={errorMessage} type="error" />}
          {successMessage && <StatusBanner message={successMessage} type="success" />}

          {/* formulario principal */}
          <Card style={styles.formCard}>
            <Controller
              control={control}
              name="name"
              rules={{
                required: 'el nombre completo es obligatorio',
                minLength: {
                  value: 2,
                  message: 'el nombre debe tener al menos 2 caracteres'
                }
              }}
              render={({ field: { onChange, value } }) => (
                <Input
                  label="nombre y apellido"
                  placeholder="ej. juan pérez"
                  autoCapitalize="words"
                  value={value}
                  onChangeText={onChange}
                  error={errors.name?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="email"
              rules={{
                required: 'el correo electrónico es obligatorio',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'formato de correo electrónico inválido'
                }
              }}
              render={({ field: { onChange, value } }) => (
                <Input
                  label="correo electrónico"
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
                required: 'la contraseña es obligatoria',
                minLength: {
                  value: 6,
                  message: 'la contraseña debe tener al menos 6 caracteres'
                }
              }}
              render={({ field: { onChange, value } }) => (
                <Input
                  label="contraseña (mín. 6 caracteres)"
                  placeholder="creá tu contraseña"
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
                required: 'confirmá tu contraseña',
                validate: (value) =>
                  value === passwordValue || 'las contraseñas no coinciden'
              }}
              render={({ field: { onChange, value } }) => (
                <Input
                  label="confirmar contraseña"
                  placeholder="repetí tu contraseña"
                  isPassword
                  value={value}
                  onChangeText={onChange}
                  error={errors.confirmPassword?.message}
                />
              )}
            />

            <Button
              title="REGISTRARME"
              onPress={handleSubmit(onSubmit)}
              loading={loading}
              disabled={loading}
              style={styles.submitBtn}
            />
          </Card>

          {/* pie de pantalla hacia login */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              ¿ya tenés una cuenta registrada?
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

export default RegisterScreen;
