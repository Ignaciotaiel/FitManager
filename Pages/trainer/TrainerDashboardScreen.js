import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexto/themeContext.js';
import { useAuth } from '../../contexto/authContext.js';
import { routineService } from '../../Modules/routines/routineService.js';
import { exerciseService } from '../../Modules/exercises/exerciseService.js';
import { userService } from '../../Modules/users/userService.js';
import {
  DashboardHeader,
  Card,
  Input,
  Button,
  StatusBanner,
  LoadingSpinner,
  EmptyState,
  ConfirmModal
} from '../../Modules/components/index.js';

export function TrainerDashboardScreen({ navigation }) {
  const { colors } = useTheme();
  const { token } = useAuth();

  const [routines, setRoutines] = useState([]);
  const [exercisesLibrary, setExercisesLibrary] = useState([]);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // estado para modal de creacion / edicion de rutina
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState(null); // null = crear, objeto = editar
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [selectedExercises, setSelectedExercises] = useState([]); // array de { exercise_id, name, sets_count, reps, position }
  
  // asignaciones multiples de socios
  const [selectedMemberIds, setSelectedMemberIds] = useState([]); // array de user_ids
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // busqueda en biblioteca de ejercicios
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  // modal de confirmacion para eliminar rutina
  const [deleteModal, setDeleteModal] = useState({
    visible: false,
    routineId: null,
    loading: false
  });

  const loadData = useCallback(async () => {
    try {
      setErrorMessage(null);
      // cargar rutinas del trainer, biblioteca de ejercicios y socios activos
      const [routinesRes, exercisesRes, usersRes] = await Promise.all([
        routineService.getRoutines(token),
        exerciseService.getExercises({}, token),
        userService.getUsers(token)
      ]);

      if (routinesRes?.ok && Array.isArray(routinesRes?.data?.routines)) {
        setRoutines(routinesRes.data.routines);
      }
      if (exercisesRes?.ok && Array.isArray(exercisesRes?.data?.exercises)) {
        setExercisesLibrary(exercisesRes.data.exercises);
      }
      if (usersRes?.ok && Array.isArray(usersRes?.data?.users)) {
        // filtrar solo socios
        setAvailableMembers(usersRes.data.users.filter(u => u.role === 'member'));
      }
    } catch (error) {
      if (error.code === 'NETWORK_ERROR') {
        setErrorMessage('no se pudo conectar con el servidor para sincronizar datos');
      } else {
        setErrorMessage(error.message || 'error al cargar datos');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // filtrar lista de socios segun busqueda
  const filteredMembers = useMemo(() => {
    if (!memberSearchQuery.trim()) return availableMembers;
    const q = memberSearchQuery.toLowerCase().trim();
    return availableMembers.filter(m =>
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.email && m.email.toLowerCase().includes(q))
    );
  }, [availableMembers, memberSearchQuery]);

  // filtrar biblioteca de ejercicios segun busqueda en tiempo real
  const filteredExercisesLibrary = useMemo(() => {
    if (!exerciseSearchQuery.trim()) return exercisesLibrary;
    const q = exerciseSearchQuery.toLowerCase().trim();
    return exercisesLibrary.filter(ex =>
      ex.name && ex.name.toLowerCase().includes(q)
    );
  }, [exercisesLibrary, exerciseSearchQuery]);

  // abrir modal para crear nueva rutina
  const handleOpenCreate = () => {
    setEditingRoutine(null);
    setFormName('');
    setFormDesc('');
    setSelectedMemberIds([]);
    setMemberSearchQuery('');
    setExerciseSearchQuery('');
    setSelectedExercises([]);
    setFormError(null);
    setModalVisible(true);
  };

  // abrir modal para editar rutina
  const handleOpenEdit = async (routine) => {
    setEditingRoutine(routine);
    setFormName(routine.name || '');
    setFormDesc(routine.description || '');
    
    // cargar IDs de los usuarios ya asignados
    const currentAssignedIds = Array.isArray(routine.assigned_users)
      ? routine.assigned_users.map(u => Number(u.member_id || u.id))
      : (routine.member_id ? [Number(routine.member_id)] : []);
    
    setSelectedMemberIds(currentAssignedIds);
    setMemberSearchQuery('');
    setExerciseSearchQuery('');
    setFormError(null);
    setModalVisible(true);

    // Si la rutina ya viene con lista de ejercicios, precargarlos; si no, buscarlos por getRoutineById
    if (Array.isArray(routine.exercises) && routine.exercises.length > 0) {
      setSelectedExercises(
        routine.exercises.map((e, idx) => ({
          exercise_id: e.exercise_id,
          name: e.name || 'ejercicio',
          sets_count: e.sets_count || 3,
          reps: e.reps || '10-12',
          position: e.position || idx + 1
        }))
      );
    } else {
      setSelectedExercises([]);
      try {
        const detailRes = await routineService.getRoutineById(routine.id, token);
        if (detailRes?.ok && Array.isArray(detailRes?.data?.routine?.exercises)) {
          setSelectedExercises(
            detailRes.data.routine.exercises.map((e, idx) => ({
              exercise_id: e.exercise_id,
              name: e.name || 'ejercicio',
              sets_count: e.sets_count || 3,
              reps: e.reps || '10-12',
              position: e.position || idx + 1
            }))
          );
        }
      } catch (err) {
        // no bloquear la edicion si falla temporalmente, pero reportar error en el formulario si es necesario
        console.warn('no se pudieron cargar los ejercicios previos de la rutina', err);
      }
    }
  };

  // toggle seleccion de socio
  const toggleMemberSelection = (memberId) => {
    setSelectedMemberIds(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };

  // agregar un ejercicio de la biblioteca a la rutina
  const handleAddExerciseToRoutine = (ex) => {
    if (selectedExercises.some((item) => item.exercise_id === ex.id)) {
      return; // ya seleccionado
    }

    const newPos = selectedExercises.length + 1;
    setSelectedExercises((prev) => [
      ...prev,
      {
        exercise_id: ex.id,
        name: ex.name,
        sets_count: 3,
        reps: '10-12',
        position: newPos
      }
    ]);
  };

  // remover ejercicio seleccionado
  const handleRemoveExercise = (exerciseId) => {
    setSelectedExercises((prev) =>
      prev
        .filter((item) => item.exercise_id !== exerciseId)
        .map((item, idx) => ({ ...item, position: idx + 1 }))
    );
  };

  // mover orden de un ejercicio hacia arriba o abajo
  const handleMoveExercise = (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedExercises.length) return;

    setSelectedExercises(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy.map((item, idx) => ({ ...item, position: idx + 1 }));
    });
  };

  // actualizar series o repeticiones de un ejercicio seleccionado
  const handleUpdateExerciseParam = (exerciseId, field, val) => {
    setSelectedExercises((prev) =>
      prev.map((item) => {
        if (item.exercise_id === exerciseId) {
          return { ...item, [field]: val };
        }
        return item;
      })
    );
  };

  // guardar creacion o edicion de rutina
  const handleSaveRoutine = async () => {
    if (!formName.trim()) {
      setFormError('el nombre de la rutina es obligatorio');
      return;
    }

    setFormLoading(true);
    setFormError(null);

    const formattedExercises = selectedExercises.map((e, index) => ({
      exercise_id: e.exercise_id,
      sets_count: Number(e.sets_count) || 3,
      reps: String(e.reps || '10-12').trim(),
      position: index + 1
    }));

    try {
      if (editingRoutine) {
        // edicion de metadatos, asignaciones y ejercicios mediante PATCH /api/routines/:id
        const patchPayload = {
          name: formName.trim(),
          description: formDesc.trim() || null,
          member_ids: selectedMemberIds,
          exercises: formattedExercises
        };

        const res = await routineService.updateRoutine(editingRoutine.id, patchPayload, token);
        if (res?.ok) {
          setSuccessMessage(`rutina "${formName.trim()}" actualizada con éxito (${selectedMemberIds.length} socios asignados, ${formattedExercises.length} ejercicios)`);
          setModalVisible(false);
          loadData();
        }
      } else {
        // creacion de rutina con ejercicios reales mediante POST /api/routines
        const createPayload = {
          name: formName.trim(),
          description: formDesc.trim() || null,
          member_ids: selectedMemberIds,
          exercises: formattedExercises
        };

        const res = await routineService.createRoutine(createPayload, token);

        if (res?.ok && res?.data?.routine) {
          setSuccessMessage(`rutina "${res.data.routine.name}" creada con éxito (${selectedMemberIds.length} socios asignados, ${formattedExercises.length} ejercicios)`);
          setModalVisible(false);
          loadData();
        }
      }
    } catch (error) {
      setFormError(error.message || 'no fue posible guardar la rutina');
    } finally {
      setFormLoading(false);
    }
  };

  // confirmar eliminacion segura
  const handleConfirmDelete = async () => {
    if (!deleteModal.routineId) return;
    setDeleteModal((prev) => ({ ...prev, loading: true }));

    try {
      const res = await routineService.deleteRoutine(deleteModal.routineId, token);
      if (res?.ok) {
        setSuccessMessage('rutina eliminada con éxito');
        setRoutines((prev) => prev.filter((r) => r.id !== deleteModal.routineId));
      }
    } catch (error) {
      setErrorMessage(error.message || 'no fue posible eliminar la rutina');
    } finally {
      setDeleteModal({ visible: false, routineId: null, loading: false });
    }
  };

  const totalAssignedMembers = useMemo(() => {
    const memberSet = new Set();
    routines.forEach(r => {
      if (Array.isArray(r.assigned_users)) {
        r.assigned_users.forEach(u => memberSet.add(u.member_id || u.id));
      } else if (r.member_id) {
        memberSet.add(r.member_id);
      }
    });
    return memberSet.size;
  }, [routines]);

  const renderRoutineItem = ({ item, index }) => {
    const assignedCount = Array.isArray(item.assigned_users)
      ? item.assigned_users.length
      : (item.member_id ? 1 : 0);

    return (
      <Card style={styles.routineCard}>
        <View style={styles.routineHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={styles.routineBadgeRow}>
              <Text style={[styles.routineTag, { color: colors.primary }]}>
                RUTINA #{index + 1}
              </Text>
              <View style={[
                styles.assignedBadge,
                {
                  backgroundColor: assignedCount > 0 ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255, 170, 0, 0.1)',
                  borderColor: assignedCount > 0 ? colors.primary : colors.warning
                }
              ]}>
                <Text style={[
                  styles.assignedBadgeText,
                  { color: assignedCount > 0 ? colors.primary : colors.warning }
                ]}>
                  {assignedCount > 0 ? `${assignedCount} socio(s)` : 'Plantilla'}
                </Text>
              </View>
            </View>
            <Text style={[styles.routineTitle, { color: colors.text }]}>
              {item.name}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => handleOpenEdit(item)}
              style={[styles.smallBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel="editar rutina"
            >
              <Text style={[styles.smallBtnText, { color: colors.text }]}>EDITAR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setDeleteModal({ visible: true, routineId: item.id, loading: false })}
              style={[styles.smallBtn, { borderColor: colors.danger, backgroundColor: colors.dangerSurface }]}
              accessibilityRole="button"
              accessibilityLabel="eliminar rutina"
            >
              <Text style={[styles.smallBtnText, { color: colors.danger }]}>BORRAR</Text>
            </TouchableOpacity>
          </View>
        </View>

        {item.description ? (
          <Text style={[styles.routineDesc, { color: colors.textSecondary }]}>
            {item.description}
          </Text>
        ) : null}

        {assignedCount > 0 && item.member_name ? (
          <View style={[styles.assignedBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.assignedBarLabel, { color: colors.textMuted }]}>SOCIOS:</Text>
            <Text style={[styles.assignedBarNames, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.member_name}
            </Text>
          </View>
        ) : null}

        <Button
          title="VER DETALLE Y SERIES"
          variant="secondary"
          onPress={() => navigation.navigate('RoutineDetail', { routineId: item.id })}
          style={styles.detailBtn}
        />
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <DashboardHeader
          title="PANEL DE ENTRENAMIENTO"
          subtitle="gestión de planes, ejercicios y asignaciones"
        />

        {errorMessage && <StatusBanner message={errorMessage} type="error" />}
        {successMessage && <StatusBanner message={successMessage} type="success" />}

        {/* 1. Métricas de gestión reales del entrenador */}
        <View style={styles.metricGrid}>
          <View style={[styles.metricBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>PLANES ACTIVOS</Text>
            <Text style={[styles.metricNumber, { color: colors.primary }]}>{routines.length}</Text>
          </View>
          <View style={[styles.metricBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>SOCIOS ASIGNADOS</Text>
            <Text style={[styles.metricNumber, { color: colors.text }]}>{totalAssignedMembers}</Text>
          </View>
          <View style={[styles.metricBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>TÉCNICAS</Text>
            <Text style={[styles.metricNumber, { color: colors.text }]}>{exercisesLibrary.length}</Text>
          </View>
        </View>

        {/* 2. Barra de acciones principales */}
        <View style={styles.actionRow}>
          <Button
            title="📖 BIBLIOTECA DE TÉCNICAS"
            variant="secondary"
            onPress={() => navigation.navigate('Exercises')}
            style={styles.halfBtn}
          />
          <Button
            title="+ CREAR NUEVA RUTINA"
            variant="primary"
            onPress={handleOpenCreate}
            style={styles.halfBtn}
          />
        </View>

        <View style={{ marginBottom: 12 }}>
          <Button
            title="👥 HISTORIAL DE ALUMNOS Y PROGRESO"
            variant="secondary"
            onPress={() => navigation.navigate('TrainerStudentsHistory')}
          />
        </View>

        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            PLANES DE ENTRENAMIENTO DIAGRAMADOS
          </Text>
          <View style={[styles.countBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.countText, { color: colors.primary }]}>
              {routines.length}
            </Text>
          </View>
        </View>

        {loading ? (
          <LoadingSpinner message="cargando tus rutinas..." />
        ) : (
          <FlatList
            data={routines}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderRoutineItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <EmptyState
                title="sin rutinas creadas"
                description="aún no creaste rutinas. tocá '+ CREAR NUEVA RUTINA' para diagramar un plan de entrenamiento y asignarlo a tus socios."
              />
            }
            ListFooterComponent={
              routines.length > 0 && routines.length <= 2 ? (
                <View style={styles.trainerQuickTipsCard}>
                  <View style={[styles.quickTipBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.quickTipTitle, { color: colors.primary }]}>
                      💡 GESTIÓN MULTIUSUARIO
                    </Text>
                    <Text style={[styles.quickTipDesc, { color: colors.textSecondary }]}>
                      Podés asignar una misma rutina a múltiples socios desde el botón EDITAR. Cada socio registrará sus marcas, kilos y repeticiones de forma 100% independiente.
                    </Text>
                  </View>
                </View>
              ) : null
            }
          />
        )}

        {/* modal de creacion / edicion de rutina */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}
          >
            <View style={[styles.modalContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ScrollView contentContainerStyle={styles.modalScroll}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingRoutine ? 'EDITAR RUTINA' : 'CREAR NUEVA RUTINA'}
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  {editingRoutine
                    ? 'modificá el nombre, descripción o asigná varios socios'
                    : 'diagramá el plan seleccionando ejercicios y asigná socios'}
                </Text>

                {formError && <StatusBanner message={formError} type="error" />}

                <Input
                  label="nombre de la rutina"
                  placeholder="ej. hipertrofia pecho y tríceps"
                  value={formName}
                  onChangeText={setFormName}
                />

                <Input
                  label="descripción o instrucciones"
                  placeholder="ej. descansar 90 segundos entre series pesadas"
                  value={formDesc}
                  onChangeText={setFormDesc}
                  multiline
                  numberOfLines={3}
                />

                {/* SECCION ASIGNAR USUARIOS MULTIPLES */}
                <View style={styles.assignmentSection}>
                  <View style={styles.assignmentHeader}>
                    <Text style={[styles.subSectionTitle, { color: colors.text }]}>
                      ASIGNAR SOCIOS ({selectedMemberIds.length} seleccionados)
                    </Text>
                    {selectedMemberIds.length > 0 && (
                      <TouchableOpacity onPress={() => setSelectedMemberIds([])}>
                        <Text style={[styles.clearText, { color: colors.danger }]}>DESMARCAR TODOS</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Input
                    placeholder="buscar socio por nombre o correo..."
                    value={memberSearchQuery}
                    onChangeText={setMemberSearchQuery}
                    style={{ marginVertical: 4 }}
                  />

                  <View style={[styles.membersListContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                    {availableMembers.length === 0 ? (
                      <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
                        no hay socios registrados disponibles.
                      </Text>
                    ) : filteredMembers.length === 0 ? (
                      <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
                        no se encontraron socios con esa búsqueda.
                      </Text>
                    ) : (
                      filteredMembers.map(m => {
                        const isSelected = selectedMemberIds.includes(m.id);
                        return (
                          <TouchableOpacity
                            key={String(m.id)}
                            onPress={() => toggleMemberSelection(m.id)}
                            style={[
                              styles.memberItemRow,
                              {
                                borderColor: isSelected ? colors.primary : colors.border,
                                backgroundColor: isSelected ? 'rgba(57, 255, 20, 0.08)' : 'transparent'
                              }
                            ]}
                          >
                            <View style={styles.checkboxCol}>
                              <Text style={[styles.checkboxText, { color: isSelected ? colors.primary : colors.textMuted }]}>
                                {isSelected ? '☑' : '☐'}
                              </Text>
                            </View>
                            <View style={styles.memberInfoCol}>
                              <Text style={[styles.memberNameText, { color: colors.text }]}>
                                {m.name}
                              </Text>
                              <Text style={[styles.memberEmailText, { color: colors.textSecondary }]}>
                                {m.email}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                </View>

                {/* selector de ejercicios para creacion y edicion */}
                <View style={styles.exerciseSelectorSection}>
                  <Text style={[styles.subSectionTitle, { color: colors.text }]}>
                    EJERCICIOS SELECCIONADOS ({selectedExercises.length})
                  </Text>

                  {selectedExercises.length === 0 ? (
                    <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
                      tocá un ejercicio de la lista inferior para agregarlo a esta rutina.
                    </Text>
                  ) : (
                    selectedExercises.map((item, index) => (
                      <View key={String(item.exercise_id)} style={[styles.selectedItemBox, { borderColor: colors.border }]}>
                        <View style={styles.selectedItemTop}>
                          <Text style={[styles.selectedItemName, { color: colors.text }]}>
                            #{index + 1} {item.name}
                          </Text>
                          <View style={styles.itemActionsRow}>
                            {index > 0 && (
                              <TouchableOpacity
                                onPress={() => handleMoveExercise(index, 'up')}
                                style={styles.reorderBtn}
                                accessibilityLabel="mover arriba"
                              >
                                <Text style={[styles.reorderText, { color: colors.primary }]}>▲</Text>
                              </TouchableOpacity>
                            )}
                            {index < selectedExercises.length - 1 && (
                              <TouchableOpacity
                                onPress={() => handleMoveExercise(index, 'down')}
                                style={styles.reorderBtn}
                                accessibilityLabel="mover abajo"
                              >
                                <Text style={[styles.reorderText, { color: colors.primary }]}>▼</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => handleRemoveExercise(item.exercise_id)}>
                              <Text style={[styles.removeText, { color: colors.danger, marginLeft: 8 }]}>QUITAR</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={styles.paramInputsRow}>
                          <View style={styles.paramInputWrapper}>
                            <Text style={[styles.paramInputLabel, { color: colors.textSecondary }]}>SERIES</Text>
                            <Input
                              value={String(item.sets_count)}
                              onChangeText={(val) => handleUpdateExerciseParam(item.exercise_id, 'sets_count', val)}
                              keyboardType="numeric"
                              style={{ marginVertical: 0 }}
                            />
                          </View>

                          <View style={styles.paramInputWrapper}>
                            <Text style={[styles.paramInputLabel, { color: colors.textSecondary }]}>REPETICIONES</Text>
                            <Input
                              value={item.reps}
                              onChangeText={(val) => handleUpdateExerciseParam(item.exercise_id, 'reps', val)}
                              placeholder="ej. 10-12"
                              style={{ marginVertical: 0 }}
                            />
                          </View>
                        </View>
                      </View>
                    ))
                  )}

                  <Text style={[styles.subSectionTitle, { color: colors.text, marginTop: 14 }]}>
                    BIBLIOTECA DISPONIBLE PARA AGREGAR
                  </Text>

                  {exercisesLibrary.length === 0 ? (
                    <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
                      no hay ejercicios en la biblioteca. creá uno primero desde el panel.
                    </Text>
                  ) : (
                    <>
                      <Input
                        placeholder="Buscar ejercicio por nombre..."
                        value={exerciseSearchQuery}
                        onChangeText={setExerciseSearchQuery}
                        style={{ marginVertical: 4 }}
                      />

                      {filteredExercisesLibrary.length === 0 ? (
                        <Text style={[styles.placeholderText, { color: colors.textMuted, marginTop: 8 }]}>
                          No se encontraron ejercicios
                        </Text>
                      ) : (
                        <View style={styles.libraryPicker}>
                          {filteredExercisesLibrary.map((ex) => {
                            const isAlreadyAdded = selectedExercises.some((s) => s.exercise_id === ex.id);
                            return (
                              <TouchableOpacity
                                key={String(ex.id)}
                                onPress={() => handleAddExerciseToRoutine(ex)}
                                disabled={isAlreadyAdded}
                                style={[
                                  styles.pickItemBtn,
                                  {
                                    borderColor: isAlreadyAdded ? colors.primary : colors.border,
                                    backgroundColor: isAlreadyAdded ? 'rgba(57, 255, 20, 0.1)' : colors.surface
                                  }
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.pickItemText,
                                    { color: isAlreadyAdded ? colors.primary : colors.text }
                                  ]}
                                >
                                  {isAlreadyAdded ? `✓ ${ex.name}` : `+ ${ex.name}`}
                                </Text>
                                {ex.muscle_group ? (
                                  <Text style={[styles.pickItemSub, { color: colors.textMuted }]}>
                                    {ex.muscle_group}
                                  </Text>
                                ) : null}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </>
                  )}
                </View>

                <View style={styles.modalActions}>
                  <Button
                    title="CANCELAR"
                    variant="secondary"
                    onPress={() => setModalVisible(false)}
                    style={styles.modalBtn}
                  />
                  <Button
                    title={editingRoutine ? 'ACTUALIZAR' : 'CREAR RUTINA'}
                    variant="primary"
                    onPress={handleSaveRoutine}
                    loading={formLoading}
                    disabled={formLoading}
                    style={styles.modalBtn}
                  />
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* modal de confirmacion para eliminar */}
        <ConfirmModal
          visible={deleteModal.visible}
          title="¿eliminar rutina?"
          message="esta acción eliminará la rutina y sus asignaciones. el historial de entrenamientos de los socios permanecerá intacto."
          confirmText="eliminar"
          isDestructive
          loading={deleteModal.loading}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteModal({ visible: false, routineId: null, loading: false })}
        />
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
    paddingHorizontal: 16,
    paddingTop: 8
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  metricBox: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center'
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 2,
    textAlign: 'center'
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: '900'
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4
  },
  halfBtn: {
    flex: 1
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 6
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1
  },
  countText: {
    fontSize: 11,
    fontWeight: '800'
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 36
  },
  routineCard: {
    padding: 14,
    marginVertical: 5,
    borderRadius: 12
  },
  routineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4
  },
  routineBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  routineTag: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  assignedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1
  },
  assignedBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  routineTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.2
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 2
  },
  smallBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1
  },
  smallBtnText: {
    fontSize: 10,
    fontWeight: '800'
  },
  routineDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6
  },
  assignedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    gap: 6
  },
  assignedBarLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  assignedBarNames: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1
  },
  detailBtn: {
    marginTop: 2
  },
  trainerQuickTipsCard: {
    marginTop: 14,
    marginBottom: 10
  },
  quickTipBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1
  },
  quickTipTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 4
  },
  quickTipDesc: {
    fontSize: 12,
    lineHeight: 17
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContainer: {
    width: '100%',
    maxHeight: '88%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16
  },
  modalScroll: {
    paddingBottom: 8
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 2
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: 12
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  placeholderText: {
    fontSize: 12,
    padding: 10
  },
  assignmentSection: {
    marginVertical: 10
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  clearText: {
    fontSize: 10,
    fontWeight: '800'
  },
  membersListContainer: {
    maxHeight: 180,
    borderRadius: 10,
    borderWidth: 1,
    padding: 6,
    marginTop: 4
  },
  memberItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 2
  },
  checkboxCol: {
    marginRight: 10
  },
  checkboxText: {
    fontSize: 18,
    fontWeight: '900'
  },
  memberInfoCol: {
    flex: 1
  },
  memberNameText: {
    fontSize: 13,
    fontWeight: '800'
  },
  memberEmailText: {
    fontSize: 11,
    marginTop: 1
  },
  exerciseSelectorSection: {
    marginVertical: 10
  },
  selectedItemBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginVertical: 6
  },
  selectedItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  itemActionsRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  reorderBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  reorderText: {
    fontSize: 14,
    fontWeight: '800'
  },
  selectedItemName: {
    fontSize: 14,
    fontWeight: '800'
  },
  removeText: {
    fontSize: 11,
    fontWeight: '800'
  },
  paramInputsRow: {
    flexDirection: 'row',
    gap: 8
  },
  paramInputWrapper: {
    flex: 1
  },
  paramInputLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2
  },
  libraryPicker: {
    gap: 6,
    marginTop: 6
  },
  pickItemBtn: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1
  },
  pickItemText: {
    fontSize: 13,
    fontWeight: '700'
  },
  pickItemSub: {
    fontSize: 11,
    marginTop: 2
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14
  },
  modalBtn: {
    flex: 1
  }
});

export default TrainerDashboardScreen;
