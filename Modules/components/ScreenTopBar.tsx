// Barra superior de navegación con título, subtítulo y botón de regreso para pantallas internas.
import React from 'react';
import { View, Text, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { useTheme } from '../../contexto/themeContext';
import { styles } from './ScreenTopBar.styles';

export interface ScreenTopBarProps {
  title: string;
  onBack: () => void;
  backLabel?: string;
}

// barra superior reutilizable (mismo diseno que UsersScreen)
export function ScreenTopBar({ title, onBack, backLabel = '← VOLVER' }: ScreenTopBarProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  // En escritorio web (>= 768px) el encabezado superior de WebContainer ya muestra el titulo y el boton Volver
  if (Platform.OS === 'web' && width >= 768) {
    return null;
  }

  return (
    <View style={[styles.topNavBar, { borderBottomColor: colors.border }]}>
      <TouchableOpacity
        onPress={onBack}
        style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
        accessibilityRole="button"
        accessibilityLabel="volver"
      >
        <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>{backLabel}</Text>
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.navBarSpacer} />
    </View>
  );
}

export default ScreenTopBar;

