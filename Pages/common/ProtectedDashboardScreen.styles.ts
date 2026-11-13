// Define los estilos visuales de la pantalla base de sesión autenticada.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingVertical: 18,
    justifyContent: 'space-between'
  },
  header: {
    marginTop: 10
  },
  brandTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 8
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1
  },
  roleText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  infoCard: {
    padding: 18
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12
  },
  cardCaption: {
    fontSize: 12,
    marginTop: 4
  },
  actions: {
    paddingBottom: 10
  }
});
