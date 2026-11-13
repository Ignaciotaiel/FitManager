// Contenedor visual con bordes redondeados y colores adaptados al tema activo.
import React, { ReactNode } from 'react';
import { View, StyleProp, ViewStyle, ViewProps } from 'react-native';
import { useTheme } from '../../contexto/themeContext';
import { styles } from './Card.styles';

export interface CardProps extends ViewProps {
  children?: ReactNode;
  surface?: boolean;
  style?: StyleProp<ViewStyle>;
}

// Renderiza un contenedor tipo tarjeta con bordes y fondo acordes al tema visual.
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

export default Card;

