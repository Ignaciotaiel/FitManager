import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { useTheme } from '../../contexto/themeContext.js';
import Button from './Button.js';

export function ConfirmModal({
  visible,
  title = 'confirmar accion',
  message,
  confirmText = 'confirmar',
  cancelText = 'cancelar',
  onConfirm,
  onCancel,
  isDestructive = false,
  loading = false
}) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border
                }
              ]}
            >
              <Text style={[styles.title, { color: colors.text }]}>
                {title}
              </Text>

              {message ? (
                <Text style={[styles.message, { color: colors.textSecondary }]}>
                  {message}
                </Text>
              ) : null}

              <View style={styles.actions}>
                <Button
                  title={cancelText}
                  variant="secondary"
                  onPress={onCancel}
                  disabled={loading}
                  style={styles.actionBtn}
                />
                <Button
                  title={confirmText}
                  variant={isDestructive ? 'danger' : 'primary'}
                  onPress={onConfirm}
                  loading={loading}
                  style={styles.actionBtn}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
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
    justifyContent: 'flex-end',
    gap: 12
  },
  actionBtn: {
    flex: 1,
    marginVertical: 0
  }
});

export default ConfirmModal;
