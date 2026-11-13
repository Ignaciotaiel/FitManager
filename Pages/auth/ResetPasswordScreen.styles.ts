// Define los estilos visuales de la pantalla de restablecimiento de contraseña.
import { StyleSheet, Platform } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  keyboardContainer: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 28 : 10,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center'
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
    borderWidth: 1
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
