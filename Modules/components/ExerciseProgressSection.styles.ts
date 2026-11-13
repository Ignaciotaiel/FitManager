// Define los estilos visuales de la sección de gráficos de progreso ExerciseProgressSection.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  card: {
    padding: 14,
    marginBottom: 14,
    borderRadius: 14
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  sectionSubtitle: {
    fontSize: 11,
    marginTop: 2
  },
  exerciseChipsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
    marginBottom: 8
  },
  exerciseChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    maxWidth: 210
  },
  exerciseChipText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  periodRow: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    marginBottom: 10,
    gap: 4
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center'
  },
  periodBtnText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  stateBox: {
    paddingVertical: 12
  },
  emptyBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 4
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17
  },
  inactivityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10
  },
  inactivityText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10
  },
  kpiBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center'
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 3
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '900'
  },
  kpiValueDate: {
    fontSize: 12,
    fontWeight: '900',
    marginVertical: 2
  },
  kpiSub: {
    fontSize: 10,
    marginTop: 2
  },
  singleRecordBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12
  },
  singleRecordTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2
  },
  singleRecordDesc: {
    fontSize: 11,
    lineHeight: 16
  },
  chartContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8
  },
  chartTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    flex: 1
  },
  deltaBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  deltaBadgeText: {
    fontSize: 10,
    fontWeight: '900'
  },
  barsArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 176,
    paddingTop: 10,
    gap: 4
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end'
  },
  barWeightLabel: {
    fontSize: 10,
    lineHeight: 12
  },
  barRepsLabel: {
    fontSize: 9,
    lineHeight: 11,
    marginBottom: 4
  },
  barTrack: {
    width: '100%',
    height: 100,
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  barFill: {
    width: '68%',
    minWidth: 12,
    maxWidth: 28,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6
  },
  barDateLabel: {
    fontSize: 9,
    marginTop: 5
  },
  barSubDateLabel: {
    fontSize: 8,
    lineHeight: 10,
    marginTop: 1
  },
  pointDetailBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
    paddingTop: 8,
    gap: 6
  },
  pointDetailText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16
  },
  pointSetsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2
  },
  pointSetChip: {
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  pointSetChipText: {
    fontSize: 10,
    fontWeight: '700'
  },
  bestMarksCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 8
  },
  bestMarksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  bestMarksHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1
  },
  bestMarksTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  bestMarksExerciseName: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 1
  },
  bestMarksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  bestMarkItem: {
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 3
  },
  bestMarkBadge: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 2
  },
  bestMarkMainValue: {
    fontSize: 14,
    fontWeight: '900'
  },
  bestMarkMetaText: {
    fontSize: 11,
    lineHeight: 15
  },
  allRecordsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8
  },
  allRecordsTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  allRecordsGrid: {
    gap: 8
  },
  recordSummaryCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4
  },
  recordSummaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  recordSummaryExName: {
    fontSize: 12,
    fontWeight: '900',
    flex: 1
  },
  recordSummaryMuscle: {
    fontSize: 10,
    fontWeight: '700'
  },
  recordSummaryDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 2
  },
  recordSummaryText: {
    fontSize: 11,
    lineHeight: 16
  }
});
