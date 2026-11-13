// Define los estilos visuales de la pantalla de administración de usuarios y roles.
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
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  searchInput: {
    marginVertical: 4
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 36
  },
  userCard: {
    padding: 12,
    marginVertical: 4
  },
  userCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  userInfo: {
    flex: 1,
    paddingRight: 8
  },
  userName: {
    fontSize: 14,
    fontWeight: '800'
  },
  userEmail: {
    fontSize: 12,
    marginTop: 1
  },
  roleSelectorSection: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  roleSelectorLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 5
  },
  roleChipsRow: {
    flexDirection: 'row',
    gap: 6
  },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1
  },
  roleChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  divider: {
    height: 1,
    marginVertical: 8
  },
  userCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800'
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '800'
  }
});
