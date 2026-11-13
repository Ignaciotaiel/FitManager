// Define los estilos visuales de la bandeja de avisos del gimnasio para entrenadores y socios.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8
  },
  summaryBannerText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 36
  },
  itemCard: {
    padding: 14,
    marginVertical: 5,
    borderRadius: 12,
    borderWidth: 1
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '900',
    flex: 1
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  itemContent: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 19
  },
  itemFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10
  },
  meta: {
    fontSize: 11,
    fontWeight: '600'
  },
  audienceTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4
  }
});
