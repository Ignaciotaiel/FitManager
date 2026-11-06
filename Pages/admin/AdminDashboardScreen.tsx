import React, { useState, useEffect, useCallback } from 'react';
import type { ScreenProps } from '../../Scripts/navigation/types';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexto/themeContext';
import { withAlpha } from '../../Styles/theme/colors';
import { useAuth } from '../../contexto/authContext';
import { userService } from '../../Modules/users/userService';
import { adminService } from '../../Modules/admin/adminService';
import {
  DashboardHeader,
  Card,
  Button,
  StatusBanner,
  LoadingSpinner
} from '../../Modules/components/index';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  trainersCount: number;
  membersCount: number;
  pendingIncidents: number | null;
  activeNotifications: number | null;
}

export function AdminDashboardScreen({ navigation }: ScreenProps<'AdminDashboard'>) {
  const { colors } = useTheme();
  const { token } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    trainersCount: 0,
    membersCount: 0,
    pendingIncidents: null,
    activeNotifications: null
  });

  // carga de indicadores reales consultando los servicios existentes
  const loadSystemStats = useCallback(async () => {
    try {
      setErrorMessage(null);
      const [usersResult, incidentsResult, notificationsResult] = await Promise.allSettled([
        userService.getUsers(token),
        adminService.getIncidents({}, token),
        adminService.getNotifications(token)
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

      setStats({
        totalUsers: nextTotal,
        activeUsers: nextActive,
        inactiveUsers: nextInactive,
        trainersCount: nextTrainers,
        membersCount: nextMembers,
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

            <Card style={styles.toolCard}>
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

            <Card style={styles.toolCard}>
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

            {/* D. Herramientas operativas y de auditoria */}
            <View style={[styles.sectionHeaderRow, { marginTop: 16 }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                HERRAMIENTAS DE ADMINISTRACIÓN
              </Text>
            </View>

            <Card style={styles.toolCard}>
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

            <Card style={styles.toolCard}>
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

            <Card style={styles.toolCard}>
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

            <Card style={styles.toolCard}>
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 32
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8
  },
  areaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1
  },
  areaBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7
  },
  notificationsQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1
  },
  notificationsQuickText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  quickCountPill: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  quickCountText: {
    fontSize: 10,
    fontWeight: '900'
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  sectionHint: {
    fontSize: 11,
    fontWeight: '700'
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8
  },
  kpiCard: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    marginVertical: 2
  },
  kpiIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6
  },
  kpiNumber: {
    fontSize: 22,
    fontWeight: '900'
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 3,
    textAlign: 'center'
  },
  kpiSecondaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  secondaryKpiCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10
  },
  secondaryKpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryKpiTextCol: {
    flex: 1
  },
  secondaryKpiNumber: {
    fontSize: 18,
    fontWeight: '900'
  },
  secondaryKpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginTop: 1
  },
  toolCard: {
    padding: 15,
    marginVertical: 6,
    borderRadius: 14
  },
  toolTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10
  },
  toolIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  toolInfoCol: {
    flex: 1
  },
  toolTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2
  },
  toolDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3
  }
});

export default AdminDashboardScreen;
