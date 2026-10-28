import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../contexto/themeContext.js';

export function LoadingSpinner({ message = 'cargando...', fullScreen = false }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? (
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fullScreen: {
    flex: 1
  },
  text: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500'
  }
});

export default LoadingSpinner;
