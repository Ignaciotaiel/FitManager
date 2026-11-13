// Estructura principal de escritorio para la versión web con barra lateral y encabezado por rol.
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexto/themeContext';
import { withAlpha } from '../../Styles/theme/colors';
import { useAuth } from '../../contexto/authContext';
import { adminService } from '../admin/adminService';
import RoleBadge from './RoleBadge';
import ConfirmModal from './ConfirmModal';
import { styles } from './WebContainer.styles';

export interface WebContainerProps {
  children: React.ReactNode;
  maxWidth?: number;
  currentRouteName?: string;
  onNavigate?: (routeName: string, params?: any) => void;
  onGoBack?: () => void;
  canGoBack?: boolean;
}

interface SidebarNavItem {
  route: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  group?: string;
}

const ADMIN_NAV_ITEMS: SidebarNavItem[] = [
  { route: 'AdminDashboard', label: 'Panel principal', icon: 'grid-outline', group: 'GESTIÓN' },
  { route: 'Users', label: 'Usuarios y roles', icon: 'people-outline', group: 'GESTIÓN' },
  { route: 'AdminRoutines', label: 'Supervisión de rutinas', icon: 'clipboard-outline', group: 'GESTIÓN' },
  { route: 'Exercises', label: 'Catálogo de ejercicios', icon: 'barbell-outline', group: 'GESTIÓN' },
  { route: 'ActivityLog', label: 'Registro de actividad', icon: 'pulse-outline', group: 'AUDITORÍA Y SISTEMA' },
  { route: 'Notifications', label: 'Centro de avisos', icon: 'notifications-outline', group: 'AUDITORÍA Y SISTEMA' },
  { route: 'Incidents', label: 'Gestión de incidencias', icon: 'construct-outline', group: 'AUDITORÍA Y SISTEMA' },
  { route: 'ReportsExport', label: 'Exportar informes CSV', icon: 'download-outline', group: 'AUDITORÍA Y SISTEMA' }
];

const TRAINER_NAV_ITEMS: SidebarNavItem[] = [
  { route: 'TrainerDashboard', label: 'Panel de entrenamiento', icon: 'fitness-outline', group: 'ENTRENADOR' },
  { route: 'TrainerStudentsHistory', label: 'Seguimiento de socios', icon: 'people-outline', group: 'ENTRENADOR' },
  { route: 'Exercises', label: 'Biblioteca de técnicas', icon: 'barbell-outline', group: 'RECURSOS' },
  { route: 'NotificationsInbox', label: 'Avisos del gimnasio', icon: 'notifications-outline', group: 'RECURSOS' }
];

const MEMBER_NAV_ITEMS: SidebarNavItem[] = [
  { route: 'MemberDashboard', label: 'Mi entrenamiento', icon: 'barbell-outline', group: 'MI CUENTA' },
  { route: 'WorkoutHistory', label: 'Progreso e historial', icon: 'stats-chart-outline', group: 'MI CUENTA' },
  { route: 'Exercises', label: 'Biblioteca de técnicas', icon: 'book-outline', group: 'RECURSOS' },
  { route: 'NotificationsInbox', label: 'Avisos del gimnasio', icon: 'notifications-outline', group: 'RECURSOS' }
];

const ROUTE_TITLES: Record<string, { title: string; subtitle: string }> = {
  AdminDashboard: {
    title: 'Panel de Administración',
    subtitle: 'Supervisión integral del gimnasio, métricas operativas y control de cuentas'
  },
  Users: {
    title: 'Gestión de Usuarios y Roles',
    subtitle: 'Administración de cuentas activas, permisos de entrenadores y socios'
  },
  AdminRoutines: {
    title: 'Supervisión de Rutinas',
    subtitle: 'Auditoría en modo lectura de planes creados por entrenadores y socios asignados'
  },
  Exercises: {
    title: 'Biblioteca de Técnicas y Ejercicios',
    subtitle: 'Catálogo de ejercicios por grupo muscular y nivel de dificultad'
  },
  ActivityLog: {
    title: 'Registro de Actividad',
    subtitle: 'Historial auditable de acciones administrativas y operativas'
  },
  Notifications: {
    title: 'Centro de Notificaciones',
    subtitle: 'Publicación y gestión de avisos internos para entrenadores y socios'
  },
  Incidents: {
    title: 'Gestión de Incidencias',
    subtitle: 'Control y seguimiento técnico de equipamiento e instalaciones'
  },
  ReportsExport: {
    title: 'Exportación de Informes CSV',
    subtitle: 'Descarga directa de reportes compatibles con Excel y Google Sheets'
  },
  TrainerDashboard: {
    title: 'Panel de Entrenamiento',
    subtitle: 'Diagramación de rutinas, ejercicios y asignación de planes a socios'
  },
  TrainerStudentsHistory: {
    title: 'Seguimiento e Historial de Socios',
    subtitle: 'Evolución de cargas, mejores marcas y sesiones registradas por tus alumnos'
  },
  MemberDashboard: {
    title: 'Mi Entrenamiento',
    subtitle: 'Tus planes asignados, sesiones en curso y accesos deportivos'
  },
  WorkoutHistory: {
    title: 'Progreso Deportivo e Historial',
    subtitle: 'Gráficos de evolución de pesos por ejercicio y registro de sesiones'
  },
  RoutineDetail: {
    title: 'Detalle del Plan de Entrenamiento',
    subtitle: 'Ejercicios, series, repeticiones y control de sesión'
  },
  NotificationsInbox: {
    title: 'Avisos del Gimnasio',
    subtitle: 'Comunicados y novedades oficiales de FitManager'
  }
};

// Envuelve la aplicación en web de escritorio añadiendo barra lateral por rol y encabezado superior.
export function WebContainer({
  children,
  maxWidth = 1360,
  currentRouteName,
  onNavigate,
  onGoBack,
  canGoBack = false
}: WebContainerProps) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { isAuthenticated, user, role, token, logout, exitApp } = useAuth();
  const { width } = useWindowDimensions();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  // Sincroniza el contador de avisos no leídos en la barra lateral para socios y entrenadores.
  const refreshSidebarNotifications = useCallback(async () => {
    if (Platform.OS !== 'web' || !isAuthenticated || !token || (role !== 'trainer' && role !== 'member')) {
      setUnreadNotificationsCount(0);
      return;
    }
    try {
      const res = await adminService.getActiveNotifications(token);
      if (res?.ok && res?.data) {
        const list = Array.isArray(res.data.notifications) ? res.data.notifications : [];
        const unread =
          typeof res.data.unread_count === 'number'
            ? res.data.unread_count
            : list.filter((n: any) => !n.is_read).length;
        setUnreadNotificationsCount(unread);
      }
    } catch (_) {}
  }, [isAuthenticated, token, role]);

  useEffect(() => {
    refreshSidebarNotifications();
    if (currentRouteName === 'NotificationsInbox') {
      const timerId = setTimeout(() => {
        refreshSidebarNotifications();
      }, 700);
      return () => clearTimeout(timerId);
    }
  }, [currentRouteName, refreshSidebarNotifications]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isAuthenticated || (role !== 'trainer' && role !== 'member')) {
      return;
    }
    const intervalId = setInterval(() => {
      refreshSidebarNotifications();
    }, 30000);
    return () => clearInterval(intervalId);
  }, [isAuthenticated, role, refreshSidebarNotifications]);

  // En Android / iOS nativo se devuelve el arbol sin ninguna alteracion
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  // En pantallas pequenas de navegador (< 768px) o flujo publico no autenticado:
  if (!isAuthenticated || !role) {
    return (
      <View style={[styles.publicRoot, { backgroundColor: colors.background }]}>
        <View style={[styles.publicInner, { maxWidth: width >= 960 ? 1240 : 620 }]}>
          {children}
        </View>
      </View>
    );
  }

  // En resolucion movil dentro del navegador (< 768px), mantener navegacion movil
  if (width < 768) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {children}
      </View>
    );
  }

  // En tablet / notebook compacta (768 - 1060px): sidebar compacta; en escritorio (>= 1060px): sidebar completa
  const isCompactSidebar = width < 1060;
  const sidebarWidth = isCompactSidebar ? 78 : 264;

  const navItems: SidebarNavItem[] =
    role === 'admin'
      ? ADMIN_NAV_ITEMS
      : role === 'trainer'
      ? TRAINER_NAV_ITEMS
      : MEMBER_NAV_ITEMS;

  const homeRoute =
    role === 'admin'
      ? 'AdminDashboard'
      : role === 'trainer'
      ? 'TrainerDashboard'
      : 'MemberDashboard';

  const activeRoute = currentRouteName || homeRoute;
  const isPrimaryRoute = navItems.some((item) => item.route === activeRoute);

  const routeMeta = ROUTE_TITLES[activeRoute] || {
    title: 'FitManager Pro',
    subtitle: 'Sistema de gestión deportiva y seguimiento de entrenamientos'
  };

  const displayName = user?.name || user?.email?.split('@')[0] || 'Usuario';
  const initial = (displayName[0] || 'U').toUpperCase();

  const handleConfirmLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  // Agrupar items por seccion para mostrar encabezados limpios en la barra lateral
  const groups: Array<{ name: string; items: SidebarNavItem[] }> = [];
  navItems.forEach((item) => {
    const gName = item.group || 'MENÚ';
    const existing = groups.find((g) => g.name === gName);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ name: gName, items: [item] });
    }
  });

  return (
    <View style={[styles.desktopRoot, { backgroundColor: colors.background }]}>
      {/* BARRA LATERAL IZQUIERDA (SIDEBAR) */}
      <View
        style={[
          styles.sidebar,
          {
            width: sidebarWidth,
            backgroundColor: colors.card,
            borderRightColor: colors.border
          }
        ]}
      >
        {/* Marca FITMANAGER PRO */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onNavigate?.(homeRoute)}
          style={[
            styles.brandHeader,
            isCompactSidebar && styles.brandHeaderCompact,
            { borderBottomColor: colors.border }
          ]}
          accessibilityRole="button"
          accessibilityLabel="Ir al panel principal de FitManager"
        >
          <View
            style={[
              styles.brandLogoBox,
              {
                backgroundColor: withAlpha(colors.primary, 0.14),
                borderColor: colors.primary
              }
            ]}
          >
            <Ionicons name="barbell-outline" size={20} color={colors.primary} />
          </View>
          {!isCompactSidebar && (
            <View style={styles.brandTextCol}>
              <View style={styles.brandTitleRow}>
                <Text style={[styles.brandTitle, { color: colors.text }]}>FITMANAGER</Text>
                <View style={[styles.proPill, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.proPillText, { color: colors.primaryText }]}>PRO</Text>
                </View>
              </View>
              <Text style={[styles.brandSub, { color: colors.textMuted }]}>
                SISTEMA DEPORTIVO
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Opciones de navegacion exclusivas del rol autenticado */}
        <ScrollView
          style={styles.navScroll}
          contentContainerStyle={styles.navScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((group) => (
            <View key={group.name} style={styles.navGroup}>
              {!isCompactSidebar && (
                <Text style={[styles.navGroupLabel, { color: colors.textMuted }]}>
                  {group.name}
                </Text>
              )}
              {group.items.map((item) => {
                const selected =
                  activeRoute === item.route ||
                  (activeRoute === 'RoutineDetail' &&
                    ((role === 'admin' && item.route === 'AdminRoutines') ||
                      (role === 'trainer' && item.route === 'TrainerDashboard') ||
                      (role === 'member' && item.route === 'MemberDashboard')));

                return (
                  <TouchableOpacity
                    key={item.route}
                    activeOpacity={0.8}
                    onPress={() => onNavigate?.(item.route)}
                    style={[
                      styles.navItem,
                      isCompactSidebar && styles.navItemCompact,
                      selected && {
                        backgroundColor: withAlpha(colors.primary, 0.14),
                        borderColor: withAlpha(colors.primary, 0.45)
                      }
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected }}
                  >
                    <View
                      style={[
                        styles.navActiveBar,
                        { backgroundColor: selected ? colors.primary : 'transparent' }
                      ]}
                    />
                    <Ionicons
                      name={item.icon}
                      size={19}
                      color={selected ? colors.primary : colors.textSecondary}
                    />
                    {!isCompactSidebar && (
                      <Text
                        style={[
                          styles.navItemText,
                          {
                            color: selected ? colors.text : colors.textSecondary,
                            fontWeight: selected ? '800' : '600'
                          }
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    )}
                    {item.route === 'NotificationsInbox' && unreadNotificationsCount > 0 && (
                      isCompactSidebar ? (
                        <View
                          style={[
                            styles.navUnreadCompactDot,
                            { backgroundColor: colors.primary }
                          ]}
                        />
                      ) : (
                        <View
                          style={[
                            styles.navUnreadBadge,
                            {
                              backgroundColor: withAlpha(colors.primary, 0.16),
                              borderColor: colors.primary
                            }
                          ]}
                        >
                          <View
                            style={[
                              styles.navUnreadDot,
                              { backgroundColor: colors.primary }
                            ]}
                          />
                          <Text style={[styles.navUnreadCountText, { color: colors.primary }]}>
                            {unreadNotificationsCount}
                          </Text>
                        </View>
                      )
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* Pie de Sidebar: Tema + Usuario + Cerrar sesion */}
        <View style={[styles.sidebarFooter, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={toggleTheme}
            style={[
              styles.footerActionBtn,
              isCompactSidebar && styles.footerActionBtnCompact,
              { backgroundColor: colors.surface, borderColor: colors.border }
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cambiar tema claro u oscuro"
          >
            <Ionicons
              name={isDark ? 'sunny-outline' : 'moon-outline'}
              size={17}
              color={colors.primary}
            />
            {!isCompactSidebar && (
              <Text style={[styles.footerActionText, { color: colors.text }]}>
                {isDark ? 'Modo Claro' : 'Modo Oscuro'}
              </Text>
            )}
          </TouchableOpacity>

          {!isCompactSidebar && (
            <View
              style={[
                styles.userCardBox,
                { backgroundColor: colors.surface, borderColor: colors.border }
              ]}
            >
              <View
                style={[
                  styles.userAvatar,
                  {
                    backgroundColor: withAlpha(colors.primary, 0.14),
                    borderColor: colors.primary
                  }
                ]}
              >
                <Text style={[styles.userAvatarText, { color: colors.primary }]}>{initial}</Text>
              </View>
              <View style={styles.userMetaCol}>
                <Text style={[styles.userNameText, { color: colors.text }]} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={[styles.userEmailText, { color: colors.textMuted }]} numberOfLines={1}>
                  {user?.email}
                </Text>
              </View>
            </View>
          )}

          <View style={[styles.footerBottomRow, isCompactSidebar && { flexDirection: 'column' }]}>
            {!isCompactSidebar && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={exitApp}
                style={[
                  styles.exitSmallBtn,
                  { borderColor: colors.border, backgroundColor: colors.surface }
                ]}
                accessibilityRole="button"
                accessibilityLabel="Salir a la portada"
              >
                <Ionicons name="home-outline" size={15} color={colors.textSecondary} />
                <Text style={[styles.exitSmallText, { color: colors.textSecondary }]}>INICIO</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowLogoutConfirm(true)}
              style={[
                styles.logoutBtn,
                isCompactSidebar && styles.footerActionBtnCompact,
                {
                  borderColor: withAlpha(colors.danger, 0.45),
                  backgroundColor: colors.dangerSurface
                }
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cerrar sesión"
            >
              <Ionicons name="log-out-outline" size={16} color={colors.danger} />
              {!isCompactSidebar && (
                <Text style={[styles.logoutBtnText, { color: colors.danger }]}>SALIR</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* AREA PRINCIPAL DERECHA: TOP HEADER + CONTENIDO AMPLIO */}
      <View style={styles.mainColumn}>
        {/* Encabezado superior de escritorio */}
        <View
          style={[
            styles.topHeader,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border
            }
          ]}
        >
          <View style={styles.topHeaderLeft}>
            {!isPrimaryRoute && canGoBack && (
              <TouchableOpacity
                onPress={onGoBack}
                style={[
                  styles.topBackBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border }
                ]}
                accessibilityRole="button"
                accessibilityLabel="Volver a la pantalla anterior"
              >
                <Ionicons name="arrow-back" size={16} color={colors.primary} />
                <Text style={[styles.topBackBtnText, { color: colors.text }]}>VOLVER</Text>
              </TouchableOpacity>
            )}
            <View style={styles.topTitleCol}>
              <Text style={[styles.topHeaderTitle, { color: colors.text }]} numberOfLines={1}>
                {routeMeta.title}
              </Text>
              <Text
                style={[styles.topHeaderSubtitle, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {routeMeta.subtitle}
              </Text>
            </View>
          </View>

          <View style={styles.topHeaderRight}>
            <RoleBadge role={role} />
            <TouchableOpacity
              onPress={toggleTheme}
              style={[
                styles.topIconBtn,
                { backgroundColor: colors.surface, borderColor: colors.border }
              ]}
              accessibilityRole="button"
              accessibilityLabel="Alternar modo claro u oscuro"
            >
              <Ionicons
                name={isDark ? 'sunny-outline' : 'moon-outline'}
                size={17}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Contenedor de pagina centrado de 1200 a 1400px */}
        <View style={[styles.contentViewport, { backgroundColor: colors.background }]}>
          <View style={[styles.contentInner, { maxWidth }]}>{children}</View>
        </View>
      </View>

      <ConfirmModal
        visible={showLogoutConfirm}
        title="cerrar sesión por completo"
        message="¿Querés cerrar sesión por completo en este navegador? Tendrás que volver a autenticarte para entrar."
        confirmText="cerrar sesión"
        cancelText="cancelar"
        isDestructive
        loading={loggingOut}
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </View>
  );
}

export default WebContainer;
