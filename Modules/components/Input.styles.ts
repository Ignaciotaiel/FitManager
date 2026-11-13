// Define los estilos visuales del campo de texto reutilizable Input.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    width: '100%'
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 14
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12
  },
  eyeButton: {
    paddingLeft: 8
  },
  eyeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500'
  }
});
