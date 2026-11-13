// Define los estilos visuales del indicador de listado vacío EmptyState.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center'
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280
  },
  button: {
    marginTop: 16
  }
});
