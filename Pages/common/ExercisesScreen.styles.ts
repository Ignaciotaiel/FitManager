// Define los estilos visuales del catálogo de ejercicios y técnicas del gimnasio.
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
  createBtn: {
    marginVertical: 4
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 36
  },
  exerciseCard: {
    padding: 12,
    marginVertical: 4
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    paddingRight: 8
  },
  difficultyBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1
  },
  difficultyText: {
    fontSize: 9,
    fontWeight: '800'
  },
  muscleGroup: {
    fontSize: 12,
    marginBottom: 2
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '800'
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
    maxHeight: '88%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16
  },
  modalScroll: {
    paddingBottom: 8
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 2
  },
  modalSubtitle: {
    fontSize: 12,
    marginBottom: 10
  },
  difficultyLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 5,
    letterSpacing: 0.5
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12
  },
  diffBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center'
  },
  diffBtnText: {
    fontSize: 10,
    fontWeight: '800'
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  modalBtn: {
    flex: 1
  }
});
