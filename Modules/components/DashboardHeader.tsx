import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useTheme } from '../../contexto/themeContext';
import { useAuth } from '../../contexto/authContext';
import RoleBadge from './RoleBadge';
import ConfirmModal from './ConfirmModal';

export interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
}

export function DashboardHeader({ title, subtitle }: DashboardHeaderProps) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, exitApp, logout } = useAuth();
  const [menuVisible, setMenuVisible] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);

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
    marginRight: 12
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '900'
  },
  userTextCol: {
    flex: 1,
    justifyContent: 'center'
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 3
  },
  badge: {
    marginTop: 1
  },
  menuTriggerBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  menuTriggerDots: {
    fontSize: 18,
    fontWeight: '900'
  },
  titleSection: {
    marginTop: 16,
    marginBottom: 4
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.3
  },
  subtitle: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18
  },
  menuBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  menuModal: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16
  },
  menuHeader: {
    paddingBottom: 8
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  menuSub: {
    fontSize: 12,
    marginTop: 2
  },
  menuDivider: {
    height: 1,
    marginVertical: 10
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8
  },
  menuItemDanger: {
    marginTop: 4
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '700'
  }
});

export default DashboardHeader;

