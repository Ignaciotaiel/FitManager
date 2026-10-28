import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexto/themeContext.js';
import { useAuth } from '../../contexto/authContext.js';
import RoleBadge from './RoleBadge.js';

export function DashboardHeader({ title, subtitle }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.userSection}>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>
            hola,
          </Text>
          <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
            {user?.name || user?.email?.split('@')[0] || 'usuario'}
          </Text>
          <RoleBadge role={user?.role} style={styles.badge} />
        </View>

        <View style={styles.controlsRow}>
          <TouchableOpacity
            onPress={toggleTheme}
            style={[styles.smallBtn, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="cambiar modo de color"
          >
            <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>
              {isDark ? 'CLARO' : 'OSCURO'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={logout}
            style={[styles.smallBtn, { borderColor: colors.danger, backgroundColor: colors.dangerSurface }]}
            accessibilityRole="button"
            accessibilityLabel="cerrar sesion"
          >
            <Text style={[styles.smallBtnText, { color: colors.danger }]}>
              SALIR
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {title ? (
        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    marginBottom: 8
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  userSection: {
    flex: 1,
    paddingRight: 10
  },
  greeting: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  userName: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: 0.3
  },
  badge: {
    marginTop: 6
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  smallBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  titleSection: {
    marginTop: 16
  },
  title: {
    fontSize: 20,
    fontWeight: '800'
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18
  }
});

export default DashboardHeader;
