// Banner de notificación para mostrar mensajes de error, éxito o advertencia.
import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../contexto/themeContext';
import { styles } from './StatusBanner.styles';

export interface StatusBannerProps {
  message?: string | null;
  type?: 'error' | 'success' | 'warning';
  style?: StyleProp<ViewStyle>;
}

// Renderiza un aviso destacado de error, éxito o advertencia.
export function StatusBanner({ message, type = 'error', style }: StatusBannerProps) {
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

export default StatusBanner;
