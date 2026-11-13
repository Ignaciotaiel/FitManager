// Define los estilos visuales de la pantalla de registro de actividad administrativa.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  listContent: { flexGrow: 1, paddingBottom: 36 },
  headerContainer: { marginBottom: 8 },
  dateSection: { marginTop: 6, marginBottom: 4 },
  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  dateSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6
  },
  clearDatesLink: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8
  },
  dateSelectorBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  dateSelectorTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  dateSelectorLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6
  },
  dateSelectorValue: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: 0.4
  },
  periodSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    gap: 8
  },
  periodSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1
  },
  periodSummaryText: {
    fontSize: 12,
    flex: 1
  },
  periodSummaryHighlight: {
    fontWeight: '800'
  },
  resultsCountBadge: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  flexBtn: { flex: 1 },
  logCard: { padding: 12, marginVertical: 4 },
  logTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionType: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  categoryTag: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  description: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  meta: { fontSize: 11, marginTop: 6 }
});
