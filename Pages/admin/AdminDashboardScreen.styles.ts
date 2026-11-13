// Define los estilos visuales del panel principal de administración y sus grillas adaptables.
import { StyleSheet, Platform } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'web' ? 16 : 8,
    paddingBottom: 32
  },
  cardsGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14
  },
  toolCardDesktop: {
    flexGrow: 1,
    flexBasis: '48%',
    minWidth: 320,
    marginVertical: 0,
    justifyContent: 'space-between'
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8
  },
  areaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1
  },
  areaBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7
  },
  notificationsQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1
  },
  notificationsQuickText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  quickCountPill: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  quickCountText: {
    fontSize: 10,
    fontWeight: '900'
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  sectionHint: {
    fontSize: 11,
    fontWeight: '700'
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8
  },
  kpiCard: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    marginVertical: 2
  },
  kpiIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  kpiNumber: {
    fontSize: 22,
    fontWeight: '900'
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 3,
    textAlign: 'center'
  },
  kpiSecondaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  secondaryKpiCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10
  },
  secondaryKpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryKpiTextCol: {
    flex: 1
  },
  secondaryKpiNumber: {
    fontSize: 18,
    fontWeight: '900'
  },
  secondaryKpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginTop: 1
  },
  toolCard: {
    padding: 15,
    marginVertical: 6,
    borderRadius: 14
  },
  toolTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10
  },
  toolIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  toolInfoCol: {
    flex: 1
  },
  toolTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2
  },
  toolDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3
  }
});
