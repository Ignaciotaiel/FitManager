// Barra horizontal de filtros seleccionables tipo píldora.
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../contexto/themeContext';
import { withAlpha } from '../../Styles/theme/colors';
import { styles } from './FilterChips.styles';

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
                  backgroundColor: selected ? withAlpha(colors.primary, 0.14) : colors.surface
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

export default FilterChips;

