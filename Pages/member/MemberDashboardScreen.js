import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexto/themeContext.js';
import { useAuth } from '../../contexto/authContext.js';
import { routineService } from '../../Modules/routines/routineService.js';
import { workoutService } from '../../Modules/workouts/workoutService.js';
import {
  DashboardHeader,
  Card,
  Button,
  StatusBanner,
  LoadingSpinner,
  EmptyState
} from '../../Modules/components/index.js';

export function MemberDashboardScreen({ navigation }) {
  const { colors } = useTheme();
  const { token, user } = useAuth();

  const [routines, setRoutines] = useState([]);
  const [activeSessionsByRoutine, setActiveSessionsByRoutine] = useState({});
  const [lastSession, setLastSession] = useState(null);
  const [totalSessionsCount, setTotalSessionsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setErrorMessage(null);
      const [routineRes, historyRes] = await Promise.all([
        routineService.getRoutines(token).catch(err => ({ ok: false, error: err })),
        workoutService.getHistory({ limit: 1 }, token).catch(() => ({ ok: false }))
      ]);

      let loadedRoutines = [];
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

  // Actualizar el estado de sesión activa al regresar a esta pantalla
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadDashboardData();
    });
    return unsubscribe;
  }, [navigation, loadDashboardData]);

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
                      ? new Date(lastSession.session_date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
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
                routines.map((routine, idx) => {
                  const hasActive = Boolean(activeSessionsByRoutine[routine.id]);
                  return (
                    <Card
                      key={String(routine.id)}
                      style={[
                        styles.routineCardUnified,
                        hasActive && { borderColor: colors.primary, borderWidth: 1.5 }
                      ]}
                    >
                      <View style={styles.heroCardHeader}>
                        <View
                          style={[
                            styles.heroBadgeBox,
                            hasActive
                              ? { backgroundColor: 'rgba(57, 255, 20, 0.15)' }
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
                            {Array.isArray(routine.exercises) ? `${routine.exercises.length} asignados` : 'Ver detalle'}
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
                })
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
                  <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(57, 255, 20, 0.12)' }]}>
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
                  <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(57, 255, 20, 0.12)' }]}>
                    <Text style={[styles.gridIcon, { color: colors.primary }]}>⏱</Text>
                  </View>
                  <Text style={[styles.gridCardTitle, { color: colors.text }]}>
                    REGISTRO DE SESIONES
                  </Text>
                  <Text style={[styles.gridCardSub, { color: colors.textSecondary }]}>
                    {lastSession
                      ? `Último entreno: ${new Date(lastSession.session_date).toLocaleDateString()}`
                      : 'Consultá tu historial de series y marcas'}
                  </Text>
                  <View style={styles.gridCardFooter}>
                    <Text style={[styles.gridActionLink, { color: colors.primary }]}>
                      VER HISTORIAL ➔
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Espaciador final defensivo para evitar que ningún botón quede tapado */}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    flex: 1
  },
  headerContainer: {
    paddingHorizontal: 16
  },
  scrollArea: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 4
  },
  summaryValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '900'
  },
  summaryValueSmall: {
    fontSize: 15,
    fontWeight: '800'
  },
  summarySubtext: {
    fontSize: 11,
    fontWeight: '700'
  },
  heroSection: {
    marginBottom: 20
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  heroCard: {
    padding: 16,
    borderWidth: 1.5,
    borderRadius: 14
  },
  heroCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  heroBadgeBox: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(57, 255, 20, 0.1)'
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  heroTrainerTag: {
    fontSize: 11,
    fontWeight: '700'
  },
  heroRoutineName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginBottom: 6
  },
  heroRoutineDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12
  },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14
  },
  heroMetaCol: {
    flex: 1
  },
  heroMetaColRight: {
    alignItems: 'flex-end'
  },
  heroMetaLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  heroMetaVal: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2
  },
  heroActionBtn: {
    marginTop: 2
  },
  routineCardUnified: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 14
  },
  secondarySection: {
    marginBottom: 20
  },
  secondaryCard: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 12
  },
  secondaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4
  },
  secondaryRoutineTag: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 2
  },
  secondaryRoutineName: {
    fontSize: 17,
    fontWeight: '800'
  },
  secondaryRoutineDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10
  },
  secondaryBtn: {
    marginTop: 4
  },
  quickAccessSection: {
    marginBottom: 16
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8
  },
  gridActionCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'space-between',
    minHeight: 140
  },
  gridIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  gridIcon: {
    fontSize: 18
  },
  gridCardTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  gridCardSub: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 8
  },
  gridCardFooter: {
    marginTop: 'auto',
    paddingTop: 6
  },
  gridActionLink: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  bottomSpacer: {
    height: 24
  }
});

export default MemberDashboardScreen;
