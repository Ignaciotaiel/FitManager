// Muestra el panel principal del socio con sus rutinas asignadas, última sesión y accesos rápidos.
import React, { useState, useEffect, useCallback } from 'react';
import type { ScreenProps } from '../../Scripts/navigation/types';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexto/themeContext';
import { withAlpha } from '../../Styles/theme/colors';
import { useAuth } from '../../contexto/authContext';
import { routineService } from '../../Modules/routines/routineService';
import { workoutService } from '../../Modules/workouts/workoutService';
import { adminService } from '../../Modules/admin/adminService';
import { formatDateAR } from '../../Modules/utils/dateFormat';
import {
  DashboardHeader,
  Card,
  Button,
  StatusBanner,
  LoadingSpinner,
  EmptyState
} from '../../Modules/components/index';
import { styles } from './MemberDashboardScreen.styles';

// Pantalla principal del socio con resumen de actividad y rutinas asignadas.
export function MemberDashboardScreen({ navigation }: ScreenProps<'MemberDashboard'>) {
  const { colors } = useTheme();
  const { token, user } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 960;

  const [routines, setRoutines] = useState<any[]>([]);
  const [activeSessionsByRoutine, setActiveSessionsByRoutine] = useState<any>({});
  const [lastSession, setLastSession] = useState<any>(null);
  const [totalSessionsCount, setTotalSessionsCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<any>(null);

  // Sincroniza únicamente la cantidad de avisos nuevos sin bloquear la interfaz.
  const refreshUnreadNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const notifRes = await adminService.getActiveNotifications(token);
      if (notifRes?.ok && notifRes?.data) {
        const list = Array.isArray(notifRes.data.notifications) ? notifRes.data.notifications : [];
        const unread =
          typeof notifRes.data.unread_count === 'number'
            ? notifRes.data.unread_count
            : list.filter((n: any) => !n.is_read).length;
        setUnreadNotificationsCount(unread);
      }
    } catch (_) {}
  }, [token]);

  const loadDashboardData = useCallback(async () => {
    try {
      setErrorMessage(null);
      const [routineRes, historyRes, notifRes]: any[] = await Promise.all([
        routineService.getRoutines(token).catch(err => ({ ok: false, error: err })),
        workoutService.getHistory({ limit: 1 }, token).catch(() => ({ ok: false })),
        adminService.getActiveNotifications(token).catch(() => ({ ok: false }))
      ]);

      if (notifRes?.ok && notifRes?.data) {
        const list = Array.isArray(notifRes.data.notifications) ? notifRes.data.notifications : [];
        const unread =
          typeof notifRes.data.unread_count === 'number'
            ? notifRes.data.unread_count
            : list.filter((n: any) => !n.is_read).length;
        setUnreadNotificationsCount(unread);
      }

      let loadedRoutines: any[] = [];
      if (routineRes?.ok && Array.isArray(routineRes?.data?.routines)) {
        loadedRoutines = routineRes.data.routines;
        setRoutines(loadedRoutines);
      } else if (routineRes?.error) {
        throw routineRes.error;
      }

      // Consultar sesiones activas en paralelo para cada rutina
      if (loadedRoutines.length > 0) {
        try {
          const activeChecks = await Promise.all(
            loadedRoutines.map(r =>
              workoutService.getActiveSession(r.id, token)
                .then(res => ({ routineId: r.id, session: res?.data?.active_session || null }))
                .catch(() => ({ routineId: r.id, session: null }))
            )
          );
          const activeMap = {};
          activeChecks.forEach(item => {
            if (item.session) {
              activeMap[item.routineId] = item.session;
            }
          });
          setActiveSessionsByRoutine(activeMap);
        } catch (_) {}
      } else {
        setActiveSessionsByRoutine({});
      }

      if (historyRes?.ok && Array.isArray(historyRes?.data?.sessions)) {
        const sessions = historyRes.data.sessions;
        if (sessions.length > 0) {
          setLastSession(sessions[0]);
        } else {
          setLastSession(null);
        }
        if (typeof historyRes.data.total === 'number') {
          setTotalSessionsCount(historyRes.data.total);
        } else {
          setTotalSessionsCount(sessions.length);
        }
      }
    } catch (error) {
      if (error.code === 'NETWORK_ERROR') {
        setErrorMessage('no se pudo conectar con el servidor para obtener tus datos');
      } else {
        setErrorMessage(error.message || 'error al cargar información');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Actualizar el estado de sesión activa y avisos al regresar a esta pantalla o periódicamente
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadDashboardData();
    });
    const intervalId = setInterval(() => {
      refreshUnreadNotifications();
    }, 30000);
    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, [navigation, loadDashboardData, refreshUnreadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <DashboardHeader
            title="MI ENTRENAMIENTO"
            subtitle="panel principal y seguimiento de rutinas"
          />

          {errorMessage && <StatusBanner message={errorMessage} type="error" />}
        </View>

        {loading ? (
          <LoadingSpinner message="cargando tu entrenamiento..." />
        ) : (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
          >
            {/* 0. INDICADOR DISCRETO DE NUEVOS AVISOS DEL GIMNASIO */}
            {unreadNotificationsCount > 0 && (
              <View
                style={[
                  styles.unreadNoticeBanner,
                  {
                    backgroundColor: withAlpha(colors.primary, 0.12),
                    borderColor: colors.primary
                  }
                ]}
              >
                <View style={styles.unreadNoticeTextCol}>
                  <View style={styles.unreadNoticeTitleRow}>
                    <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.unreadNoticeTitle, { color: colors.text }]}>
                      {unreadNotificationsCount === 1
                        ? '¡Tenés un nuevo aviso!'
                        : `¡Tenés ${unreadNotificationsCount} nuevos avisos!`}
                    </Text>
                  </View>
                  <Text style={[styles.unreadNoticeSubtitle, { color: colors.textSecondary }]}>
                    El administrador publicó un nuevo comunicado para el gimnasio.
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => navigation.navigate('NotificationsInbox')}
                  activeOpacity={0.85}
                  style={[
                    styles.unreadNoticeActionBtn,
                    {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary
                    }
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Ver avisos del gimnasio"
                >
                  <Text style={[styles.unreadNoticeActionText, { color: colors.primaryText }]}>
                    Ver avisos
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 1. SECCIÓN DE ESTADO RÁPIDO / RESUMEN REAL */}
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>RUTINAS ACTIVAS</Text>
                <View style={styles.summaryValueRow}>
                  <Text style={[styles.summaryValue, { color: colors.primary }]}>{routines.length}</Text>
                  <Text style={[styles.summarySubtext, { color: colors.textSecondary }]}>
                    {routines.length === 1 ? 'asignada' : 'disponibles'}
                  </Text>
                </View>
              </View>

              <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>ÚLTIMA SESIÓN</Text>
                <View style={styles.summaryValueRow}>
                  <Text style={[styles.summaryValueSmall, { color: colors.text }]}>
                    {lastSession?.session_date
                      ? formatDateAR(lastSession.session_date)
                      : 'Sin registros'}
                  </Text>
                  {lastSession && (
                    <Text style={[styles.summarySubtext, { color: colors.primary }]}>
                      ✓ completada
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* 2. SECCIÓN UNIFICADA DE RUTINAS */}
            <View style={styles.heroSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionHeading, { color: colors.text }]}>
                  RUTINAS ({routines.length})
                </Text>
              </View>

              {routines.length > 0 ? (
                <View style={isDesktop && routines.length > 1 ? styles.routinesGridDesktop : undefined}>
                  {routines.map((routine, idx) => {
                    const hasActive = Boolean(activeSessionsByRoutine[routine.id]);
                    return (
                      <Card
                        key={String(routine.id)}
                        style={[
                          styles.routineCardUnified,
                          isDesktop && routines.length > 1 && styles.routineCardDesktop,
                          hasActive && { borderColor: colors.primary, borderWidth: 1.5 }
                        ]}
                      >
                        <View style={styles.heroCardHeader}>
                          <View
                            style={[
                              styles.heroBadgeBox,
                              hasActive
                                ? { backgroundColor: withAlpha(colors.primary, 0.15) }
                                : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }
                            ]}
                          >
                            <Text
                              style={[
                                styles.heroBadgeText,
                                { color: hasActive ? colors.primary : colors.textMuted }
                              ]}
                            >
                              {hasActive ? '● EN CURSO' : `RUTINA #${idx + 1}`}
                            </Text>
                          </View>
                          {routine.trainer_name ? (
                            <Text style={[styles.heroTrainerTag, { color: colors.textSecondary }]}>
                              Prof. {routine.trainer_name}
                            </Text>
                          ) : null}
                        </View>

                        <Text style={[styles.heroRoutineName, { color: colors.text }]}>
                          {routine.name}
                        </Text>

                        {routine.description ? (
                          <Text style={[styles.heroRoutineDesc, { color: colors.textSecondary }]}>
                            {routine.description}
                          </Text>
                        ) : null}

                        {/* Fila de metadatos del plan */}
                        <View style={[styles.heroMetaRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <View style={styles.heroMetaCol}>
                            <Text style={[styles.heroMetaLabel, { color: colors.textMuted }]}>ENTRENADOR</Text>
                            <Text style={[styles.heroMetaVal, { color: colors.text }]}>
                              {routine.trainer_name || 'Staff FitManager'}
                            </Text>
                          </View>
                          <View style={styles.heroMetaColRight}>
                            <Text style={[styles.heroMetaLabel, { color: colors.textMuted }]}>EJERCICIOS</Text>
                            <Text style={[styles.heroMetaVal, { color: colors.primary }]}>
                              {typeof routine.exercises_count === 'number'
                                ? `${routine.exercises_count} ${routine.exercises_count === 1 ? 'asignado' : 'asignados'}`
                                : Array.isArray(routine.exercises)
                                ? `${routine.exercises.length} asignados`
                                : 'Ver detalle'}
                            </Text>
                          </View>
                        </View>

                        <Button
                          title={hasActive ? 'CONTINUAR ENTRENAMIENTO' : 'INICIAR ENTRENAMIENTO AHORA'}
                          variant={hasActive ? 'primary' : 'primary'}
                          onPress={() => navigation.navigate('RoutineDetail', { routineId: routine.id })}
                          style={styles.heroActionBtn}
                        />
                      </Card>
                    );
                  })}
                </View>
              ) : (
                <EmptyState
                  title="sin rutinas asignadas"
                  description="tu entrenador aún no te asignó una rutina activa. consultá periódicamente para ver tus ejercicios."
                />
              )}
            </View>

            {/* 4. GRILLA DE ACCESOS RÁPIDOS INTEGRADOS */}
            <View style={styles.quickAccessSection}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>
                ACCESOS RÁPIDOS Y RECURSOS
              </Text>

              <View style={styles.actionGrid}>
                {/* Botón Biblioteca de Técnicas */}
                <TouchableOpacity
                  onPress={() => navigation.navigate('Exercises')}
                  activeOpacity={0.85}
                  style={[styles.gridActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.gridIconCircle, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
                    <Text style={[styles.gridIcon, { color: colors.primary }]}>📖</Text>
                  </View>
                  <Text style={[styles.gridCardTitle, { color: colors.text }]}>
                    BIBLIOTECA DE TÉCNICAS
                  </Text>
                  <Text style={[styles.gridCardSub, { color: colors.textSecondary }]}>
                    Catálogo de ejercicios, posturas y músculos
                  </Text>
                  <View style={styles.gridCardFooter}>
                    <Text style={[styles.gridActionLink, { color: colors.primary }]}>EXPLORAR ➔</Text>
                  </View>
                </TouchableOpacity>

                {/* Tarjeta Informativa / Historial Real con Navegación Directa */}
                <TouchableOpacity
                  onPress={() => navigation.navigate('WorkoutHistory')}
                  activeOpacity={0.85}
                  style={[styles.gridActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.gridIconCircle, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
                    <Text style={[styles.gridIcon, { color: colors.primary }]}>📈</Text>
                  </View>
                  <Text style={[styles.gridCardTitle, { color: colors.text }]}>
                    PROGRESO E HISTORIAL
                  </Text>
                  <Text style={[styles.gridCardSub, { color: colors.textSecondary }]}>
                    {lastSession
                      ? `Último entreno: ${formatDateAR(lastSession.session_date)}`
                      : 'Gráficos de evolución, series y marcas'}
                  </Text>
                  <View style={styles.gridCardFooter}>
                    <Text style={[styles.gridActionLink, { color: colors.primary }]}>
                      VER PROGRESO ➔
                    </Text>
                  </View>
                </TouchableOpacity>

                {isDesktop && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('NotificationsInbox')}
                    activeOpacity={0.85}
                    style={[
                      styles.gridActionCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: unreadNotificationsCount > 0 ? colors.primary : colors.border,
                        borderWidth: unreadNotificationsCount > 0 ? 1.5 : 1
                      }
                    ]}
                  >
                    <View style={styles.gridCardTopRow}>
                      <View
                        style={[
                          styles.gridIconCircle,
                          { backgroundColor: withAlpha(colors.primary, 0.12), marginBottom: 0 }
                        ]}
                      >
                        <Text style={[styles.gridIcon, { color: colors.primary }]}>🔔</Text>
                      </View>
                      {unreadNotificationsCount > 0 && (
                        <View
                          style={[
                            styles.unreadBadgePill,
                            {
                              backgroundColor: withAlpha(colors.primary, 0.16),
                              borderColor: colors.primary
                            }
                          ]}
                        >
                          <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                          <Text style={[styles.unreadBadgePillText, { color: colors.primary }]}>
                            NUEVO ({unreadNotificationsCount})
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.gridCardTitle, { color: colors.text }]}>
                      AVISOS DEL GIMNASIO
                    </Text>
                    <Text style={[styles.gridCardSub, { color: colors.textSecondary }]}>
                      {unreadNotificationsCount > 0
                        ? `Tenés ${unreadNotificationsCount} ${
                            unreadNotificationsCount === 1 ? 'comunicado nuevo' : 'comunicados nuevos'
                          } sin leer`
                        : 'Novedades, comunicados y horarios especiales del gimnasio'}
                    </Text>
                    <View style={styles.gridCardFooter}>
                      <Text style={[styles.gridActionLink, { color: colors.primary }]}>
                        VER AVISOS ➔
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {!isDesktop && (
              <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('NotificationsInbox')}
                  activeOpacity={0.85}
                  style={[
                    styles.mobileNoticeBtn,
                    {
                      backgroundColor: colors.surface,
                      borderColor: unreadNotificationsCount > 0 ? colors.primary : colors.border
                    }
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Avisos del gimnasio"
                >
                  <Text style={[styles.mobileNoticeBtnText, { color: colors.text }]}>
                    🔔 AVISOS DEL GIMNASIO
                  </Text>
                  {unreadNotificationsCount > 0 ? (
                    <View
                      style={[
                        styles.unreadBadgePill,
                        {
                          backgroundColor: withAlpha(colors.primary, 0.16),
                          borderColor: colors.primary
                        }
                      ]}
                    >
                      <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                      <Text style={[styles.unreadBadgePillText, { color: colors.primary }]}>
                        NUEVO ({unreadNotificationsCount})
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.gridActionLink, { color: colors.primary }]}>VER ➔</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Espaciador final defensivo para evitar que ningún botón quede tapado */}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

export default MemberDashboardScreen;
