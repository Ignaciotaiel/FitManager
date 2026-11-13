// Tarjeta informativa para secciones en preparación o avisos de disponibilidad.
import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../contexto/themeContext';
import Card from './Card';
import { styles } from './FeaturePlaceholder.styles';

// Renderiza un bloque informativo con insignia para funcionalidades o avisos.
export function FeaturePlaceholder({ title, description, badge = 'PRÓXIMAMENTE', style }: { title: string; description?: string; badge?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();

  return (
    <Card style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <View style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.badgeText, { color: colors.warning }]}>{badge}</Text>
        </View>
      </View>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {description}
      </Text>
    </Card>
  );
}

export default FeaturePlaceholder;
