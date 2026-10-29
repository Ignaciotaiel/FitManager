import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexto/themeContext.js';
import { useAuth } from '../../contexto/authContext.js';
import { workoutService } from '../../Modules/workouts/workoutService.js';
import {
  DashboardHeader,
  Card,
  Button,
  StatusBanner,
  LoadingSpinner,
  EmptyState
} from '../../Modules/components/index.js';

export function WorkoutHistoryScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { token, user } = useAuth();
  const targetMemberId = route?.params?.memberId; // Para cuando un trainer o admin consulta el historial de un alumno

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Modal para ver el detalle de una sesión puntual y sus series
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      setErrorMessage(null);
      const params = { limit: 50 };
      if (targetMemberId) params.member_id = targetMemberId;

      const res = await workoutService.getHistory(params, token);
      if (res?.ok && Array.isArray(res?.data?.sessions)) {
        setSessions(res.data.sessions);
      } else {
        setSessions([]);
      }
    } catch (err) {
      if (err.status === 403) {
        setErrorMessage('no tienes permiso para ver este historial');
      } else if (err.code === 'NETWORK_ERROR') {
        setErrorMessage('no se pudo conectar con el servidor para obtener el historial');
      } else {
        setErrorMessage(err.message || 'error al cargar el historial de entrenamientos');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetMemberId, token]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  // Abrir detalle completo de una sesión
  const handleOpenDetail = async (session) => {
    setSelectedSession(session);
    setDetailModalVisible(true);
    setLoadingDetail(true);

    try {
      // Intentar traer el detalle más fresco y completo por ID
      const res = await workoutService.getSessionById(session.id, token);
      if (res?.ok && res?.data?.session) {
        setSelectedSession(res.data.session);
      }
    } catch (e) {
      // Si falla la llamada puntual, se mantiene la sesión que ya vino en la lista general con sus sets
    } finally {
      setLoadingDetail(false);
    }
  };

  // Agrupar las series de la sesión seleccionada por ejercicio para mostrarlas ordenadas
  const groupedSets = useMemo(() => {
    if (!selectedSession || !Array.isArray(selectedSession.sets)) return [];

    const map = {};
    selectedSession.sets.forEach(st => {
      const exKey = st.exercise_id || st.exercise_name;
      if (!map[exKey]) {
        map[exKey] = {
          exercise_id: st.exercise_id,
          exercise_name: st.exercise_name || 'Ejercicio',
          muscle_group: st.muscle_group,
          sets: []
        };
      }
      map[exKey].sets.push(st);
    });

    return Object.values(map);
  }, [selectedSession]);

  const renderSessionItem = ({ item }) => {
    const setsCount = Array.isArray(item.sets) ? item.sets.length : 0;
    const isCompleted = item.status === 'completed' || item.status === null; // Las sesiones históricas con NULL se tratan como pasadas
    const formattedDate = item.session_date
      ? new Date(item.session_date).toLocaleDateString(undefined, {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })
      : 'Fecha sin especificar';

    // Obtener nombres únicos de ejercicios entrenados en esta sesión
    const uniqueExercises = Array.isArray(item.sets)
      ? [...new Set(item.sets.map(s => s.exercise_name).filter(Boolean))]
      : [];

    return (
      <Card style={[styles.sessionCard, { borderColor: colors.border }]}>
        <View style={styles.sessionCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sessionDate, { color: colors.textSecondary }]}>
              {formattedDate}
            </Text>
            <Text style={[styles.routineTitle, { color: colors.text }]}>
              {item.routine_name ? item.routine_name : 'Entrenamiento Libre'}
            </Text>
          </View>

          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: item.status === 'in_progress' ? 'rgba(255, 179, 0, 0.15)' : 'rgba(57, 255, 20, 0.12)',
                borderColor: item.status === 'in_progress' ? colors.warning || '#ffb300' : colors.primary
              }
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                { color: item.status === 'in_progress' ? colors.warning || '#ffb300' : colors.primary }
              ]}
            >
              {item.status === 'in_progress' ? 'EN CURSO' : 'FINALIZADO'}
            </Text>
          </View>
        </View>

        {/* Resumen de series y ejercicios */}
        <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>SERIES LOGRADAS</Text>
            <Text style={[styles.statVal, { color: colors.primary }]}>{setsCount} series</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>EJERCICIOS</Text>
            <Text style={[styles.statVal, { color: colors.text }]}>
              {uniqueExercises.length} ejercicio(s)
            </Text>
          </View>
        </View>

        {/* Tags de ejercicios realizados */}
        {uniqueExercises.length > 0 && (
          <View style={styles.exerciseTagsRow}>
            {uniqueExercises.slice(0, 3).map((name, i) => (
              <View key={String(i)} style={[styles.tag, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.tagText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {name}
                </Text>
              </View>
            ))}
            {uniqueExercises.length > 3 && (
              <View style={[styles.tag, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.tagText, { color: colors.primary }]}>
                  +{uniqueExercises.length - 3} más
                </Text>
              </View>
            )}
          </View>
        )}

        <Button
          title="VER DETALLE Y KILOS ➔"
          variant="secondary"
          onPress={() => handleOpenDetail(item)}
          style={styles.detailBtn}
        />
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {/* Barra superior con volver */}
        <View style={styles.topNavBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            accessibilityRole="button"
          >
            <Text style={[styles.backBtnText, { color: colors.text }]}>← VOLVER</Text>
          </TouchableOpacity>
        </View>

        <DashboardHeader
          title="HISTORIAL DE ENTRENAMIENTOS"
          subtitle="registro cronológico de tus sesiones y marcas logradas"
        />

        {errorMessage && <StatusBanner message={errorMessage} type="error" />}

        {loading ? (
          <LoadingSpinner message="cargando historial..." fullScreen />
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={item => String(item.id)}
            renderItem={renderSessionItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <EmptyState
                title="sin entrenamientos registrados"
                description="cuando finalices tu primer entrenamiento, vas a poder consultar el detalle de todos tus pesos y repeticiones acá."
              />
            }
          />
        )}

        {/* Modal de Detalle Completo de una Sesión */}
        <Modal
          visible={detailModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setDetailModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalDate, { color: colors.primary }]}>
                    {selectedSession?.session_date
                      ? new Date(selectedSession.session_date).toLocaleDateString(undefined, {
                          weekday: 'long',
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })
                      : 'Detalle de Sesión'}
                  </Text>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {selectedSession?.routine_name || 'Entrenamiento Libre'}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setDetailModalVisible(false)}
                  style={[styles.modalCloseBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.modalCloseText, { color: colors.text }]}>✕</Text>
                </TouchableOpacity>
              </View>

              {loadingDetail ? (
                <LoadingSpinner message="cargando series..." />
              ) : (
                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                  {selectedSession?.notes ? (
                    <View style={[styles.notesBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={[styles.notesLabel, { color: colors.textMuted }]}>NOTAS:</Text>
                      <Text style={[styles.notesText, { color: colors.textSecondary }]}>
                        {selectedSession.notes}
                      </Text>
                    </View>
                  ) : null}

                  <Text style={[styles.detailSectionTitle, { color: colors.text }]}>
                    SERIES Y PESOS REGISTRADOS
                  </Text>

                  {groupedSets.length === 0 ? (
                    <Text style={[styles.noSetsText, { color: colors.textMuted }]}>
                      No se registraron series en esta sesión.
                    </Text>
                  ) : (
                    groupedSets.map(group => (
                      <View key={String(group.exercise_id || group.exercise_name)} style={[styles.exerciseGroupCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
                        <View style={styles.groupHeader}>
                          <Text style={[styles.groupExName, { color: colors.text }]}>
                            {group.exercise_name}
                          </Text>
                          {group.muscle_group ? (
                            <Text style={[styles.groupMuscle, { color: colors.textMuted }]}>
                              {group.muscle_group}
                            </Text>
                          ) : null}
                        </View>

                        <View style={styles.setsTable}>
                          {group.sets.map(st => (
                            <View key={String(st.id)} style={[styles.setRow, { borderColor: colors.border }]}>
                              <Text style={[styles.setNumBadge, { color: colors.primary }]}>
                                #{st.set_number}
                              </Text>
                              <Text style={[styles.setKgText, { color: colors.text }]}>
                                <Text style={{ color: colors.primary, fontWeight: '800' }}>{st.weight_kg} kg</Text>
                              </Text>
                              <Text style={[styles.setRepsText, { color: colors.textSecondary }]}>
                                {st.reps_completed} reps
                              </Text>
                              {st.rpe ? (
                                <Text style={[styles.setRpeText, { color: colors.textMuted }]}>
                                  RPE {st.rpe}
                                </Text>
                              ) : null}
                            </View>
                          ))}
                        </View>
                      </View>
                    ))
                  )}
                  <View style={{ height: 24 }} />
                </ScrollView>
              )}

              <Button
                title="CERRAR DETALLE"
                variant="secondary"
                onPress={() => setDetailModalVisible(false)}
                style={{ marginTop: 12 }}
              />
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    flex: 1,
    paddingHorizontal: 16
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4
  },
  backBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  listContent: {
    paddingBottom: 32
  },
  sessionCard: {
    marginBottom: 14,
    padding: 16,
    borderWidth: 1
  },
  sessionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  sessionDate: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4
  },
  routineTitle: {
    fontSize: 18,
    fontWeight: '800'
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  statsRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12
  },
  statBox: {
    flex: 1
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2
  },
  statVal: {
    fontSize: 14,
    fontWeight: '700'
  },
  exerciseTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14
  },
  tag: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600'
  },
  detailBtn: {
    marginTop: 4
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 16
  },
  modalCard: {
    maxHeight: '85%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 18
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 12,
    marginBottom: 14
  },
  modalDate: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800'
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '700'
  },
  modalScroll: {
    maxHeight: '75%'
  },
  notesBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2
  },
  notesText: {
    fontSize: 13,
    lineHeight: 18
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 10
  },
  noSetsText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginVertical: 12
  },
  exerciseGroupCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingBottom: 6
  },
  groupExName: {
    fontSize: 15,
    fontWeight: '800'
  },
  groupMuscle: {
    fontSize: 12,
    fontWeight: '600'
  },
  setsTable: {
    gap: 6
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  setNumBadge: {
    fontSize: 13,
    fontWeight: '800',
    width: 40
  },
  setKgText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1
  },
  setRepsText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center'
  },
  setRpeText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    width: 60
  }
});

export default WorkoutHistoryScreen;
