// Define los estilos visuales del contenedor de carga del navegador principal.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1
  },
  safeArea: {
    flex: 1
  },
  unknownRoleContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  unknownRoleCard: {
    width: '100%',
    padding: 20
  },
  unknownTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8
  },
  unknownBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16
  }
});
