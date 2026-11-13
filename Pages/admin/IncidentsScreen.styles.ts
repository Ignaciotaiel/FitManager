// Define los estilos visuales de la pantalla de gestión de incidencias del gimnasio.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  listContent: { flexGrow: 1, paddingBottom: 36 },
  formCard: { padding: 14, marginVertical: 6 },
  formTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 0.8, marginBottom: 4 },
  buttonRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  flexBtn: { flex: 1, paddingHorizontal: 4 },
  smallBtnText: { fontSize: 10, letterSpacing: 0.3 },
  itemCard: { padding: 12, marginVertical: 5 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  itemTitle: { fontSize: 14, fontWeight: '800', flex: 1 },
  statusTag: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  itemContent: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  meta: { fontSize: 11, marginTop: 4 },
  notes: { fontSize: 12, marginTop: 6, fontStyle: 'italic' }
});
