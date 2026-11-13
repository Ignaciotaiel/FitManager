// Define los estilos visuales de la pantalla de registro de nuevos socios.
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
    marginBottom: 12
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
    marginBottom: 10
  },
  brandLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2
  },
  formCard: {
    marginTop: 4,
    padding: 14
  },
  submitBtn: {
    marginTop: 8
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
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
