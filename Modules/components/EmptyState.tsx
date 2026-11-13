// Componente visual para informar listados sin resultados y ofrecer acciones rápidas.
import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../contexto/themeContext';
import Button from './Button';
import { styles } from './EmptyState.styles';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  actionTitle?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

// Renderiza un mensaje centrado cuando una lista no contiene registros para mostrar.
export function EmptyState({
  title = 'no hay elementos',
  description = 'no se encontraron registros disponibles en este momento',
  actionTitle,
  onAction,
  style
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {description}
      </Text>

      {actionTitle && onAction ? (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="secondary"
          style={styles.button}
        />
      ) : null}
    </View>
  );
}

export default EmptyState;
