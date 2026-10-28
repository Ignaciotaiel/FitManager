import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { useTheme } from '../../contexto/themeContext.js';
import { useAuth } from '../../contexto/authContext.js';
import { routineService } from '../../Modules/routines/routineService.js';
import {
  Card,
  StatusBanner,
  LoadingSpinner,
  EmptyState
} from '../../Modules/components/index.js';

export function RoutineDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { routineId } = route.params || {};

  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const loadRoutineDetail = useCallback(async () => {
    if (!routineId) {
      setErrorMessage('identificador de rutina no proporcionado');
      setLoading(false);
      return;
    }

    try {
      setErrorMessage(null);
      const res = await routineService.getRoutineById(routineId, token);
      if (res?.ok && res?.data?.routine) {
        setRoutine(res.data.routine);
      }
    } catch (error) {
      if (error.status === 403) {
        setErrorMessage('no tienes permiso para ver esta rutina');
      } else if (error.status === 404) {
        setErrorMessage('la rutina solicitada no existe');
      } else if (error.code === 'NETWORK_ERROR') {
        setErrorMessage('no se pudo conectar con el servidor para obtener la rutina');
      } else {
        setErrorMessage(error.message || 'error al cargar detalle de la rutina');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [routineId, token]);

  useEffect(() => {
    loadRoutineDetail();
  }, [loadRoutineDetail]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRoutineDetail();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* barra superior con boton volver */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="volver"
          >
            <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>
              VOLVER
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            DETALLE DE RUTINA
          </Text>
        </View>

        {errorMessage && <StatusBanner message={errorMessage} type="error" />}

        {loading ? (
          <LoadingSpinner message="cargando rutina y ejercicios..." />
        ) : routine ? (
          <>
            {/* ficha principal de la rutina */}
            <Card style={styles.routineCard}>
              <Text style={[styles.routineName, { color: colors.text }]}>
                {routine.name}
              </Text>
              {routine.description ? (
                <Text style={[styles.routineDesc, { color: colors.textSecondary }]}>
                  {routine.description}
                </Text>
              ) : null}

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.metaRow}>
                {routine.trainer_name ? (
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>
                    entrenador: <Text style={{ color: colors.text, fontWeight: '700' }}>{routine.trainer_name}</Text>
                  </Text>
                ) : null}

                {routine.member_name ? (
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>
                    socio asignado: <Text style={{ color: colors.primary, fontWeight: '700' }}>{routine.member_name}</Text>
                  </Text>
                ) : (
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>
                    asignación: <Text style={{ color: colors.warning, fontWeight: '700' }}>sin socio asignado</Text>
                  </Text>
                )}
              </View>
            </Card>

            {/* listado de ejercicios incluidos */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              EJERCICIOS DE LA SESIÓN ({routine.exercises?.length || 0})
            </Text>

            {Array.isArray(routine.exercises) && routine.exercises.length > 0 ? (
              routine.exercises.map((ex, index) => (
                <Card key={String(ex.routine_exercise_id || index)} style={styles.exerciseItemCard}>
                  <View style={styles.exerciseHeader}>
                    <View style={styles.posBadge}>
                      <Text style={[styles.posText, { color: colors.primary }]}>
                        #{ex.position || index + 1}
                      </Text>
                    </View>
                    <Text style={[styles.exerciseTitle, { color: colors.text }]}>
                      {ex.name}
                    </Text>
                  </View>

                  <View style={styles.paramRow}>
                    <View style={[styles.paramBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Text style={[styles.paramLabel, { color: colors.textMuted }]}>SERIES</Text>
                      <Text style={[styles.paramValue, { color: colors.text }]}>{ex.sets_count}</Text>
                    </View>

                    <View style={[styles.paramBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Text style={[styles.paramLabel, { color: colors.textMuted }]}>REPETICIONES</Text>
                      <Text style={[styles.paramValue, { color: colors.primary }]}>{ex.reps}</Text>
                    </View>

                    {ex.muscle_group ? (
                      <View style={[styles.paramBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.paramLabel, { color: colors.textMuted }]}>MÚSCULO</Text>
                        <Text style={[styles.paramValue, { color: colors.text }]}>{ex.muscle_group}</Text>
                      </View>
                    ) : null}
                  </View>

                  {ex.description ? (
                    <Text style={[styles.exerciseTech, { color: colors.textSecondary }]}>
                      {ex.description}
                    </Text>
                  ) : null}
                </Card>
              ))
            ) : (
              <EmptyState
                title="rutina sin ejercicios"
                description="esta rutina aún no contiene ejercicios asignados."
              />
            )}
          </>
        ) : (
          <EmptyState
            title="no se encontró la rutina"
            description="la información no está disponible en este momento."
          />
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: 40
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: '800'
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900'
  },
  routineCard: {
    padding: 18,
    marginBottom: 16
  },
  routineName: {
    fontSize: 22,
    fontWeight: '900'
  },
  routineDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6
  },
  divider: {
    height: 1,
    marginVertical: 12
  },
  metaRow: {
    gap: 6
  },
  metaText: {
    fontSize: 13
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10
  },
  exerciseItemCard: {
    padding: 14,
    marginVertical: 6
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10
  },
  posBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  posText: {
    fontSize: 14,
    fontWeight: '900'
  },
  exerciseTitle: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1
  },
  paramRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  paramBox: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center'
  },
  paramLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  paramValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2
  },
  exerciseTech: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4
  }
});

export default RoutineDetailScreen;
