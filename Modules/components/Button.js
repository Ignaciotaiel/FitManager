import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../contexto/themeContext.js';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle
}) {
  const { colors } = useTheme();

  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isSecondary = variant === 'secondary';

  let backgroundColor = colors.primary;
  let textColor = colors.primaryText;
  let borderColor = 'transparent';

  if (isSecondary) {
    backgroundColor = 'transparent';
    textColor = colors.text;
    borderColor = colors.border;
  } else if (isDanger) {
    backgroundColor = colors.danger;
    textColor = '#ffffff';
  }

  if (disabled || loading) {
    backgroundColor = isSecondary ? 'transparent' : colors.surface;
    textColor = colors.textMuted;
    borderColor = colors.border;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.baseButton,
        {
          backgroundColor,
          borderColor,
          borderWidth: isSecondary ? 1 : 0
        },
        style
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text style={[styles.baseText, { color: textColor }, textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  baseButton: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginVertical: 4
  },
  baseText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center'
  }
});

export default Button;
