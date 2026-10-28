import { StyleSheet } from 'react-native';

// generador de estilos reutilizables en base a los colores del tema activo
export function createCommonStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 20
    },
    safeContainer: {
      flex: 1,
      backgroundColor: colors.background
    },
    centerContent: {
      justifyContent: 'center',
      alignItems: 'center'
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginVertical: 8
    },
    cardSurface: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border
    },
    title: {
      fontSize: 26,
      fontWeight: 'bold',
      color: colors.text,
      letterSpacing: 0.5,
      marginBottom: 6
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 16,
      lineHeight: 22
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginVertical: 12
    },
    bodyText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20
    },
    captionText: {
      fontSize: 12,
      color: colors.textMuted
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 8
    },
    primaryButtonText: {
      color: colors.primaryText,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.3
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginVertical: 6
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600'
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      marginBottom: 12
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      alignSelf: 'flex-start'
    },
    badgePrimary: {
      backgroundColor: colors.primary,
    },
    badgeText: {
      color: colors.primaryText,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase'
    },
    errorBanner: {
      backgroundColor: colors.dangerSurface,
      borderColor: colors.danger,
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      marginVertical: 8
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: '500'
    }
  });
}
