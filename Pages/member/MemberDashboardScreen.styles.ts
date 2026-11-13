// Define los estilos visuales del panel principal del socio y sus accesos rápidos.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    flex: 1
  },
  headerContainer: {
    paddingHorizontal: 16
  },
  scrollArea: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40
  },
  unreadNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 14,
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
  gridCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  unreadBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1
  },
  unreadBadgePillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  mobileNoticeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5
  },
  mobileNoticeBtnText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 4
  },
  summaryValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '900'
  },
  summaryValueSmall: {
    fontSize: 15,
    fontWeight: '800'
  },
  summarySubtext: {
    fontSize: 11,
    fontWeight: '700'
  },
  heroSection: {
    marginBottom: 20
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  heroCard: {
    padding: 16,
    borderWidth: 1.5,
    borderRadius: 14
  },
  heroCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  heroBadgeBox: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(57, 255, 20, 0.1)'
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  heroTrainerTag: {
    fontSize: 11,
    fontWeight: '700'
  },
  heroRoutineName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginBottom: 6
  },
  heroRoutineDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12
  },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14
  },
  heroMetaCol: {
    flex: 1
  },
  heroMetaColRight: {
    alignItems: 'flex-end'
  },
  heroMetaLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  heroMetaVal: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2
  },
  heroActionBtn: {
    marginTop: 2
  },
  routineCardUnified: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 14
  },
  routinesGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14
  },
  routineCardDesktop: {
    flexGrow: 1,
    flexBasis: '48%',
    minWidth: 340,
    marginBottom: 0,
    justifyContent: 'space-between'
  },
  secondarySection: {
    marginBottom: 20
  },
  secondaryCard: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 12
  },
  secondaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4
  },
  secondaryRoutineTag: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 2
  },
  secondaryRoutineName: {
    fontSize: 17,
    fontWeight: '800'
  },
  secondaryRoutineDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10
  },
  secondaryBtn: {
    marginTop: 4
  },
  quickAccessSection: {
    marginBottom: 16
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8
  },
  gridActionCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'space-between',
    minHeight: 140
  },
  gridIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  gridIcon: {
    fontSize: 18
  },
  gridCardTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  gridCardSub: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 8
  },
  gridCardFooter: {
    marginTop: 'auto',
    paddingTop: 6
  },
  gridActionLink: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  bottomSpacer: {
    height: 24
  }
});
