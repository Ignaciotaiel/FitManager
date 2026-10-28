import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
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

  // abrir modal para crear nueva rutina
  const handleOpenCreate = () => {
    setEditingRoutine(null);
    setFormName('');
    setFormDesc('');
    setSelectedMemberIds([]);
    setMemberSearchQuery('');
    setSelectedExercises([]);
    setFormError(null);
    setModalVisible(true);
  };

  // abrir modal para editar rutina
  const handleOpenEdit = (routine) => {
    setEditingRoutine(routine);
    setFormName(routine.name || '');
    setFormDesc(routine.description || '');
    
    // cargar IDs de los usuarios ya asignados
    const currentAssignedIds = Array.isArray(routine.assigned_users)
      ? routine.assigned_users.map(u => Number(u.member_id || u.id))
      : (routine.member_id ? [Number(routine.member_id)] : []);
    
    setSelectedMemberIds(currentAssignedIds);
    setMemberSearchQuery('');
    setSelectedExercises([]);
    setFormError(null);
    setModalVisible(true);
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

    try {
      if (editingRoutine) {
        // edicion de metadatos y asignaciones mediante PATCH /api/routines/:id
        const patchPayload = {
          name: formName.trim(),
          description: formDesc.trim() || null,
          member_ids: selectedMemberIds
        };

        const res = await routineService.updateRoutine(editingRoutine.id, patchPayload, token);
        if (res?.ok) {
          setSuccessMessage(`rutina "${formName.trim()}" actualizada con éxito (${selectedMemberIds.length} socios asignados)`);
          setModalVisible(false);
          loadData();
        }
      } else {
        // creacion de rutina con ejercicios reales mediante POST /api/routines
        const formattedExercises = selectedExercises.map((e, index) => ({
          exercise_id: e.exercise_id,
          sets_count: Number(e.sets_count) || 3,
          reps: String(e.reps || '10-12').trim(),
          position: index + 1
        }));

        const createPayload = {
          name: formName.trim(),
          description: formDesc.trim() || null,
          member_ids: selectedMemberIds,
          exercises: formattedExercises
        };

        const res = await routineService.createRoutine(createPayload, token);

        if (res?.ok && res?.data?.routine) {
          setSuccessMessage(`rutina "${res.data.routine.name}" creada con éxito (${selectedMemberIds.length} socios asignados)`);
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

  const renderRoutineItem = ({ item }) => {
    const assignedCount = Array.isArray(item.assigned_users)
      ? item.assigned_users.length
      : (item.member_id ? 1 : 0);

    return (
      <Card style={styles.routineCard}>
        <View style={styles.routineHeader}>
          <Text style={[styles.routineTitle, { color: colors.text }]}>
            {item.name}
          </Text>
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

        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            socios asignados:{' '}
            <Text style={{ color: assignedCount > 0 ? colors.primary : colors.warning, fontWeight: '700' }}>
              {assignedCount > 0 ? `${assignedCount} socio(s)` : 'sin asignar (plantilla)'}
            </Text>
          </Text>
          {assignedCount > 0 && item.member_name ? (
            <Text style={[styles.assignedNamesText, { color: colors.textSecondary }]}>
              {item.member_name}
            </Text>
          ) : null}
        </View>

        <Button
          title="VER DETALLE Y EJERCICIOS"
          variant="secondary"
          onPress={() => navigation.navigate('RoutineDetail', { routineId: item.id })}
          style={styles.detailBtn}
        />
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        <DashboardHeader
          title="PANEL DE ENTRENAMIENTO"
          subtitle="gestión de rutinas multiusuario y biblioteca de ejercicios"
        />

        {errorMessage && <StatusBanner message={errorMessage} type="error" />}
        {successMessage && <StatusBanner message={successMessage} type="success" />}

        {/* barra de accesos rapidos */}
        <View style={styles.actionRow}>
          <Button
            title="BIBLIOTECA DE EJERCICIOS"
            variant="secondary"
            onPress={() => navigation.navigate('Exercises')}
            style={styles.halfBtn}
          />
          <Button
            title="+ CREAR RUTINA"
            variant="primary"
            onPress={handleOpenCreate}
            style={styles.halfBtn}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          TUS RUTINAS CREADAS ({routines.length})
        </Text>

        {loading ? (
          <LoadingSpinner message="cargando tus rutinas..." />
        ) : (
          <FlatList
            data={routines}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderRoutineItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <EmptyState
                title="sin rutinas creadas"
                description="aún no creaste rutinas. tocá '+ CREAR RUTINA' para diagramar un plan de entrenamiento."
              />
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

                {/* selector de ejercicios solo en creacion */}
                {!editingRoutine && (
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
                            <TouchableOpacity onPress={() => handleRemoveExercise(item.exercise_id)}>
                              <Text style={[styles.removeText, { color: colors.danger }]}>QUITAR</Text>
                            </TouchableOpacity>
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
                      <View style={styles.libraryPicker}>
                        {exercisesLibrary.map((ex) => {
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
                  </View>
                )}

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
    paddingHorizontal: 20,
    paddingTop: 10
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 8
  },
  halfBtn: {
    flex: 1
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 8
  },
  listContent: {
    paddingBottom: 24
  },
  routineCard: {
    padding: 16,
    marginVertical: 6
  },
  routineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  routineTitle: {
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
    paddingRight: 8
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6
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
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8
  },
  metaRow: {
    marginBottom: 8
  },
  metaText: {
    fontSize: 12
  },
  assignedNamesText: {
    fontSize: 11,
    marginTop: 2
  },
  detailBtn: {
    marginTop: 6
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContainer: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 18
  },
  modalScroll: {
    paddingBottom: 10
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4
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
