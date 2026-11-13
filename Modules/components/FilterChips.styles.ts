// Define los estilos visuales de la barra de filtros horizontales FilterChips.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 4
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 5,
    textTransform: 'uppercase'
  },
  row: {
    flexDirection: 'row',
    gap: 6
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4
  }
});
