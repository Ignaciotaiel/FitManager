// Define los estilos visuales del calendario interactivo DateRangeCalendarModal.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '92%',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  scrollContent: {
    paddingBottom: 4
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rangeTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10
  },
  rangeTab: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  rangeTabTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  rangeTabLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  rangeTabValue: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: 0.4
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10
  },
  presetChip: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center'
  },
  presetChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 8
  },
  monthArrowBtn: {
    padding: 6
  },
  monthTitleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1
  },
  monthTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  yearMonthPickerBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10
  },
  yearHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  pickerSectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  yearPageControls: {
    flexDirection: 'row',
    gap: 6
  },
  yearPageBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  pickerCell: {
    width: '23%',
    flexGrow: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pickerCellText: {
    fontSize: 12,
    letterSpacing: 0.4
  },
  backToDaysBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1
  },
  backToDaysText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 4
  },
  weekdayCell: {
    width: '14.2857%',
    alignItems: 'center',
    paddingVertical: 4
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '800'
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10
  },
  dayCell: {
    width: '14.2857%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1
  },
  dayText: {
    fontSize: 13
  },
  periodBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8
  },
  periodBannerText: {
    fontSize: 12,
    flex: 1
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  actionBtn: {
    flex: 1
  }
});
