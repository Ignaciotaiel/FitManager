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

export function RegisterScreen({ navigation }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { login } = useAuth();

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

      if (response?.ok && response?.data?.token) {
        setSuccessMessage('cuenta creada exitosamente. ingresando...');
        // el backend devuelve el token del usuario con rol 'member' asignado por defecto
        setTimeout(async () => {
          await login(response.data.token, response.data.user);
        }, 800);
      } else {
        setErrorMessage(response?.error?.message || 'no fue posible completar el registro');
      }
    } catch (error) {
      if (error.status === 409 || error.code === 'EMAIL_ALREADY_EXISTS') {
        setErrorMessage('el correo electronico ya esta registrado. intenta iniciar sesion');
      } else if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT_ERROR') {
        setErrorMessage('no se pudo conectar con el servidor. verifica que el backend este activo');
      } else {
        setErrorMessage(error.message || 'error inesperado al registrar usuario');
      }
    } finally {
      setLoading(false);
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
                  placeholder="ej. juan perez"
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
                required: 'la contrasena es obligatoria',
                minLength: {
                  value: 6,
                  message: 'la contrasena debe tener al menos 6 caracteres'
                }
              }}
              render={({ field: { onChange, value } }) => (
                <Input
                  label="contrasena (min. 6 caracteres)"
                  placeholder="crea tu contrasena"
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
                required: 'confirma tu contrasena',
                validate: (value) =>
                  value === passwordValue || 'las contrasenas no coinciden'
              }}
              render={({ field: { onChange, value } }) => (
                <Input
                  label="confirmar contrasena"
                  placeholder="repite tu contrasena"
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
              ¿ya tenes una cuenta registrada?
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={[styles.footerLink, { color: colors.primary }]}>
                inicia sesion
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

export default RegisterScreen;
