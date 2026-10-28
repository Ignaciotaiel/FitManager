import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../contexto/themeContext.js';

export function Card({ children, surface = false, style, ...rest }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.cardBase,
        {
          backgroundColor: surface ? colors.surface : colors.card,
          borderColor: colors.border
        },
        style
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  cardBase: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginVertical: 8
  }
});

export default Card;
