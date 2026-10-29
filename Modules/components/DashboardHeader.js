import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useTheme } from '../../contexto/themeContext.js';
import { useAuth } from '../../contexto/authContext.js';
import RoleBadge from './RoleBadge.js';
import ConfirmModal from './ConfirmModal.js';

export function DashboardHeader({ title, subtitle }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, exitApp, logout } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
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

  const displayName = user?.name || user?.email?.split('@')[0] || 'Usuario';
  const initial = (displayName[0] || 'U').toUpperCase();

  return (
    <View style={styles.container}>
      {/* Fila superior: Perfil de usuario a la izquierda y botón de menú a la derecha */}
      <View style={styles.profileRow}>
        <View style={styles.avatarAndInfo}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <Text style={[styles.avatarInitial, { color: colors.primary }]}>{initial}</Text>
          </View>
          <View style={styles.userTextCol}>
            <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            <RoleBadge role={user?.role} style={styles.badge} />
          </View>
        </View>

        {/* Botón de configuración / cuenta */}
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          style={[styles.menuTriggerBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel="opciones de cuenta y configuración"
        >
          <Text style={[styles.menuTriggerDots, { color: colors.text }]}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* Titulo contextual de la pantalla actual */}
      {title ? (
        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          ) : null}
        </View>
      ) : null}

      {/* Menú desplegable modal para ajustes rápidos */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={[styles.menuBackdrop, { backgroundColor: colors.overlay }]} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.menuHeader}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>MI CUENTA</Text>
              <Text style={[styles.menuSub, { color: colors.textMuted }]}>{user?.email}</Text>
            </View>

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

            {/* Alternar modo oscuro / claro */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                toggleTheme();
                setMenuVisible(false);
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                {isDark ? '☀️ Modo Claro' : '🌙 Modo Oscuro'}
              </Text>
            </TouchableOpacity>

            {/* Salir a inicio (conserva sesión) */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                exitApp();
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.textSecondary }]}>
                🚪 Salir al inicio
              </Text>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

            {/* Cerrar sesión */}
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDanger]}
              onPress={() => {
                setMenuVisible(false);
                setShowLogoutConfirm(true);
              }}
            >
              <Text style={[styles.menuItemText, { color: colors.danger, fontWeight: '800' }]}>
                ✕ Cerrar sesión por completo
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Modal de confirmación para cerrar sesión */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
    paddingBottom: 6,
    marginBottom: 8
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  avatarAndInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '900'
  },
  userTextCol: {
    flex: 1
  },
  userName: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  badge: {
    marginTop: 3
  },
  menuTriggerBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  menuTriggerDots: {
    fontSize: 20,
    fontWeight: '900'
  },
  titleSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)'
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16
  },
  menuBackdrop: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: 16
  },
  menuModal: {
    width: 250,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8
  },
  menuHeader: {
    paddingBottom: 8
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  menuSub: {
    fontSize: 11,
    marginTop: 2
  },
  menuDivider: {
    height: 1,
    marginVertical: 6
  },
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 6
  },
  menuItemDanger: {
    paddingVertical: 10
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '700'
  }
});

export default DashboardHeader;
