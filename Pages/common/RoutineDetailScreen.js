import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexto/themeContext.js';
import { useAuth } from '../../contexto/authContext.js';
import { routineService } from '../../Modules/routines/routineService.js';
import { workoutService } from '../../Modules/workouts/workoutService.js';
import {
  Card,
  Input,
  Button,
  StatusBanner,
  LoadingSpinner,
  EmptyState
} from '../../Modules/components/index.js';

export function RoutineDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { token, user } = useAuth();
  const { routineId } = route.params || {};

  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Estado de sesión activa de entrenamiento
  const [activeSession, setActiveSession] = useState(null);
  const [startingSession, setStartingSession] = useState(false);
  const [registeredSets, setRegisteredSets] = useState({}); // { [routine_exercise_id]: Array of logged sets }
  const [lastLogs, setLastLogs] = useState({}); // { [exercise_id]: { weight_kg, reps_completed } }

  // Modal para registrar una serie puntual
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [targetExercise, setTargetExercise] = useState(null);
  const [inputWeight, setInputWeight] = useState('');
  const [inputReps, setInputReps] = useState('');
  const [submittingSet, setSubmittingSet] = useState(false);
  const [modalError, setModalError] = useState(null);

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

        // Si es socio, pre-cargar el último peso registrado para cada ejercicio de la rutina
        if (user?.role === 'member' && Array.isArray(res.data.routine.exercises)) {
          const logPromises = res.data.routine.exercises.map(ex =>
            workoutService.getLastExerciseLog(ex.exercise_id, token)
              .then(resp => ({ exId: ex.exercise_id, log: resp?.data?.last_log }))
              .catch(() => ({ exId: ex.exercise_id, log: null }))
          );
          const results = await Promise.all(logPromises);
          const map = {};
          results.forEach(r => {
            if (r.log) map[r.exId] = r.log;
          });
          setLastLogs(map);
        }

        // Si es socio, recuperar si ya tiene una sesión abierta activa para esta rutina
        if (user?.role === 'member') {
          try {
            const aRes = await workoutService.getActiveSession(routineId, token);
            if (aRes?.ok && aRes?.data?.active_session) {
              const session = aRes.data.active_session;
              setActiveSession(session);
              // poblar registeredSets con las series ya guardadas en esta sesión activa
              const setsMap = {};
              if (Array.isArray(session.sets) && session.sets.length > 0) {
                session.sets.forEach(st => {
                  const exTarget = res.data.routine.exercises?.find(e => e.exercise_id === st.exercise_id);
                  const key = exTarget ? exTarget.routine_exercise_id : (st.routine_exercise_id || st.exercise_id);
                  if (!setsMap[key]) setsMap[key] = [];
                  setsMap[key].push(st);
                });
              }
              setRegisteredSets(setsMap);
            } else {
              setActiveSession(null);
              setRegisteredSets({});
            }
          } catch (e) {
            // Silencioso para no bloquear la visualización de la rutina si el endpoint falla
            setActiveSession(null);
            setRegisteredSets({});
          }
        }
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
  }, [routineId, token, user?.role]);

  useEffect(() => {
    loadRoutineDetail();
  }, [loadRoutineDetail]);

  const onRefresh = () => {
    setRefreshing(true);
    setSuccessMessage(null);
    loadRoutineDetail();
  };

  // Iniciar sesion de entrenamiento
  const handleStartWorkout = async () => {
    if (startingSession) return;
    setStartingSession(true);
    setErrorMessage(null);
    try {
      const res = await workoutService.createSession(
        {
          routine_id: routine.id,
          notes: `Sesión de ${routine.name}`
        },
        token
      );
      if (res?.ok && res?.data?.session) {
        const returnedSession = res.data.session;
        setActiveSession(returnedSession);

        // Si la sesión ya existía (recuperada), poblar sus series completas
        if (returnedSession.sets_count > 0 || (Array.isArray(returnedSession.sets) && returnedSession.sets.length > 0)) {
          const setsList = Array.isArray(returnedSession.sets) && returnedSession.sets.length > 0
            ? returnedSession.sets
            : null;

          if (setsList) {
            const setsMap = {};
            setsList.forEach(st => {
              const exTarget = routine.exercises?.find(e => e.exercise_id === st.exercise_id);
              const key = exTarget ? exTarget.routine_exercise_id : (st.routine_exercise_id || st.exercise_id);
              if (!setsMap[key]) setsMap[key] = [];
              setsMap[key].push(st);
            });
            setRegisteredSets(setsMap);
          } else {
            try {
              const aRes = await workoutService.getActiveSession(routine.id, token);
              if (aRes?.ok && aRes?.data?.active_session?.sets) {
                const setsMap = {};
                aRes.data.active_session.sets.forEach(st => {
                  const exTarget = routine.exercises?.find(e => e.exercise_id === st.exercise_id);
                  const key = exTarget ? exTarget.routine_exercise_id : (st.routine_exercise_id || st.exercise_id);
                  if (!setsMap[key]) setsMap[key] = [];
                  setsMap[key].push(st);
                });
                setRegisteredSets(setsMap);
              }
            } catch (e) {}
          }
          setSuccessMessage('¡Sesión activa recuperada! Continúa registrando tus series.');
        } else {
          setRegisteredSets({});
          setSuccessMessage('¡Entrenamiento iniciado! Ya puedes registrar los kilos de tus series.');
        }
      }
    } catch (err) {
      setErrorMessage(err.message || 'no fue posible iniciar el entrenamiento');
    } finally {
      setStartingSession(false);
    }
  };

  // Abrir modal de carga de serie para un ejercicio
  const handleOpenLogModal = (exercise) => {
    setTargetExercise(exercise);
    setModalError(null);
    
    // Si hay un registro previo en este ejercicio, sugerir ese peso
    const prev = lastLogs[exercise.exercise_id];
    if (prev) {
      setInputWeight(String(prev.weight_kg));
      setInputReps(String(prev.reps_completed));
    } else {
      setInputWeight('');
      // sugerir repeticiones basadas en el target de la rutina si es un número simple
      const targetReps = parseInt(exercise.reps, 10);
      setInputReps(Number.isInteger(targetReps) && targetReps > 0 ? String(targetReps) : '10');
    }
    setLogModalVisible(true);
  };

  // Guardar serie en la sesion activa
  const handleSaveSet = async () => {
    if (!activeSession) {
      setModalError('Debes iniciar el entrenamiento primero');
      return;
    }
    const weightNum = parseFloat(inputWeight);
    if (isNaN(weightNum) || weightNum < 0) {
      setModalError('Ingresa un peso válido en kg (ej. 45 o 60.5)');
      return;
    }
    const repsNum = parseInt(inputReps, 10);
    if (isNaN(repsNum) || repsNum <= 0) {
      setModalError('Ingresa una cantidad de repeticiones válida');
      return;
    }

    setSubmittingSet(true);
    setModalError(null);

    try {
      const currentSets = registeredSets[targetExercise.routine_exercise_id] || [];
      const setNumber = currentSets.length + 1;

      const res = await workoutService.addSetToSession(
        activeSession.id,
        {
          exercise_id: targetExercise.exercise_id,
          routine_exercise_id: targetExercise.routine_exercise_id,
          set_number: setNumber,
          weight_kg: weightNum,
          reps_completed: repsNum
        },
        token
      );

      if (res?.ok && res?.data?.set) {
        const savedSet = res.data.set;
        setRegisteredSets(prev => ({
          ...prev,
          [targetExercise.routine_exercise_id]: [...(prev[targetExercise.routine_exercise_id] || []), savedSet]
        }));
        // actualizar sugerencia rápida
        setLastLogs(prev => ({
          ...prev,
          [targetExercise.exercise_id]: savedSet
        }));
        setLogModalVisible(false);
      }
    } catch (err) {
      setModalError(err.message || 'Error al guardar la serie');
    } finally {
      setSubmittingSet(false);
    }
  };

  const [finishingSession, setFinishingSession] = useState(false);

  // Finalizar formalmente la sesion activa en backend
  const handleFinishWorkout = async () => {
    if (!activeSession || finishingSession) return;
    setFinishingSession(true);
    setErrorMessage(null);
    try {
      await workoutService.finishSession(activeSession.id, token);
      setActiveSession(null);
      setRegisteredSets({});
      setSuccessMessage('¡Excelente! Sesión finalizada con éxito y registrada en tu historial.');
    } catch (err) {
      setErrorMessage(err.message || 'no fue posible finalizar la sesión');
    } finally {
      setFinishingSession(false);
    }
  };

  const assignedUsersCount = Array.isArray(routine?.assigned_users)
    ? routine.assigned_users.length
    : (routine?.member_id ? 1 : 0);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* barra superior fija con boton volver bien separado y centrado */}
      <View style={styles.topNavBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel="volver"
        >
          <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>
            ← VOLVER
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          DETALLE DE RUTINA
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('WorkoutHistory')}
          style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel="ver historial"
        >
          <Text style={[styles.backBtnText, { color: colors.primary }]}>
            HISTORIAL ⏱
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {errorMessage && <StatusBanner message={errorMessage} type="error" />}
        {successMessage && <StatusBanner message={successMessage} type="success" />}

        {loading ? (
          <LoadingSpinner message="cargando rutina y ejercicios..." />
        ) : routine ? (
          <>
            {/* ficha principal de la rutina con tarjeta estructurada */}
            <Card style={styles.routineCard}>
              <View style={styles.routineBadgeRow}>
                <View style={[styles.heroPlanTag, { backgroundColor: 'rgba(57, 255, 20, 0.1)', borderColor: colors.primary }]}>
                  <Text style={[styles.heroPlanTagText, { color: colors.primary }]}>PLAN DE ENTRENAMIENTO</Text>
                </View>
                {routine.trainer_name ? (
                  <Text style={[styles.trainerNameTag, { color: colors.textSecondary }]}>
                    Prof. {routine.trainer_name}
                  </Text>
                ) : null}
              </View>

              <Text style={[styles.routineName, { color: colors.text }]}>
                {routine.name}
              </Text>
              {routine.description ? (
                <Text style={[styles.routineDesc, { color: colors.textSecondary }]}>
                  {routine.description}
                </Text>
              ) : null}

              {/* Bloque con métricas del plan */}
              <View style={[styles.planStatsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.planStatCol}>
                  <Text style={[styles.planStatLabel, { color: colors.textMuted }]}>SOCIOS ASIGNADOS</Text>
                  <Text style={[styles.planStatVal, { color: assignedUsersCount > 0 ? colors.primary : colors.warning }]}>
                    {assignedUsersCount > 0 ? `${assignedUsersCount} socio(s)` : 'Sin asignar'}
                  </Text>
                </View>
                <View style={styles.planStatColRight}>
                  <Text style={[styles.planStatLabel, { color: colors.textMuted }]}>EJERCICIOS</Text>
                  <Text style={[styles.planStatVal, { color: colors.text }]}>
                    {routine.exercises?.length || 0} ejercicio(s)
                  </Text>
                </View>
              </View>

              {routine.member_name ? (
                <View style={[styles.membersRow, { borderColor: colors.border }]}>
                  <Text style={[styles.membersLabel, { color: colors.textMuted }]}>SOCIOS:</Text>
                  <Text style={[styles.memberNamesText, { color: colors.textSecondary }]} numberOfLines={2}>
                    {routine.member_name}
                  </Text>
                </View>
              ) : null}

              {/* Botón de Iniciar Entrenamiento exclusivo para socios */}
              {user?.role === 'member' && (
                <View style={styles.sessionControlBox}>
                  {activeSession ? (
                    <View style={styles.activeSessionBadge}>
                      <View style={styles.sessionStatusRow}>
                        <View style={styles.liveDot} />
                        <Text style={[styles.activeSessionTitle, { color: colors.primary }]}>
                          SESIÓN EN CURSO
                        </Text>
                      </View>
                      <Button
                        title="FINALIZAR ENTRENAMIENTO"
                        variant="primary"
                        onPress={handleFinishWorkout}
                        loading={finishingSession}
                        disabled={finishingSession}
                        style={{ marginTop: 8 }}
                      />
                    </View>
                  ) : (
                    <Button
                      title="INICIAR ENTRENAMIENTO Y REGISTRAR PESOS"
                      variant="primary"
                      onPress={handleStartWorkout}
                      loading={startingSession}
                      disabled={startingSession}
                      style={{ marginTop: 12 }}
                    />
                  )}
                </View>
              )}
            </Card>

            {/* listado de ejercicios incluidos */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              EJERCICIOS DE LA SESIÓN ({routine.exercises?.length || 0})
            </Text>

            {Array.isArray(routine.exercises) && routine.exercises.length > 0 ? (
              routine.exercises.map((ex, index) => {
                const prevLog = lastLogs[ex.exercise_id];
                const setsLogged = registeredSets[ex.routine_exercise_id] || [];

                return (
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
                        <Text style={[styles.paramLabel, { color: colors.textMuted }]}>OBJETIVO SERIES</Text>
                        <Text style={[styles.paramValue, { color: colors.text }]}>{ex.sets_count}</Text>
                      </View>

                      <View style={[styles.paramBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.paramLabel, { color: colors.textMuted }]}>REPETICIONES</Text>
                        <Text style={[styles.paramValue, { color: colors.primary }]}>{ex.reps}</Text>
                      </View>

                      {prevLog && (
                        <View style={[styles.paramBox, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                          <Text style={[styles.paramLabel, { color: colors.primary }]}>ÚLTIMA VEZ</Text>
                          <Text style={[styles.paramValue, { color: colors.text }]}>
                            {prevLog.weight_kg} kg x {prevLog.reps_completed}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Series registradas en esta sesion activa */}
                    {setsLogged.length > 0 && (
                      <View style={styles.completedSetsSection}>
                        <Text style={[styles.completedSetsTitle, { color: colors.primary }]}>
                          SERIES COMPLETADAS HOY:
                        </Text>
                        <View style={styles.completedSetsRow}>
                          {setsLogged.map(s => (
                            <View key={String(s.id)} style={[styles.setChip, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                              <Text style={[styles.setChipText, { color: colors.text }]}>
                                #{s.set_number}: <Text style={{ color: colors.primary, fontWeight: '800' }}>{s.weight_kg} kg</Text> x {s.reps_completed}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Boton para registrar serie si la sesion esta activa */}
                    {user?.role === 'member' && activeSession && (
                      <Button
                        title={`+ REGISTRAR SERIE #${setsLogged.length + 1}`}
                        variant="secondary"
                        onPress={() => handleOpenLogModal(ex)}
                        style={styles.logSetBtn}
                      />
                    )}

                    {ex.description ? (
                      <Text style={[styles.exerciseTech, { color: colors.textSecondary }]}>
                        {ex.description}
                      </Text>
                    ) : null}
                  </Card>
                );
              })
            ) : (
              <EmptyState
                title="rutina sin ejercicios"
                description="esta rutina aún no contiene ejercicios asignados."
              />
            )}

            {/* Guía funcional de entrenamiento para aprovechar el espacio natural */}
            <View style={[styles.guideBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.guideBoxTitle, { color: colors.primary }]}>
                💡 {user?.role === 'member' ? 'SEGUIMIENTO DE PROGRESO' : 'ADMINISTRACIÓN DEL PLAN'}
              </Text>
              <Text style={[styles.guideBoxText, { color: colors.textSecondary }]}>
                {user?.role === 'member'
                  ? 'Tocá "INICIAR ENTRENAMIENTO" para registrar los kilos y repeticiones ejecutadas en cada serie. Tus marcas se almacenan de manera independiente en tu cuenta.'
                  : 'Podés editar los ejercicios, cambiar las repeticiones y asignar o desasignar socios a este plan desde la sección principal de tu panel.'}
              </Text>
            </View>

            <View style={styles.bottomSpacer} />
          </>
        ) : (
          <EmptyState
            title="no se encontró la rutina"
            description="la información no está disponible en este momento."
          />
        )}

        {/* Modal de Carga de Serie */}
        <Modal
          visible={logModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLogModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}
          >
            <View style={[styles.modalContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                REGISTRAR SERIE
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.primary, fontWeight: '700' }]}>
                {targetExercise?.name}
              </Text>

              {modalError && <StatusBanner message={modalError} type="error" />}

              <Input
                label="PESO UTILIZADO (KG)"
                placeholder="ej. 60 o 72.5"
                value={inputWeight}
                onChangeText={setInputWeight}
                keyboardType="numeric"
              />

              <Input
                label="REPETICIONES COMPLETADAS"
                placeholder="ej. 10"
                value={inputReps}
                onChangeText={setInputReps}
                keyboardType="numeric"
              />

              <View style={styles.modalActions}>
                <Button
                  title="CANCELAR"
                  variant="secondary"
                  onPress={() => setLogModalVisible(false)}
                  style={styles.modalBtn}
                />
                <Button
                  title="GUARDAR SERIE"
                  variant="primary"
                  onPress={handleSaveSet}
                  loading={submittingSet}
                  disabled={submittingSet}
                  style={styles.modalBtn}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)'
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  navBarSpacer: {
    width: 70
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36
  },
  routineCard: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 14
  },
  routineHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  routineBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  heroPlanTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1
  },
  heroPlanTagText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  trainerNameTag: {
    fontSize: 11,
    fontWeight: '700'
  },
  routineName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.2
  },
  routineDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 10
  },
  planStatsBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginVertical: 6
  },
  planStatCol: {
    flex: 1
  },
  planStatColRight: {
    alignItems: 'flex-end'
  },
  planStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  planStatVal: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    gap: 6
  },
  membersLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  memberNamesText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1
  },
  sessionControlBox: {
    marginTop: 8
  },
  activeSessionBadge: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(57, 255, 20, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.3)',
    marginTop: 6
  },
  sessionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#39ff14'
  },
  activeSessionTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  sectionTitleRow: {
    marginTop: 4,
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  exerciseItemCard: {
    padding: 14,
    marginVertical: 5,
    borderRadius: 12
  },
  guideBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
    marginBottom: 8
  },
  guideBoxTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 4
  },
  guideBoxText: {
    fontSize: 12,
    lineHeight: 17
  },
  bottomSpacer: {
    height: 20
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6
  },
  posBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6
  },
  posText: {
    fontSize: 13,
    fontWeight: '900'
  },
  exerciseTitle: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1
  },
  paramRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'wrap'
  },
  paramBox: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center'
  },
  paramLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  paramValue: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 1
  },
  completedSetsSection: {
    marginVertical: 4,
    paddingTop: 2
  },
  completedSetsTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 3
  },
  completedSetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4
  },
  setChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1
  },
  setChipText: {
    fontSize: 11
  },
  logSetBtn: {
    marginVertical: 4
  },
  exerciseTech: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContainer: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900'
  },
  modalSubtitle: {
    fontSize: 12,
    marginBottom: 10
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10
  },
  modalBtn: {
    flex: 1
  }
});

export default RoutineDetailScreen;
