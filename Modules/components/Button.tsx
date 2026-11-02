import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle
} from 'react-native';
import { useTheme } from '../../contexto/themeContext';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle
}: ButtonProps) {
  const { colors } = useTheme();

  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';

  let backgroundColor = colors.primary;
  let textColor = colors.primaryText;
  let borderColor = 'transparent';

  if (isSecondary) {
    backgroundColor = 'transparent';
    textColor = colors.text;
    borderColor = colors.border;
  } else if (isOutline) {
    backgroundColor = 'transparent';
    textColor = colors.primary;
    borderColor = colors.primary;
  } else if (isDanger) {
    backgroundColor = colors.danger;
    textColor = '#ffffff';
  }

  if (disabled || loading) {
    backgroundColor = isSecondary || isOutline ? 'transparent' : colors.surface;
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
          borderWidth: isSecondary || isOutline ? 1 : 0
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

