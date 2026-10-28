import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexto/themeContext.js';

export function RoleBadge({ role, style }) {
  const { colors } = useTheme();

  const roleConfigs = {
    admin: { label: 'ADMINISTRADOR', bg: 'rgba(239, 68, 68, 0.15)', text: colors.danger, border: colors.danger },
    trainer: { label: 'ENTRENADOR', bg: 'rgba(59, 130, 246, 0.15)', text: colors.info, border: colors.info },
    member: { label: 'SOCIO', bg: 'rgba(57, 255, 20, 0.15)', text: colors.primary, border: colors.primary }
  };

  const config = roleConfigs[role] || {
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

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start'
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8
  }
});

export default RoleBadge;
