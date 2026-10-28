import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexto/themeContext.js';
import Button from './Button.js';

export function EmptyState({
  title = 'no hay elementos',
  description = 'no se encontraron registros disponibles en este momento',
  actionTitle,
  onAction,
  style
}) {
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

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center'
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280
  },
  button: {
    marginTop: 16
  }
});

export default EmptyState;
