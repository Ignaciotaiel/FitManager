// Define los estilos visuales de la pantalla de historial y sesiones de entrenamiento.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    flex: 1,
    paddingHorizontal: 16
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4
  },
  backBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  listContent: {
    paddingBottom: 32
  },
  filterCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  filterHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  toggleFilterBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1
  },
  toggleFilterText: {
    fontSize: 10,
    fontWeight: '800'
  },
  filterInputsContainer: {
    marginTop: 10,
    gap: 6
  },
  dateFilterSection: {
    marginTop: 4
  },
  dateFilterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  dateFilterLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  clearDatesText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  dateButtonsRow: {
    flexDirection: 'row',
    gap: 8
  },
  dateBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  dateBtnTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  dateBtnCaption: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  dateBtnValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3
  },
  periodActiveText: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 6
  },
  clearFiltersBtn: {
    marginTop: 6
  },
  modalDuration: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2
  },
  sessionCard: {
    marginBottom: 14,
    padding: 16,
    borderWidth: 1
  },
  sessionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  sessionDate: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4
  },
  routineTitle: {
    fontSize: 18,
    fontWeight: '800'
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  statsRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12
  },
  statBox: {
    flex: 1
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2
  },
  statVal: {
    fontSize: 14,
    fontWeight: '700'
  },
  exerciseTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14
  },
  tag: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600'
  },
  detailBtn: {
    marginTop: 4
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 16
  },
  modalCard: {
    maxHeight: '85%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 18
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingBottom: 12,
    marginBottom: 14
  },
  modalDate: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800'
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '700'
  },
  modalScroll: {
    maxHeight: '75%'
  },
  notesBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2
  },
  notesText: {
    fontSize: 13,
    lineHeight: 18
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 10
  },
  noSetsText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginVertical: 12
  },
  exerciseGroupCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    paddingBottom: 6
  },
  groupExName: {
    fontSize: 15,
    fontWeight: '800'
  },
  groupMuscle: {
    fontSize: 12,
    fontWeight: '600'
  },
  setsTable: {
    gap: 6
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  setNumBadge: {
    fontSize: 13,
    fontWeight: '800',
    width: 40
  },
  setKgText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1
  },
  setRepsText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center'
  },
  setRpeText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    width: 60
  }
});
