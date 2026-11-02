import React, { ReactNode } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, ViewProps } from 'react-native';
import { useTheme } from '../../contexto/themeContext';

export interface CardProps extends ViewProps {
  children?: ReactNode;
  surface?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, surface = false, style, ...rest }: CardProps) {
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
    padding: 14,
    borderWidth: 1,
    marginVertical: 5
  }
});

export default Card;

