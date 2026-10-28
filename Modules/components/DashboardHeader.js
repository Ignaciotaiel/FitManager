import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexto/themeContext.js';
import { useAuth } from '../../contexto/authContext.js';
import RoleBadge from './RoleBadge.js';
import ConfirmModal from './ConfirmModal.js';

export function DashboardHeader({ title, subtitle }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, exitApp, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleConfirmLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

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

          {/* Opcion 1: Salir de FitManager (conserva sesion) */}
          <TouchableOpacity
            onPress={exitApp}
            style={[styles.smallBtn, { borderColor: colors.border, backgroundColor: colors.surfaceLight }]}
            accessibilityRole="button"
            accessibilityLabel="salir de fitmanager al inicio"
          >
            <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>
              SALIR
            </Text>
          </TouchableOpacity>

          {/* Opcion 2: Cerrar sesion por completo (elimina sesion) */}
          <TouchableOpacity
            onPress={() => setShowLogoutConfirm(true)}
            style={[styles.smallBtn, { borderColor: colors.danger, backgroundColor: colors.dangerSurface }]}
            accessibilityRole="button"
            accessibilityLabel="cerrar sesion por completo"
          >
            <Text style={[styles.smallBtnText, { color: colors.danger }]}>
              CERRAR
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal de confirmacion para cerrar sesion definitivamente */}
      <ConfirmModal
        visible={showLogoutConfirm}
        title="cerrar sesión por completo"
        message="¿Querés cerrar sesión por completo? Tendrás que volver a autenticarte para entrar."
        confirmText="cerrar sesión"
        cancelText="cancelar"
        isDestructive={true}
        loading={loggingOut}
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

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
