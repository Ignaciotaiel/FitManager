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
import { exerciseService } from '../../Modules/exercises/exerciseService.js';
import {
  Card,
  Input,
  Button,
  StatusBanner,
  LoadingSpinner,
  EmptyState,
  ConfirmModal
} from '../../Modules/components/index.js';

export function ExercisesScreen({ navigation }) {
  const { colors } = useTheme();
  const { token, role } = useAuth();

  const isTrainerOrAdmin = role === 'trainer' || role === 'admin';
  const isAdmin = role === 'admin';

  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // modal para creacion / edicion de ejercicio
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null); // null = crear, objeto = editar
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMuscle, setFormMuscle] = useState('');
  const [formDifficulty, setFormDifficulty] = useState('beginner');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  // modal de confirmacion para eliminacion (solo admin)
  const [deleteModal, setDeleteModal] = useState({
    visible: false,
    exerciseId: null,
    exerciseName: '',
    loading: false
  });

  const loadExercises = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await exerciseService.getExercises({}, token);
      if (res?.ok && Array.isArray(res?.data?.exercises)) {
        setExercises(res.data.exercises);
      }
    } catch (error) {
      if (error.code === 'NETWORK_ERROR') {
        setErrorMessage('no se pudo conectar con el servidor. revisá tu conexión');
      } else {
        setErrorMessage(error.message || 'error al cargar ejercicios');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  const onRefresh = () => {
    setRefreshing(true);
    loadExercises();
  };

  // filtrado en cliente
  const filteredExercises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (e) =>
        e.name?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.muscle_group?.toLowerCase().includes(q)
    );
  }, [exercises, searchQuery]);

  // abrir modal para crear ejercicio
  const handleOpenCreate = () => {
    setEditingExercise(null);
    setFormName('');
    setFormDescription('');
    setFormMuscle('');
    setFormDifficulty('beginner');
    setFormError(null);
    setModalVisible(true);
  };

  // abrir modal para editar ejercicio precargado (trainer y admin)
  const handleOpenEdit = (ex) => {
    setEditingExercise(ex);
    setFormName(ex.name || '');
    setFormDescription(ex.description || '');
    setFormMuscle(ex.muscle_group || '');
    setFormDifficulty(ex.difficulty || 'beginner');
    setFormError(null);
    setModalVisible(true);
  };

  // guardar creacion o edicion
  const handleSaveExercise = async () => {
    if (!formName.trim()) {
      setFormError('el nombre del ejercicio es obligatorio');
      return;
    }

    setFormLoading(true);
    setFormError(null);

    const payload = {
      name: formName.trim(),
      description: formDescription.trim() || null,
      muscle_group: formMuscle.trim() || null,
      difficulty: formDifficulty
    };

    try {
      if (editingExercise) {
        // edicion mediante PATCH /api/exercises/:id
        const res = await exerciseService.updateExercise(editingExercise.id, payload, token);
        if (res?.ok && res?.data?.exercise) {
          setSuccessMessage(`ejercicio "${res.data.exercise.name}" actualizado con éxito`);
          setExercises((prev) =>
            prev.map((e) => (e.id === editingExercise.id ? res.data.exercise : e))
          );
          setModalVisible(false);
        }
      } else {
        // creacion mediante POST /api/exercises
        const res = await exerciseService.createExercise(payload, token);
        if (res?.ok && res?.data?.exercise) {
          setSuccessMessage(`ejercicio "${res.data.exercise.name}" creado con éxito`);
          setExercises((prev) => [res.data.exercise, ...prev]);
          setModalVisible(false);
        }
      }
    } catch (error) {
      setFormError(error.message || 'no fue posible guardar el ejercicio');
    } finally {
      setFormLoading(false);
    }
  };

  // apertura del modal de eliminacion (solo admin)
  const handleOpenDelete = (ex) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setDeleteModal({
      visible: true,
      exerciseId: ex.id,
      exerciseName: ex.name,
      loading: false
    });
  };

  // confirmacion de eliminacion con manejo seguro de baja logica o 409
  const handleConfirmDelete = async () => {
    if (!deleteModal.exerciseId) return;
    setDeleteModal((prev) => ({ ...prev, loading: true }));

    try {
      const res = await exerciseService.deleteExercise(deleteModal.exerciseId, token);
      if (res?.ok) {
        const msg = res.message || `ejercicio "${deleteModal.exerciseName}" eliminado con éxito`;
        setSuccessMessage(msg);
        setExercises((prev) => prev.filter((e) => e.id !== deleteModal.exerciseId));
      }
    } catch (error) {
      if (error.status === 409 || error.code === 'EXERCISE_IN_USE') {
        setErrorMessage(error.message || 'no se puede eliminar este ejercicio porque está en uso y no se permite la baja física');
      } else if (error.status === 403) {
        setErrorMessage('no tienes permisos suficientes para eliminar ejercicios (exclusivo para entrenadores y administradores)');
      } else {
        setErrorMessage(error.message || 'no fue posible eliminar el ejercicio');
      }
    } finally {
      setDeleteModal({ visible: false, exerciseId: null, exerciseName: '', loading: false });
    }
  };

  const difficultyLabels = {
    beginner: 'PRINCIPIANTE',
    intermediate: 'INTERMEDIO',
    advanced: 'AVANZADO'
  };

  const renderExerciseItem = ({ item }) => {
    return (
      <Card style={styles.exerciseCard}>
        <View style={styles.cardHeader}>
          <Text style={[styles.exerciseName, { color: colors.text }]}>
            {item.name}
          </Text>
          <View style={[styles.difficultyBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.difficultyText, { color: colors.primary }]}>
              {difficultyLabels[item.difficulty] || item.difficulty}
            </Text>
          </View>
        </View>

        {item.muscle_group ? (
          <Text style={[styles.muscleGroup, { color: colors.textSecondary }]}>
            grupo muscular: <Text style={{ color: colors.text, fontWeight: '700' }}>{item.muscle_group}</Text>
          </Text>
        ) : null}

        {item.description ? (
          <Text style={[styles.description, { color: colors.textMuted }]}>
            {item.description}
          </Text>
        ) : null}

        {/* botones de gestion para trainer y admin */}
        {isTrainerOrAdmin && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              onPress={() => handleOpenEdit(item)}
              style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel="editar ejercicio"
            >
              <Text style={[styles.actionBtnText, { color: colors.text }]}>EDITAR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleOpenDelete(item)}
              style={[styles.actionBtn, { borderColor: colors.danger, backgroundColor: colors.dangerSurface }]}
              accessibilityRole="button"
              accessibilityLabel="eliminar ejercicio"
            >
              <Text style={[styles.actionBtnText, { color: colors.danger }]}>ELIMINAR</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* barra superior fija y limpia */}
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
          BIBLIOTECA DE TÉCNICAS
        </Text>
        <View style={styles.navBarSpacer} />
      </View>

      <View style={styles.container}>

        {errorMessage && <StatusBanner message={errorMessage} type="error" />}
        {successMessage && <StatusBanner message={successMessage} type="success" />}

        {/* buscador */}
        <Input
          placeholder="buscar ejercicio por nombre o músculo..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />

        {/* boton para agregar nuevo ejercicio (solo trainer y admin) */}
        {isTrainerOrAdmin && (
          <Button
            title="+ NUEVO EJERCICIO"
            variant="primary"
            onPress={handleOpenCreate}
            style={styles.createBtn}
          />
        )}

        {loading ? (
          <LoadingSpinner message="cargando biblioteca de ejercicios..." />
        ) : (
          <FlatList
            data={filteredExercises}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderExerciseItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <EmptyState
                title="no hay ejercicios disponibles"
                description={
                  searchQuery
                    ? 'no se encontraron coincidencias para la búsqueda'
                    : isTrainerOrAdmin
                    ? 'aún no hay ejercicios cargados en la biblioteca. podés agregar el primero.'
                    : 'aún no hay ejercicios cargados en la biblioteca.'
                }
                actionTitle={isTrainerOrAdmin ? 'CREAR EJERCICIO' : undefined}
                onAction={isTrainerOrAdmin ? handleOpenCreate : undefined}
              />
            }
          />
        )}

        {/* modal de creacion / edicion de ejercicio */}
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
                  {editingExercise ? 'EDITAR EJERCICIO' : 'CREAR NUEVO EJERCICIO'}
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  {editingExercise
                    ? 'modificá los campos técnicos del ejercicio seleccionado'
                    : 'completá los datos técnicos para incorporarlo a la biblioteca'}
                </Text>

                {formError && <StatusBanner message={formError} type="error" />}

                <Input
                  label="nombre del ejercicio"
                  placeholder="ej. press de banca con barra"
                  value={formName}
                  onChangeText={setFormName}
                />

                <Input
                  label="grupo muscular"
                  placeholder="ej. pecho / pectoral mayor"
                  value={formMuscle}
                  onChangeText={setFormMuscle}
                />

                <Input
                  label="descripción o técnica (opcional)"
                  placeholder="ej. mantener la espalda apoyada y bajar al esternón"
                  value={formDescription}
                  onChangeText={setFormDescription}
                  multiline
                  numberOfLines={3}
                />

                <Text style={[styles.difficultyLabel, { color: colors.textSecondary }]}>
                  NIVEL DE DIFICULTAD
                </Text>
                <View style={styles.difficultyRow}>
                  {['beginner', 'intermediate', 'advanced'].map((lvl) => {
                    const isSelected = formDifficulty === lvl;
                    return (
                      <TouchableOpacity
                        key={lvl}
                        onPress={() => setFormDifficulty(lvl)}
                        style={[
                          styles.diffBtn,
                          {
                            borderColor: isSelected ? colors.primary : colors.border,
                            backgroundColor: isSelected ? colors.surface : 'transparent'
                          }
                        ]}
                      >
                        <Text
                          style={[
                            styles.diffBtnText,
                            { color: isSelected ? colors.primary : colors.textSecondary }
                          ]}
                        >
                          {difficultyLabels[lvl]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.modalActions}>
                  <Button
                    title="CANCELAR"
                    variant="secondary"
                    onPress={() => setModalVisible(false)}
                    style={styles.modalBtn}
                  />
                  <Button
                    title={editingExercise ? 'ACTUALIZAR' : 'GUARDAR'}
                    variant="primary"
                    onPress={handleSaveExercise}
                    loading={formLoading}
                    disabled={formLoading}
                    style={styles.modalBtn}
                  />
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* modal de confirmacion para eliminar (solo admin) */}
        <ConfirmModal
          visible={deleteModal.visible}
          title="¿eliminar ejercicio?"
          message={`esta acción eliminará "${deleteModal.exerciseName}" de la biblioteca de ejercicios.`}
          confirmText="eliminar"
          isDestructive
          loading={deleteModal.loading}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteModal({ visible: false, exerciseId: null, exerciseName: '', loading: false })}
        />
      </View>
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
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  searchInput: {
    marginVertical: 4
  },
  createBtn: {
    marginVertical: 4
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 36
  },
  exerciseCard: {
    padding: 12,
    marginVertical: 4
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    paddingRight: 8
  },
  difficultyBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1
  },
  difficultyText: {
    fontSize: 9,
    fontWeight: '800'
  },
  muscleGroup: {
    fontSize: 12,
    marginBottom: 2
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)'
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '800'
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
    fontSize: 12,
    marginBottom: 10
  },
  difficultyLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 5,
    letterSpacing: 0.5
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12
  },
  diffBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center'
  },
  diffBtnText: {
    fontSize: 10,
    fontWeight: '800'
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8
  },
  modalBtn: {
    flex: 1
  }
});

export default ExercisesScreen;
