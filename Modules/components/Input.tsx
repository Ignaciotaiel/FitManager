// Campo de entrada de texto reutilizable con etiqueta, validación y alternancia de contraseña.
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleProp, ViewStyle, TextInputProps } from 'react-native';
import { useTheme } from '../../contexto/themeContext';
import { styles } from './Input.styles';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  isPassword?: boolean;
  error?: string | null;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

// Renderiza un campo de texto controlado con soporte para contraseñas y mensajes de error.
export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  isPassword = false,
  error,
  keyboardType = 'default',
  autoCapitalize = 'none',
  disabled = false,
  style,
  ...rest
}: InputProps) {
  const { colors } = useTheme();
  const [showPassword, setShowPassword] = useState(false);

  const toggleShowPassword = () => setShowPassword((prev) => !prev);

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.card,
            borderColor: error ? colors.danger : colors.border
          }
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={isPassword && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={!disabled}
          style={[styles.input, { color: colors.text }]}
          {...rest}
        />

        {isPassword && (
          <TouchableOpacity
            onPress={toggleShowPassword}
            style={styles.eyeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'ocultar contraseña' : 'mostrar contraseña'}
          >
            <Text style={[styles.eyeText, { color: colors.primary }]}>
              {showPassword ? 'ocultar' : 'ver'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export default Input;
