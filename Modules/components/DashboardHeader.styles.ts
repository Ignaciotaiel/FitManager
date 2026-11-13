// Define los estilos visuales del encabezado superior DashboardHeader.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
    paddingBottom: 6,
    marginBottom: 8
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  avatarAndInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '900'
  },
  userTextCol: {
    flex: 1,
    justifyContent: 'center'
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 3
  },
  badge: {
    marginTop: 1
  },
  menuTriggerBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  menuTriggerDots: {
    fontSize: 18,
    fontWeight: '900'
  },
  titleSection: {
    marginTop: 16,
    marginBottom: 4
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  subtitle: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18
  },
  menuBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  menuModal: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16
  },
  menuHeader: {
    paddingBottom: 8
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  menuSub: {
    fontSize: 12,
    marginTop: 2
  },
  menuDivider: {
    height: 1,
    marginVertical: 10
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8
  },
  menuItemDanger: {
    marginTop: 4
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '700'
  }
});
