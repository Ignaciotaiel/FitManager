import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexto/themeContext.js';
import Card from './Card.js';

export function FeaturePlaceholder({ title, description, badge = 'PRÓXIMAMENTE', style }) {
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

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginVertical: 6
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 8
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  description: {
    fontSize: 13,
    lineHeight: 18
  }
});

export default FeaturePlaceholder;
