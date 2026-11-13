// Define los estilos visuales de la barra lateral, cabecera y contenedor de escritorio WebContainer.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  publicRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  publicInner: {
    flex: 1,
    width: '100%'
  },
  desktopRoot: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    height: '100%'
  },
  sidebar: {
    borderRightWidth: 1,
    justifyContent: 'space-between',
    paddingVertical: 14
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1
  },
  brandHeaderCompact: {
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  brandLogoBox: {
    width: 40,
    height: 40,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandTextCol: {
    flex: 1
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  proPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5
  },
  proPillText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 2
  },
  navScroll: {
    flex: 1
  },
  navScrollContent: {
    paddingVertical: 12,
    paddingHorizontal: 10
  },
  navGroup: {
    marginBottom: 14
  },
  navGroupLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
    paddingHorizontal: 10,
    marginBottom: 6
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    marginVertical: 2,
    position: 'relative'
  },
  navItemCompact: {
    justifyContent: 'center',
    paddingHorizontal: 0
  },
  navActiveBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2
  },
  navItemText: {
    fontSize: 13,
    letterSpacing: 0.2,
    flex: 1
  },
  navUnreadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9,
    borderWidth: 1
  },
  navUnreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  navUnreadCountText: {
    fontSize: 10,
    fontWeight: '900'
  },
  navUnreadCompactDot: {
    position: 'absolute',
    top: 8,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4
  },
  sidebarFooter: {
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 12,
    gap: 8
  },
  footerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1
  },
  footerActionBtnCompact: {
    justifyContent: 'center',
    paddingHorizontal: 0
  },
  footerActionText: {
    fontSize: 12,
    fontWeight: '700'
  },
  userCardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  userAvatarText: {
    fontSize: 14,
    fontWeight: '900'
  },
  userMetaCol: {
    flex: 1
  },
  userNameText: {
    fontSize: 12,
    fontWeight: '800'
  },
  userEmailText: {
    fontSize: 10,
    marginTop: 1
  },
  footerBottomRow: {
    flexDirection: 'row',
    gap: 6
  },
  exitSmallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1
  },
  exitSmallText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  logoutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1
  },
  logoutBtnText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  mainColumn: {
    flex: 1,
    height: '100%'
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 16
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  topBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1
  },
  topBackBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  topTitleCol: {
    flex: 1
  },
  topHeaderTitle: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  topHeaderSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  topIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  contentViewport: {
    flex: 1,
    alignItems: 'center'
  },
  contentInner: {
    flex: 1,
    width: '100%'
  }
});
