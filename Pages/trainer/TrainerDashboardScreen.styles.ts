// Define los estilos visuales del panel principal del entrenador y editor de rutinas.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  unreadNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 10,
    gap: 12
  },
  unreadNoticeTextCol: {
    flex: 1
  },
  unreadNoticeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  unreadNoticeTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  unreadNoticeSubtitle: {
    fontSize: 12,
    lineHeight: 16
  },
  unreadNoticeActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1
  },
  unreadNoticeActionText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  noticeAccessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5
  },
  noticeAccessBtnText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  unreadBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1
  },
  unreadBadgePillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  metricBox: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center'
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 2,
    textAlign: 'center'
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: '900'
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4
  },
  halfBtn: {
    flex: 1
  },
  desktopToolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 8
  },
  desktopToolbarBtn: {
    flex: 1,
    minWidth: 200
  },
  routineColumnsWrapper: {
    gap: 14
  },
  routineCardDesktop: {
    flex: 1,
    justifyContent: 'space-between'
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 6
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1
  },
  countText: {
    fontSize: 11,
    fontWeight: '800'
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 36
  },
  routineCard: {
    padding: 14,
    marginVertical: 5,
    borderRadius: 12
  },
  routineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4
  },
  routineBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  routineTag: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  assignedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1
  },
  assignedBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  routineTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.2
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 2
  },
  smallBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1
  },
  smallBtnText: {
    fontSize: 10,
    fontWeight: '800'
  },
  routineDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6
  },
  assignedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    gap: 6
  },
  assignedBarLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  assignedBarNames: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1
  },
  detailBtn: {
    marginTop: 2
  },
  trainerQuickTipsCard: {
    marginTop: 14,
    marginBottom: 10
  },
  quickTipBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1
  },
  quickTipTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 4
  },
  quickTipDesc: {
    fontSize: 12,
    lineHeight: 17
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContainer: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16
  },
  modalScroll: {
    paddingBottom: 8
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 2
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: 12
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  placeholderText: {
    fontSize: 12,
    padding: 10
  },
  assignmentSection: {
    marginVertical: 10
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  clearText: {
    fontSize: 10,
    fontWeight: '800'
  },
  memberPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 4,
    gap: 10
  },
  memberPickerTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10
  },
  memberPickerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  memberPickerTriggerTitle: {
    fontSize: 13,
    fontWeight: '800'
  },
  memberPickerTriggerSub: {
    fontSize: 11,
    marginTop: 2
  },
  selectedMembersChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden'
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: '100%'
  },
  memberChipText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1
  },
  exerciseSelectorSection: {
    marginVertical: 10
  },
  selectedItemBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginVertical: 6
  },
  selectedItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  itemActionsRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  reorderBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  reorderText: {
    fontSize: 14,
    fontWeight: '800'
  },
  selectedItemName: {
    fontSize: 14,
    fontWeight: '800'
  },
  removeText: {
    fontSize: 11,
    fontWeight: '800'
  },
  paramInputsRow: {
    flexDirection: 'row',
    gap: 8
  },
  paramInputWrapper: {
    flex: 1
  },
  paramInputLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2
  },
  libraryPicker: {
    gap: 6,
    marginTop: 6
  },
  pickItemBtn: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1
  },
  pickItemText: {
    fontSize: 13,
    fontWeight: '700'
  },
  pickItemSub: {
    fontSize: 11,
    marginTop: 2
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14
  },
  modalBtn: {
    flex: 1
  }
});
