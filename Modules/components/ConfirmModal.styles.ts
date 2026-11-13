// Define los estilos visuales del cuadro de diálogo de confirmación ConfirmModal.
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20
  },
  actions: {
    flexDirection: 'row',
    gap: 12
  },
  actionBtn: {
    flex: 1,
    marginVertical: 0
  }
});
