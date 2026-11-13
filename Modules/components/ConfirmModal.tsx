// Cuadro de diálogo modal para confirmar acciones críticas o destructivas.
import React from 'react';
import { Modal, View, Text, TouchableWithoutFeedback } from 'react-native';
import { useTheme } from '../../contexto/themeContext';
import Button from './Button';
import { styles } from './ConfirmModal.styles';

export interface ConfirmModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
  loading?: boolean;
}

// Renderiza un modal de confirmación con botones de acción principal y cancelación.
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
}: ConfirmModalProps) {
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

export default ConfirmModal;

