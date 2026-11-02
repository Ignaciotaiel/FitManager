import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../contexto/themeContext';

export interface ChipOption<T extends string | number | null> {
  value: T;
  label: string;
}

export interface FilterChipsProps<T extends string | number | null> {
  label?: string;
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

// selector horizontal de opciones (filtros y formularios)
export function FilterChips<T extends string | number | null>({
  label,
  options,
  value,
  onChange
}: FilterChipsProps<T>) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <TouchableOpacity
              key={String(opt.value)}
              onPress={() => onChange(opt.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? 'rgba(57, 255, 20, 0.12)' : colors.surface
                }
              ]}
            >
              <Text style={[styles.chipText, { color: selected ? colors.primary : colors.textSecondary }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 4
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 5,
    textTransform: 'uppercase'
  },
  row: {
    flexDirection: 'row',
    gap: 6
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4
  }
});

export default FilterChips;

