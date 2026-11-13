// Muestra el panel principal del administrador con indicadores en tiempo real y herramientas de gestión.
import React, { useState, useEffect, useCallback } from 'react';
import type { ScreenProps } from '../../Scripts/navigation/types';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexto/themeContext';
import { withAlpha } from '../../Styles/theme/colors';
import { useAuth } from '../../contexto/authContext';
import { userService } from '../../Modules/users/userService';
import { adminService } from '../../Modules/admin/adminService';
import { routineService } from '../../Modules/routines/routineService';
import {
  DashboardHeader,
  Card,
  Button,
  StatusBanner,
  LoadingSpinner
} from '../../Modules/components/index';
import { styles } from './AdminDashboardScreen.styles';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  trainersCount: number;
  membersCount: number;
  routinesCount: number | null;
  pendingIncidents: number | null;
  activeNotifications: number | null;
}

// Pantalla principal del administrador con métricas globales y accesos a cada módulo.
export function AdminDashboardScreen({ navigation }: ScreenProps<'AdminDashboard'>) {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    trainersCount: 0,
    membersCount: 0,
    routinesCount: null,
    pendingIncidents: null,
    activeNotifications: null
  });

  // carga de indicadores reales consultando los servicios existentes
  const loadSystemStats = useCallback(async () => {
    try {
      setErrorMessage(null);
      const [usersResult, incidentsResult, notificationsResult, routinesResult] = await Promise.allSettled([
        userService.getUsers(token),
        adminService.getIncidents({}, token),
        adminService.getNotifications(token),
        routineService.getRoutines(token)
      ]);

      let nextTotal = 0;
      let nextActive = 0;
      let nextInactive = 0;
      let nextTrainers = 0;
      let nextMembers = 0;

      if (usersResult.status === 'fulfilled') {
        const res = usersResult.value;
        if (res?.ok && Array.isArray(res?.data?.users)) {
          const users = res.data.users;
          nextTotal = users.length;
          nextActive = users.filter((u) => u.is_active === 1 || u.is_active === true).length;
          nextInactive = nextTotal - nextActive;
          nextTrainers = users.filter((u) => u.role === 'trainer').length;
          nextMembers = users.filter((u) => u.role === 'member').length;
        }
      } else {
        const err: any = usersResult.reason;
        if (err?.code === 'NETWORK_ERROR') {
          setErrorMessage('no se pudo conectar con el servidor para obtener estadísticas');
        } else {
          setErrorMessage(err?.message || 'error al cargar datos del sistema');
        }
      }

      let nextPendingIncidents: number | null = null;
      if (incidentsResult.status === 'fulfilled') {
        const incList = incidentsResult.value?.data?.incidents;
        if (Array.isArray(incList)) {
          nextPendingIncidents = incList.filter((i) => i.status === 'pending').length;
        }
      }

      let nextActiveNotifications: number | null = null;
      if (notificationsResult.status === 'fulfilled') {
        const notifList = notificationsResult.value?.data?.notifications;
        if (Array.isArray(notifList)) {
          nextActiveNotifications = notifList.filter(
            (n) => n.is_active === 1 || n.is_active === true
          ).length;
        }
      }

      let nextRoutinesCount: number | null = null;
      if (routinesResult.status === 'fulfilled') {
        const routList = routinesResult.value?.data?.routines;
        if (Array.isArray(routList)) {
          nextRoutinesCount = routList.length;
        }
      }

      setStats({
        totalUsers: nextTotal,
        activeUsers: nextActive,
        inactiveUsers: nextInactive,
        trainersCount: nextTrainers,
        membersCount: nextMembers,
        routinesCount: nextRoutinesCount,
        pendingIncidents: nextPendingIncidents,
        activeNotifications: nextActiveNotifications
      });
    } catch (error: any) {
      if (error?.code === 'NETWORK_ERROR') {
        setErrorMessage('no se pudo conectar con el servidor para obtener estadísticas');
      } else {
        setErrorMessage(error?.message || 'error al cargar datos del sistema');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadSystemStats();
  }, [loadSystemStats]);

  // actualizar indicadores al regresar desde Usuarios, Incidencias o Notificaciones
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadSystemStats();
    });
    return unsubscribe;
  }, [navigation, loadSystemStats]);

  const onRefresh = () => {
    setRefreshing(true);
    loadSystemStats();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <DashboardHeader />

        {/* A. Cabecera del panel administrativo */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border
            }
          ]}
        >
          <View style={styles.heroTopRow}>
            <View
              style={[
                styles.areaBadge,
                {
                  backgroundColor: withAlpha(colors.primary, 0.14),
                  borderColor: colors.primary
                }
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={13} color={colors.primary} />
              <Text style={[styles.areaBadgeText, { color: colors.primary }]}>
                ÁREA DE ADMINISTRACIÓN
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.85}
              style={[
                styles.notificationsQuickBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border
                }
              ]}
              accessibilityRole="button"
              accessibilityLabel="acceso rápido al centro de notificaciones"
            >
              <Ionicons name="notifications-outline" size={16} color={colors.primary} />
              <Text style={[styles.notificationsQuickText, { color: colors.text }]}>AVISOS</Text>
              {stats.activeNotifications !== null && stats.activeNotifications > 0 && (
                <View style={[styles.quickCountPill, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.quickCountText, { color: colors.primaryText }]}>
                    {stats.activeNotifications}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <Text style={[styles.heroTitle, { color: colors.text }]}>
            PANEL DE ADMINISTRACIÓN
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Supervisión integral del gimnasio, control de cuentas, auditoría de actividad, avisos e informes.
          </Text>
        </View>

        {errorMessage && <StatusBanner message={errorMessage} type="error" />}

        {loading ? (
          <LoadingSpinner message="cargando resumen del gimnasio..." />
        ) : (
          <>
            {/* B. Indicadores de resumen reales */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                INDICADORES DEL GIMNASIO
              </Text>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
                {stats.activeUsers} activas · {stats.inactiveUsers} inactivas
              </Text>
            </View>

            <View style={styles.kpiRow}>
              <Card style={[styles.kpiCard, { flex: 1 }]}>
                <View
                  style={[
                    styles.kpiIconCircle,
                    { backgroundColor: withAlpha(colors.primary, 0.14) }
                  ]}
                >
                  <Ionicons name="people-outline" size={18} color={colors.primary} />
                </View>
                <Text style={[styles.kpiNumber, { color: colors.text }]}>
                  {stats.totalUsers}
                </Text>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
                  TOTAL USUARIOS
                </Text>
              </Card>

              <Card style={[styles.kpiCard, { flex: 1 }]}>
                <View
                  style={[
                    styles.kpiIconCircle,
                    { backgroundColor: withAlpha(colors.primary, 0.14) }
                  ]}
                >
                  <Ionicons name="fitness-outline" size={18} color={colors.primary} />
                </View>
                <Text style={[styles.kpiNumber, { color: colors.primary }]}>
                  {stats.trainersCount}
                </Text>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
                  ENTRENADORES
                </Text>
              </Card>

              <Card style={[styles.kpiCard, { flex: 1 }]}>
                <View
                  style={[
                    styles.kpiIconCircle,
                    { backgroundColor: withAlpha(colors.info, 0.14) }
                  ]}
                >
                  <Ionicons name="person-outline" size={18} color={colors.info} />
                </View>
                <Text style={[styles.kpiNumber, { color: colors.text }]}>
                  {stats.membersCount}
                </Text>
                <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
                  SOCIOS
                </Text>
              </Card>
            </View>

            {(stats.pendingIncidents !== null || stats.activeNotifications !== null) && (
              <View style={styles.kpiSecondaryRow}>
                {stats.pendingIncidents !== null && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Incidents')}
                    activeOpacity={0.85}
                    style={[
                      styles.secondaryKpiCard,
                      {
                        backgroundColor: colors.card,
                        borderColor:
                          stats.pendingIncidents > 0 ? colors.warning : colors.border
                      }
                    ]}
                  >
                    <View
                      style={[
                        styles.secondaryKpiIcon,
                        {
                          backgroundColor: withAlpha(
                            stats.pendingIncidents > 0 ? colors.warning : colors.primary,
                            0.14
                          )
                        }
                      ]}
                    >
                      <Ionicons
                        name="warning-outline"
                        size={18}
                        color={stats.pendingIncidents > 0 ? colors.warning : colors.primary}
                      />
                    </View>
                    <View style={styles.secondaryKpiTextCol}>
                      <Text
                        style={[
                          styles.secondaryKpiNumber,
                          {
                            color:
                              stats.pendingIncidents > 0 ? colors.warning : colors.text
                          }
                        ]}
                      >
                        {stats.pendingIncidents}
                      </Text>
                      <Text style={[styles.secondaryKpiLabel, { color: colors.textSecondary }]}>
                        INCIDENCIAS PENDIENTES
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {stats.activeNotifications !== null && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Notifications')}
                    activeOpacity={0.85}
                    style={[
                      styles.secondaryKpiCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border
                      }
                    ]}
                  >
                    <View
                      style={[
                        styles.secondaryKpiIcon,
                        { backgroundColor: withAlpha(colors.primary, 0.14) }
                      ]}
                    >
                      <Ionicons name="megaphone-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.secondaryKpiTextCol}>
                      <Text style={[styles.secondaryKpiNumber, { color: colors.primary }]}>
                        {stats.activeNotifications}
                      </Text>
                      <Text style={[styles.secondaryKpiLabel, { color: colors.textSecondary }]}>
                        AVISOS ACTIVOS
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* C. Tarjetas de gestion principal */}
            <View style={[styles.sectionHeaderRow, { marginTop: 16 }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                GESTIÓN PRINCIPAL
              </Text>
            </View>

            <View style={isDesktop ? styles.cardsGridDesktop : undefined}>
              <Card style={[styles.toolCard, isDesktop && styles.toolCardDesktop]}>
                <View style={styles.toolTopRow}>
                  <View
                    style={[
                      styles.toolIconBox,
                      {
                        backgroundColor: withAlpha(colors.primary, 0.14),
                        borderColor: withAlpha(colors.primary, 0.35)
                      }
                    ]}
                  >
                    <Ionicons name="people-outline" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.toolInfoCol}>
                    <Text style={[styles.toolTitle, { color: colors.text }]}>
                      Gestión de usuarios y roles
                    </Text>
                    <Text style={[styles.toolDesc, { color: colors.textSecondary }]}>
                      Consultá el listado general, buscá por nombre o correo, asigná roles y activá o desactivá cuentas.
                    </Text>
                  </View>
                </View>
                <Button
                  title="VER LISTADO DE USUARIOS"
                  variant="primary"
                  onPress={() => navigation.navigate('Users')}
                />
              </Card>

              <Card style={[styles.toolCard, isDesktop && styles.toolCardDesktop]}>
                <View style={styles.toolTopRow}>
                  <View
                    style={[
                      styles.toolIconBox,
                      {
                        backgroundColor: withAlpha(colors.info, 0.14),
                        borderColor: colors.border
                      }
                    ]}
                  >
                    <Ionicons name="clipboard-outline" size={22} color={colors.info} />
                  </View>
                  <View style={styles.toolInfoCol}>
                    <Text style={[styles.toolTitle, { color: colors.text }]}>
                      Supervisión de rutinas{stats.routinesCount !== null ? ` (${stats.routinesCount})` : ''}
                    </Text>
                    <Text style={[styles.toolDesc, { color: colors.textSecondary }]}>
                      Consultá las rutinas creadas por cada entrenador, los socios asignados y los ejercicios incluidos.
                    </Text>
                  </View>
                </View>
                <Button
                  title="SUPERVISAR RUTINAS DEL GIMNASIO"
                  variant="secondary"
                  onPress={() => navigation.navigate('AdminRoutines')}
                />
              </Card>

              <Card style={[styles.toolCard, isDesktop && styles.toolCardDesktop]}>
                <View style={styles.toolTopRow}>
                  <View
                    style={[
                      styles.toolIconBox,
                      {
                        backgroundColor: withAlpha(colors.primary, 0.12),
                        borderColor: colors.border
                      }
                    ]}
                  >
                    <Ionicons name="barbell-outline" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.toolInfoCol}>
                    <Text style={[styles.toolTitle, { color: colors.text }]}>
                      Catálogo de ejercicios y técnicas
                    </Text>
                    <Text style={[styles.toolDesc, { color: colors.textSecondary }]}>
                      Administrá la biblioteca global de ejercicios disponibles para las rutinas del gimnasio.
                    </Text>
                  </View>
                </View>
                <Button
                  title="VER CATÁLOGO DE EJERCICIOS"
                  variant="secondary"
                  onPress={() => navigation.navigate('Exercises')}
                />
              </Card>
            </View>

            {/* D. Herramientas operativas y de auditoria */}
            <View style={[styles.sectionHeaderRow, { marginTop: 16 }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                HERRAMIENTAS DE ADMINISTRACIÓN
              </Text>
            </View>

            <View style={isDesktop ? styles.cardsGridDesktop : undefined}>
              <Card style={[styles.toolCard, isDesktop && styles.toolCardDesktop]}>
                <View style={styles.toolTopRow}>
                  <View
                    style={[
                      styles.toolIconBox,
                      {
                        backgroundColor: withAlpha(colors.info, 0.14),
                        borderColor: colors.border
                      }
                    ]}
                  >
                    <Ionicons name="pulse-outline" size={22} color={colors.info} />
                  </View>
                  <View style={styles.toolInfoCol}>
                    <Text style={[styles.toolTitle, { color: colors.text }]}>
                      Registro de actividad
                    </Text>
                    <Text style={[styles.toolDesc, { color: colors.textSecondary }]}>
                      Auditá las acciones realizadas en FitManager filtrando por usuario, categoría y período de fechas.
                    </Text>
                  </View>
                </View>
                <Button
                  title="VER REGISTRO DE ACTIVIDAD"
                  variant="secondary"
                  onPress={() => navigation.navigate('ActivityLog')}
                />
              </Card>

              <Card style={[styles.toolCard, isDesktop && styles.toolCardDesktop]}>
                <View style={styles.toolTopRow}>
                  <View
                    style={[
                      styles.toolIconBox,
                      {
                        backgroundColor: withAlpha(colors.primary, 0.14),
                        borderColor: colors.border
                      }
                    ]}
                  >
                    <Ionicons name="notifications-outline" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.toolInfoCol}>
                    <Text style={[styles.toolTitle, { color: colors.text }]}>
                      Centro de notificaciones
                    </Text>
                    <Text style={[styles.toolDesc, { color: colors.textSecondary }]}>
                      Publicá y administrá avisos internos dirigidos a todos los usuarios, entrenadores o socios.
                    </Text>
                  </View>
                </View>
                <Button
                  title="GESTIONAR NOTIFICACIONES"
                  variant="secondary"
                  onPress={() => navigation.navigate('Notifications')}
                />
              </Card>

              <Card style={[styles.toolCard, isDesktop && styles.toolCardDesktop]}>
                <View style={styles.toolTopRow}>
                  <View
                    style={[
                      styles.toolIconBox,
                      {
                        backgroundColor: withAlpha(colors.warning, 0.14),
                        borderColor: colors.border
                      }
                    ]}
                  >
                    <Ionicons name="construct-outline" size={22} color={colors.warning} />
                  </View>
                  <View style={styles.toolInfoCol}>
                    <Text style={[styles.toolTitle, { color: colors.text }]}>
                      Gestión de incidencias
                    </Text>
                    <Text style={[styles.toolDesc, { color: colors.textSecondary }]}>
                      Registrá y hacé seguimiento de inconvenientes en equipos o instalaciones hasta su resolución.
                    </Text>
                  </View>
                </View>
                <Button
                  title="GESTIONAR INCIDENCIAS"
                  variant="secondary"
                  onPress={() => navigation.navigate('Incidents')}
                />
              </Card>

              <Card style={[styles.toolCard, isDesktop && styles.toolCardDesktop]}>
                <View style={styles.toolTopRow}>
                  <View
                    style={[
                      styles.toolIconBox,
                      {
                        backgroundColor: withAlpha(colors.success, 0.14),
                        borderColor: colors.border
                      }
                    ]}
                  >
                    <Ionicons name="download-outline" size={22} color={colors.success} />
                  </View>
                  <View style={styles.toolInfoCol}>
                    <Text style={[styles.toolTitle, { color: colors.text }]}>
                      Exportación de informes CSV
                    </Text>
                    <Text style={[styles.toolDesc, { color: colors.textSecondary }]}>
                      Descargá o compartí archivos CSV reales de usuarios, ejercicios, rutinas, actividad e incidencias.
                    </Text>
                  </View>
                </View>
                <Button
                  title="EXPORTAR INFORMES CSV"
                  variant="secondary"
                  onPress={() => navigation.navigate('ReportsExport')}
                />
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default AdminDashboardScreen;
