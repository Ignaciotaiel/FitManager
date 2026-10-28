import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../contexto/themeContext.js';

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
}) {
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
            accessibilityLabel={showPassword ? 'ocultar contrasena' : 'mostrar contrasena'}
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

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    width: '100%'
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 14
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12
  },
  eyeButton: {
    paddingLeft: 8
  },
  eyeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500'
  }
});

export default Input;
