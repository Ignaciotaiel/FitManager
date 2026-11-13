// Encabezado superior para paneles móviles con saludo, rol, cambio de tema y cierre de sesión.
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
  useWindowDimensions
} from 'react-native';
import { useTheme } from '../../contexto/themeContext';
import { useAuth } from '../../contexto/authContext';
import RoleBadge from './RoleBadge';
import ConfirmModal from './ConfirmModal';
import { styles } from './DashboardHeader.styles';

export interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
}

// Renderiza el encabezado del panel en dispositivos móviles y gestiona el cierre de sesión.
export function DashboardHeader({ title, subtitle }: DashboardHeaderProps) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, exitApp, logout } = useAuth();
  const { width } = useWindowDimensions();
  const [menuVisible, setMenuVisible] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);

  // En navegador de escritorio (>= 768px), la barra lateral y el encabezado superior ya muestran
  // el perfil, rol, cambio de tema y cierre de sesion. Evitamos duplicarlos.
  const isDesktopWeb = Platform.OS === 'web' && width >= 768;
  if (isDesktopWeb) {
    return null;
  }

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

export default DashboardHeader;

