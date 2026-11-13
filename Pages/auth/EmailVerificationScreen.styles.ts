// Define los estilos visuales de la pantalla de verificación de correo electrónico.
import { StyleSheet, Platform } from 'react-native';

export const styles = StyleSheet.create({
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
    justifyContent: 'center',
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center'
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
