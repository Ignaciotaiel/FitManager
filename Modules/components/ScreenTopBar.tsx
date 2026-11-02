import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexto/themeContext';

export interface ScreenTopBarProps {
  title: string;
  onBack: () => void;
  backLabel?: string;
}

// barra superior reutilizable (mismo diseno que UsersScreen)
export function ScreenTopBar({ title, onBack, backLabel = '← VOLVER' }: ScreenTopBarProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.topNavBar}>
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

const styles = StyleSheet.create({
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)'
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  navBarSpacer: {
    width: 70
  }
});

export default ScreenTopBar;

