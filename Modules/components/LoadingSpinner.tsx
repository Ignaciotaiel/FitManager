// Indicador visual de carga para operaciones asíncronas.
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useTheme } from '../../contexto/themeContext';
import { styles } from './LoadingSpinner.styles';

export interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
}

// Renderiza un indicador giratorio de carga acompañado de un mensaje descriptivo.
export function LoadingSpinner({ message = 'cargando...', fullScreen = false }: LoadingSpinnerProps) {
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

export default LoadingSpinner;
