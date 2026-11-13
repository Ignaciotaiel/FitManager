// Define los estilos visuales de la pantalla de bienvenida para móvil y escritorio.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    justifyContent: 'space-between'
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  brandText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1
  },
  themeToggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  themeToggleText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  heroSection: {
    marginVertical: 'auto'
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    letterSpacing: 0.5
  },
  accentLine: {
    width: 48,
    height: 4,
    borderRadius: 2,
    marginVertical: 14
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20
  },
  featuresCard: {
    padding: 14,
    marginVertical: 0
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6
  },
  featureBullet: {
    fontSize: 14,
    fontWeight: '800',
    width: 32
  },
  featureTextWrapper: {
    flex: 1
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize'
  },
  featureSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  separator: {
    height: 1,
    marginVertical: 4
  },
  actionsSection: {
    paddingTop: 16,
    gap: 4
  },
  scrollContentDesktop: {
    paddingHorizontal: 40,
    paddingVertical: 32,
    justifyContent: 'center'
  },
  desktopGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 48,
    marginVertical: 'auto',
    paddingVertical: 20
  },
  desktopLeftCol: {
    flex: 1.25
  },
  desktopRightCol: {
    flex: 0.95,
    maxWidth: 460
  },
  desktopTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14
  },
  desktopTagText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  desktopTitle: {
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 44,
    letterSpacing: 0.6
  },
  desktopDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24
  },
  accessCard: {
    padding: 28,
    borderRadius: 18
  },
  accessIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  accessTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  accessSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 20
  },
  desktopActionsBox: {
    gap: 6
  },
  accessFooterNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 22,
    paddingTop: 14,
    borderTopWidth: 1
  },
  accessFooterText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1
  }
});
