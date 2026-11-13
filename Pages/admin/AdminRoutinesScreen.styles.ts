// Define los estilos visuales de la pantalla de supervisión administrativa de rutinas.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    flex: 1
  },
  bannerWrap: {
    paddingHorizontal: 16,
    paddingTop: 8
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36
  },
  headerBlock: {
    marginBottom: 8
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  summaryBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center'
  },
  summaryNum: {
    fontSize: 20,
    fontWeight: '900'
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginTop: 2,
    textAlign: 'center'
  },
  filterCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 6
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2
  },
  clearFiltersBtn: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingVertical: 4
  },
  clearFiltersText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  routineCard: {
    padding: 15,
    borderRadius: 14,
    marginVertical: 6
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8
  },
  trainerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1
  },
  trainerBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  dateText: {
    fontSize: 11,
    fontWeight: '700'
  },
  routineTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.2
  },
  routineDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 10
  },
  metaCol: {
    flex: 1
  },
  metaColRight: {
    alignItems: 'flex-end'
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2
  },
  membersSection: {
    marginTop: 10
  },
  membersTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  membersChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: '100%'
  },
  memberChipName: {
    fontSize: 11,
    fontWeight: '700'
  },
  inspectBtn: {
    marginTop: 12
  }
});
