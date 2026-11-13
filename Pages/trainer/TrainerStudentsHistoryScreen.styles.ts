// Define los estilos visuales del listado de alumnos asignados al entrenador.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    flex: 1,
    paddingHorizontal: 16
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4
  },
  backBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  searchBox: {
    marginBottom: 12
  },
  listContent: {
    paddingBottom: 32
  },
  memberCard: {
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderRadius: 12
  },
  memberInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '900'
  },
  nameContainer: {
    flex: 1
  },
  memberName: {
    fontSize: 16,
    fontWeight: '800'
  },
  memberEmail: {
    fontSize: 12,
    marginTop: 2
  },
  historyBtn: {
    marginTop: 4
  }
});
