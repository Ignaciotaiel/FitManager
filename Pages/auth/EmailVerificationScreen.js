import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexto/themeContext.js';
import { authService } from '../../Modules/auth/authService.js';
import { Button, Card, StatusBanner } from '../../Modules/components/index.js';

export function EmailVerificationScreen({ route, navigation }) {
  const { colors } = useTheme();
  const initialEmail = route?.params?.email || '';

  const [email] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [countdown, setCountdown] = useState(60);

  // Temporizador para el botón de reenvío (cooldown de 60 segundos)
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Verificar código de 6 dígitos
  const handleVerify = async () => {
    const cleanCode = code.trim();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setErrorMessage('Ingresá el código numérico completo de 6 dígitos');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.verifyEmail(email, cleanCode);
      if (response?.ok) {
        setSuccessMessage('¡Correo verificado con éxito! Redirigiendo al inicio de sesión...');
        setTimeout(() => {
          navigation.navigate('Login', { verifiedEmail: email });
        }, 1200);
      } else {
        setErrorMessage(response?.error?.message || 'El código ingresado es incorrecto');
      }
    } catch (error) {
      if (error?.status === 400) {
        if (error.code === 'INVALID_CODE') {
          setErrorMessage(error.message || 'Código incorrecto. Verificá los números ingresados.');
        } else if (error.code === 'CODE_EXPIRED') {
          setErrorMessage('El código ha expirado. Solicitá uno nuevo.');
        } else if (error.code === 'MAX_ATTEMPTS_EXCEEDED') {
          setErrorMessage('Superaste el límite de 5 intentos. Solicitá un nuevo código.');
        } else if (error.code === 'CODE_ALREADY_USED') {
          setErrorMessage('Este código ya fue utilizado. Solicitá un nuevo código.');
        } else {
          setErrorMessage(error.message || 'No fue posible validar el código');
        }
      } else {
        setErrorMessage(error.message || 'Error de conexión. Verificá tu red y volvé a intentar.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Reenviar código respetando cooldown
  const handleResend = async () => {
    if (countdown > 0 || resending) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setResending(true);

    try {
      const response = await authService.resendVerification(email);
      if (response?.ok) {
        setSuccessMessage('Te enviamos un nuevo código a tu correo electrónico.');
        setCode('');
        setCountdown(60);
      } else {
        setErrorMessage(response?.error?.message || 'No fue posible reenviar el código');
      }
    } catch (error) {
      if (error?.status === 429) {
        setErrorMessage(error.message || 'Por favor aguardá unos segundos antes de solicitar otro código');
      } else {
        setErrorMessage(error.message || 'Error al reenviar el código. Intentá más tarde.');
      }
    } finally {
      setResending(false);
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
          {/* Header y botón volver */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={[styles.backButton, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Volver al inicio de sesión"
            >
              <Text style={[styles.backText, { color: colors.textSecondary }]}>‹ Volver al login</Text>
            </TouchableOpacity>
          </View>

          {/* Tarjeta de Verificación */}
          <Card style={styles.card}>
            <View style={styles.iconContainer}>
              <Text style={styles.iconEmoji}>✉️</Text>
            </View>

            <Text style={[styles.title, { color: colors.text }]}>Verificá tu correo</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Enviamos un código de 6 dígitos a:
            </Text>
            <Text style={[styles.emailBadge, { color: colors.primary }]}>{email}</Text>

            {/* Banners informativos */}
            {errorMessage && (
              <StatusBanner
                type="error"
                message={errorMessage}
                style={styles.banner}
              />
            )}
            {successMessage && (
              <StatusBanner
                type="success"
                message={successMessage}
                style={styles.banner}
              />
            )}

            {/* Input del código de 6 dígitos */}
            <View style={styles.codeContainer}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                CÓDIGO DE VERIFICACIÓN (6 DÍGITOS)
              </Text>
              <TextInput
                value={code}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, '').slice(0, 6);
                  setCode(cleaned);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="000000"
                placeholderTextColor={colors.textSecondary + '60'}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                style={[
                  styles.codeInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.surface,
                    borderColor: colors.border
                  }
                ]}
              />
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                El código expira en 10 minutos (máx. 5 intentos).
              </Text>
            </View>

            {/* Botón de verificación */}
            <Button
              title="Verificar y continuar"
              onPress={handleVerify}
              loading={loading}
              disabled={loading || code.trim().length !== 6}
              style={styles.verifyButton}
            />

            {/* Reenvío con cooldown */}
            <View style={styles.resendContainer}>
              <Text style={[styles.resendText, { color: colors.textSecondary }]}>
                ¿No recibiste el código?{' '}
              </Text>
              <TouchableOpacity
                onPress={handleResend}
                disabled={countdown > 0 || resending}
              >
                {resending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text
                    style={[
                      styles.resendLink,
                      {
                        color: countdown > 0 ? colors.textSecondary : colors.primary,
                        opacity: countdown > 0 ? 0.6 : 1
                      }
                    ]}
                  >
                    {countdown > 0 ? `Reenviar en ${countdown}s` : 'Reenviar código'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Card>
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'center'
  },
  header: {
    marginBottom: 16
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  backText: {
    fontSize: 14,
    fontWeight: '600'
  },
  card: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center'
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  iconEmoji: {
    fontSize: 30
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center'
  },
  emailBadge: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 20,
    textAlign: 'center'
  },
  banner: {
    width: '100%',
    marginBottom: 16
  },
  codeContainer: {
    width: '100%',
    marginBottom: 20
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center'
  },
  codeInput: {
    height: 60,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 10,
    textAlign: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  helperText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8
  },
  verifyButton: {
    width: '100%',
    marginBottom: 16
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  resendText: {
    fontSize: 14
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '700'
  }
});

export default EmailVerificationScreen;
