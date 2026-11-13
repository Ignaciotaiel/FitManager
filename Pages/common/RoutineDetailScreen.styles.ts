// Define los estilos visuales del detalle de rutina, series en vivo y cronómetro de descanso.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  navBarSpacer: {
    width: 70
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36
  },
  routineCard: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 14
  },
  routineHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  routineBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  heroPlanTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1
  },
  heroPlanTagText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  trainerNameTag: {
    fontSize: 11,
    fontWeight: '700'
  },
  routineName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.2
  },
  routineDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 10
  },
  planStatsBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginVertical: 6
  },
  planStatCol: {
    flex: 1
  },
  planStatColCenter: {
    flex: 1,
    alignItems: 'center'
  },
  planStatColRight: {
    flex: 1,
    alignItems: 'flex-end'
  },
  planStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  planStatVal: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    gap: 6
  },
  membersLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  memberNamesText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1
  },
  sessionControlBox: {
    marginTop: 8
  },
  activeSessionBadge: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6
  },
  sessionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  activeSessionTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  timerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 'auto'
  },
  timerText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  sectionTitleRow: {
    marginTop: 4,
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  exerciseItemCard: {
    padding: 14,
    marginVertical: 5,
    borderRadius: 12
  },
  guideBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
    marginBottom: 8
  },
  guideBoxTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 4
  },
  guideBoxText: {
    fontSize: 12,
    lineHeight: 17
  },
  bottomSpacer: {
    height: 20
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6
  },
  posBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6
  },
  posText: {
    fontSize: 13,
    fontWeight: '900'
  },
  exerciseTitle: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1
  },
  paramRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'wrap'
  },
  paramBox: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center'
  },
  paramLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  paramValue: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 1
  },
  completedSetsSection: {
    marginVertical: 4,
    paddingTop: 2
  },
  completedSetsTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 3
  },
  completedSetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4
  },
  setChip: {
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  setChipText: {
    fontSize: 11
  },
  setChipActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  setActionButton: {
    padding: 2
  },
  setActionIcon: {
    fontSize: 11,
    fontWeight: '800'
  },
  logSetBtn: {
    marginVertical: 4
  },
  exerciseTech: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3
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
    borderRadius: 16,
    borderWidth: 1,
    padding: 16
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900'
  },
  modalSubtitle: {
    fontSize: 12,
    marginBottom: 10
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10
  },
  modalBtn: {
    flex: 1
  }
});
