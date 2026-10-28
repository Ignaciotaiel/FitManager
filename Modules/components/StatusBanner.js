import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexto/themeContext.js';

export function StatusBanner({ message, type = 'error', style }) {
  const { colors } = useTheme();

  if (!message) return null;

  const isSuccess = type === 'success';
  const isWarning = type === 'warning';

  let backgroundColor = colors.dangerSurface;
  let borderColor = colors.danger;
  let textColor = colors.danger;

  if (isSuccess) {
    backgroundColor = 'rgba(16, 185, 129, 0.15)';
    borderColor = colors.success;
    textColor = colors.success;
  } else if (isWarning) {
    backgroundColor = 'rgba(245, 158, 11, 0.15)';
    borderColor = colors.warning;
    textColor = colors.warning;
  }

  return (
    <View style={[styles.banner, { backgroundColor, borderColor }, style]}>
      <Text style={[styles.text, { color: textColor }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginVertical: 8,
    width: '100%'
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18
  }
});

export default StatusBanner;
