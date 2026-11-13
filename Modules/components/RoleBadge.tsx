// Insignia visual que identifica el rol del usuario (Administrador, Entrenador o Socio).
import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../contexto/themeContext';
import { withAlpha } from '../../Styles/theme/colors';
import { UserRole } from '../types';
import { styles } from './RoleBadge.styles';

export interface RoleBadgeProps {
  role?: UserRole | string | null;
  style?: StyleProp<ViewStyle>;
}

// Renderiza una etiqueta coloreada según el rol del usuario.
export function RoleBadge({ role, style }: RoleBadgeProps) {
  const { colors } = useTheme();

  const roleConfigs: Record<string, { label: string; bg: string; text: string; border: string }> = {
    admin: { label: 'ADMINISTRADOR', bg: withAlpha(colors.danger, 0.15), text: colors.danger, border: colors.danger },
    trainer: { label: 'ENTRENADOR', bg: withAlpha(colors.info, 0.15), text: colors.info, border: colors.info },
    member: { label: 'SOCIO', bg: withAlpha(colors.primary, 0.15), text: colors.primary, border: colors.primary }
  };

  const config = (role ? roleConfigs[role] : null) || {
    label: (role || 'DESCONOCIDO').toUpperCase(),
    bg: colors.surface,
    text: colors.textMuted,
    border: colors.border
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border
        },
        style
      ]}
    >
      <Text style={[styles.text, { color: config.text }]}>
        {config.label}
      </Text>
    </View>
  );
}

export default RoleBadge;

