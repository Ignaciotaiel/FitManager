// Muestra el catálogo de ejercicios y técnicas con búsqueda, sincronización automática entre dispositivos y gestión para entrenadores y administradores.
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ScreenProps } from '../../Scripts/navigation/types';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  AppState,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexto/themeContext';
import { withAlpha } from '../../Styles/theme/colors';
import { useAuth } from '../../contexto/authContext';
import {
  exerciseService,
  reconcileExercisesState,
  groupExercisesByMuscleGroup,
  normalizeMuscleGroupKey,
  MuscleGroupSection
} from '../../Modules/exercises/exerciseService';
import { cleanDisplayText } from '../../Modules/utils/dateFormat';
import {
  Card,
  Input,
  Button,
  StatusBanner,
  LoadingSpinner,
  EmptyState,
  ConfirmModal
} from '../../Modules/components/index';
import { styles } from './ExercisesScreen.styles';

// Intervalo de sincronización automática mientras la Biblioteca de técnicas está activa y visible.
const EXERCISE_SYNC_INTERVAL_MS = 4000;

// Pantalla del catálogo de ejercicios con búsqueda, sincronización automática y formulario de alta/edición.
export function ExercisesScreen({ navigation }: ScreenProps<'Exercises'>) {
  const { colors } = useTheme();
  const { token, role } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 768;
  const numColumns = Platform.OS === 'web' && width >= 960 ? 2 : 1;

  const isTrainerOrAdmin = role === 'trainer' || role === 'admin';
  const isAdmin = role === 'admin';

  const [exercises, setExercises] = useState<any[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [searchCollapsedGroups, setSearchCollapsedGroups] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<any>(null);
  const [successMessage, setSuccessMessage] = useState<any>(null);

  // Referencias para sincronización silenciosa sin parpadeos ni peticiones duplicadas
  const inFlightRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);
  const isScreenFocusedRef = useRef(true);
  const isAppActiveRef = useRef(true);

  // modal para creacion / edicion de ejercicio
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExercise, setEditingExercise] = useState<any>(null); // null = crear, objeto = editar
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMuscle, setFormMuscle] = useState('');
  const [formDifficulty, setFormDifficulty] = useState('beginner');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<any>(null);

  // modal de confirmacion para eliminacion (trainer y admin)
  const [deleteModal, setDeleteModal] = useState({
    visible: false,
    exerciseId: null,
    exerciseName: '',
    loading: false
  });

  const loadExercises = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const { silent = false } = options;
      if (!token) {
        if (!silent) {
          setLoading(false);
          setRefreshing(false);
        }
        return;
      }

      // Evitar solicitudes concurrentes solapadas
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        if (!silent) {
          setErrorMessage(null);
        }
        const res = await exerciseService.getExercises({}, token);
        if (res?.ok && Array.isArray(res?.data?.exercises)) {
          hasLoadedOnceRef.current = true;
          // Reconciliación estructural: si la lista no cambió en el backend, conserva la misma referencia
          // y evita re-renderizar FlatList, parpadeos o reinicio del scroll.
          setExercises((prev) => reconcileExercisesState(prev, res.data.exercises));
          // Si había un error previo de red y la conexión se recuperó, limpiar el cartel automáticamente
          setErrorMessage(null);
        }
      } catch (error: any) {
        // En sincronizaciones silenciosas en segundo plano, si ya teníamos datos cargados,
        // conservamos la vista actual sin interrumpir al usuario y reintentamos en el próximo ciclo.
        if (!silent || !hasLoadedOnceRef.current) {
          if (error?.code === 'NETWORK_ERROR' || error?.code === 'TIMEOUT_ERROR') {
            setErrorMessage('no se pudo conectar con el servidor. revisá tu conexión');
          } else {
            setErrorMessage(error?.message || 'error al cargar ejercicios');
          }
        }
      } finally {
        inFlightRef.current = false;
        if (!silent) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [token]
  );

  // Carga inicial
  useEffect(() => {
    loadExercises({ silent: false });
  }, [loadExercises]);

  // Sincronización automática entre dispositivos mientras la pantalla está activa y visible
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      isScreenFocusedRef.current = true;
      loadExercises({ silent: hasLoadedOnceRef.current });
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      isScreenFocusedRef.current = false;
    });

    // Listener de estado de la app en dispositivos móviles (Android / iOS)
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      const isNowActive = nextState === 'active';
      const wasInactive = !isAppActiveRef.current;
      isAppActiveRef.current = isNowActive;
      if (isNowActive && wasInactive && isScreenFocusedRef.current) {
        loadExercises({ silent: true });
      }
    });

    // Listener de visibilidad y foco de ventana en Web
    const handleWebVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        isAppActiveRef.current = false;
        return;
      }
      isAppActiveRef.current = true;
      if (isScreenFocusedRef.current) {
        loadExercises({ silent: true });
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('focus', handleWebVisibilityOrFocus);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleWebVisibilityOrFocus);
      }
    }

    const intervalId = setInterval(() => {
      if (!isScreenFocusedRef.current || !isAppActiveRef.current) return;
      if (
        Platform.OS === 'web' &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      ) {
        return;
      }
      loadExercises({ silent: true });
    }, EXERCISE_SYNC_INTERVAL_MS);

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
      appStateSub.remove();
      clearInterval(intervalId);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('focus', handleWebVisibilityOrFocus);
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', handleWebVisibilityOrFocus);
        }
      }
    };
  }, [navigation, loadExercises]);

  const onRefresh = () => {
    setRefreshing(true);
    loadExercises({ silent: false });
  };

  const isSearchActive = searchQuery.trim().length > 0;

  // Al cambiar el texto de búsqueda, reiniciar las contracciones manuales temporales de búsqueda
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    setSearchCollapsedGroups({});
  }, []);

  // Secciones agrupadas por grupo muscular, ordenadas lógicamente y con ejercicios alfabéticos dentro de cada grupo
  const groupedSections = useMemo<MuscleGroupSection[]>(() => {
    return groupExercisesByMuscleGroup(exercises, searchQuery);
  }, [exercises, searchQuery]);

  // Grupos musculares existentes en toda la biblioteca para selección rápida en el formulario
  const existingMuscleGroups = useMemo<string[]>(() => {
    const allSections = groupExercisesByMuscleGroup(exercises, '');
    return allSections
      .filter((s) => s.key !== '__sin_grupo__' && s.rawMuscleGroup)
      .map((s) => s.rawMuscleGroup);
  }, [exercises]);

  const totalMatchingExercises = useMemo(() => {
    return groupedSections.reduce((acc, sec) => acc + sec.count, 0);
  }, [groupedSections]);

  // Determina si una sección está desplegada:
  // - Al ingresar sin búsqueda activa, las secciones inician contraídas para mostrar una vista limpia y ordenada.
  // - Cuando hay búsqueda activa, los grupos con coincidencias se despliegan automáticamente (pudiendo contraerse manualmente).
  const isSectionExpanded = useCallback(
    (groupKey: string): boolean => {
      if (isSearchActive) {
        return !searchCollapsedGroups[groupKey];
      }
      return Boolean(expandedGroups[groupKey]);
    },
    [isSearchActive, searchCollapsedGroups, expandedGroups]
  );

  const toggleGroupSection = useCallback(
    (groupKey: string) => {
      if (isSearchActive) {
        setSearchCollapsedGroups((prev) => ({
          ...prev,
          [groupKey]: !prev[groupKey]
        }));
      } else {
        setExpandedGroups((prev) => ({
          ...prev,
          [groupKey]: !prev[groupKey]
        }));
      }
    },
    [isSearchActive]
  );

  const areAllCurrentSectionsExpanded = useMemo(() => {
    if (groupedSections.length === 0) return false;
    return groupedSections.every((sec) => isSectionExpanded(sec.key));
  }, [groupedSections, isSectionExpanded]);

  const handleToggleAllGroups = useCallback(() => {
    const shouldExpand = !areAllCurrentSectionsExpanded;
    if (isSearchActive) {
      const nextCollapsed: Record<string, boolean> = {};
      if (!shouldExpand) {
        for (const sec of groupedSections) {
          nextCollapsed[sec.key] = true;
        }
      }
      setSearchCollapsedGroups(nextCollapsed);
    } else {
      setExpandedGroups((prev) => {
        const next = { ...prev };
        for (const sec of groupedSections) {
          next[sec.key] = shouldExpand;
        }
        return next;
      });
    }
  }, [areAllCurrentSectionsExpanded, isSearchActive, groupedSections]);

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
          const updatedItem = res.data.exercise;
          const targetGroupKey = normalizeMuscleGroupKey(updatedItem.muscle_group);
          setSuccessMessage(`ejercicio "${updatedItem.name}" actualizado con éxito`);
          setExercises((prev) =>
            reconcileExercisesState(
              prev,
              prev.map((e) => (Number(e.id) === Number(editingExercise.id) ? updatedItem : e))
            )
          );
          setExpandedGroups((prev) => ({ ...prev, [targetGroupKey]: true }));
          setModalVisible(false);
          loadExercises({ silent: true });
        }
      } else {
        // creacion mediante POST /api/exercises
        const res = await exerciseService.createExercise(payload, token);
        if (res?.ok && res?.data?.exercise) {
          const createdItem = res.data.exercise;
          const targetGroupKey = normalizeMuscleGroupKey(createdItem.muscle_group);
          setSuccessMessage(`ejercicio "${createdItem.name}" creado con éxito`);
          setExercises((prev) => reconcileExercisesState(prev, [...prev, createdItem]));
          setExpandedGroups((prev) => ({ ...prev, [targetGroupKey]: true }));
          setModalVisible(false);
          loadExercises({ silent: true });
        }
      }
    } catch (error) {
      setFormError(error.message || 'no fue posible guardar el ejercicio');
    } finally {
      setFormLoading(false);
    }
  };

  // apertura del modal de eliminacion (trainer y admin)
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
      const targetId = Number(deleteModal.exerciseId);
      const res = await exerciseService.deleteExercise(targetId, token);
      if (res?.ok) {
        const msg = res.message || `ejercicio "${deleteModal.exerciseName}" eliminado con éxito`;
        setSuccessMessage(msg);
        setExercises((prev) => prev.filter((e) => Number(e.id) !== targetId));
        loadExercises({ silent: true });
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

  const renderExerciseCard = (item: any) => {
    return (
      <Card
        key={`ex-card-${item.id}`}
        style={[
          styles.exerciseCard,
          numColumns > 1 && { flex: 1, justifyContent: 'space-between' }
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.exerciseName, { color: colors.text }]}>
            {cleanDisplayText(item.name)}
          </Text>
          <View style={[styles.difficultyBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.difficultyText, { color: colors.primary }]}>
              {difficultyLabels[item.difficulty] || item.difficulty}
            </Text>
          </View>
        </View>

        {item.muscle_group ? (
          <Text style={[styles.muscleGroup, { color: colors.textSecondary }]}>
            grupo muscular:{' '}
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {cleanDisplayText(item.muscle_group)}
            </Text>
          </Text>
        ) : null}

        {item.description ? (
          <Text style={[styles.description, { color: colors.textMuted }]}>
            {cleanDisplayText(item.description)}
          </Text>
        ) : null}

        {/* botones de gestion para trainer y admin */}
        {isTrainerOrAdmin && (
          <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
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

  const renderGroupSection = ({ item: section }: { item: MuscleGroupSection }) => {
    const isExpanded = isSectionExpanded(section.key);

    return (
      <View
        style={[
          styles.groupSectionContainer,
          {
            backgroundColor: colors.surface,
            borderColor: isExpanded ? colors.primary : colors.border
          }
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => toggleGroupSection(section.key)}
          style={[
            styles.groupHeaderTouchable,
            isExpanded && { backgroundColor: withAlpha(colors.primary, 0.08) }
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Grupo muscular ${section.title}, ${section.count} ejercicios`}
        >
          <View style={styles.groupHeaderLeft}>
            <View
              style={[
                styles.groupAccentDot,
                { backgroundColor: isExpanded ? colors.primary : colors.border }
              ]}
            />
            <Text style={[styles.groupTitleText, { color: colors.text }]} numberOfLines={1}>
              {section.title}
            </Text>
          </View>

          <View style={styles.groupHeaderRight}>
            <View
              style={[
                styles.groupCountBadge,
                {
                  backgroundColor: isExpanded
                    ? withAlpha(colors.primary, 0.16)
                    : colors.card,
                  borderColor: isExpanded ? colors.primary : colors.border
                }
              ]}
            >
              <Text
                style={[
                  styles.groupCountText,
                  { color: isExpanded ? colors.primary : colors.textSecondary }
                ]}
              >
                {section.count} {section.count === 1 ? 'ejercicio' : 'ejercicios'}
              </Text>
            </View>

            <View
              style={[
                styles.groupChevronBox,
                {
                  backgroundColor: colors.card,
                  borderColor: isExpanded ? colors.primary : colors.border
                }
              ]}
            >
              <Text
                style={[
                  styles.groupChevronText,
                  { color: isExpanded ? colors.primary : colors.textSecondary }
                ]}
              >
                {isExpanded ? '▴' : '▾'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={[styles.groupExercisesList, { borderTopColor: colors.border }]}>
            {numColumns > 1 ? (
              <View style={styles.desktopExercisesGrid}>
                {section.exercises.map((ex) => (
                  <View key={`ex-col-${ex.id}`} style={styles.desktopExerciseCol}>
                    {renderExerciseCard(ex)}
                  </View>
                ))}
              </View>
            ) : (
              section.exercises.map((ex) => renderExerciseCard(ex))
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* barra superior fija y limpia */}
      {!isDesktopWeb && (
      <View style={[styles.topNavBar, { borderBottomColor: colors.border }]}>
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
      )}

      <View style={styles.container}>

        {errorMessage && <StatusBanner message={errorMessage} type="error" />}
        {successMessage && <StatusBanner message={successMessage} type="success" />}

        {/* buscador */}
        <Input
          placeholder="buscar ejercicio por nombre o músculo..."
          value={searchQuery}
          onChangeText={handleSearchChange}
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

        {/* barra de resumen de grupos musculares y control rápido de desplegar/contraer */}
        {!loading && groupedSections.length > 0 && (
          <View style={styles.summaryToolbar}>
            <Text style={[styles.summaryToolbarText, { color: colors.textSecondary }]}>
              {isSearchActive ? 'RESULTADOS: ' : ''}
              <Text style={{ color: colors.primary }}>
                {groupedSections.length}
              </Text>{' '}
              {groupedSections.length === 1 ? 'GRUPO MUSCULAR' : 'GRUPOS MUSCULARES'} ·{' '}
              <Text style={{ color: colors.text }}>
                {totalMatchingExercises}
              </Text>{' '}
              {totalMatchingExercises === 1 ? 'EJERCICIO' : 'EJERCICIOS'}
            </Text>

            <TouchableOpacity
              onPress={handleToggleAllGroups}
              style={[
                styles.toggleAllBtn,
                { backgroundColor: colors.surface, borderColor: colors.border }
              ]}
              accessibilityRole="button"
              accessibilityLabel={areAllCurrentSectionsExpanded ? 'Contraer todos los grupos' : 'Desplegar todos los grupos'}
            >
              <Text style={[styles.toggleAllBtnText, { color: colors.primary }]}>
                {areAllCurrentSectionsExpanded ? 'CONTRAER TODO ▴' : 'DESPLEGAR TODO ▾'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <LoadingSpinner message="cargando biblioteca de ejercicios..." />
        ) : (
          <FlatList
            data={groupedSections}
            keyExtractor={(section) => section.key}
            renderItem={renderGroupSection}
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
                  placeholder="ej. pecho / espalda / hombro / pierna / triceps"
                  value={formMuscle}
                  onChangeText={setFormMuscle}
                />

                {existingMuscleGroups.length > 0 && (
                  <View style={styles.muscleQuickRow}>
                    {existingMuscleGroups.map((mg) => {
                      const isCurrentGroup =
                        normalizeMuscleGroupKey(formMuscle) === normalizeMuscleGroupKey(mg);
                      return (
                        <TouchableOpacity
                          key={`mg-chip-${mg}`}
                          onPress={() => setFormMuscle(mg)}
                          style={[
                            styles.muscleQuickChip,
                            {
                              backgroundColor: isCurrentGroup
                                ? withAlpha(colors.primary, 0.15)
                                : colors.surface,
                              borderColor: isCurrentGroup ? colors.primary : colors.border
                            }
                          ]}
                        >
                          <Text
                            style={[
                              styles.muscleQuickChipText,
                              { color: isCurrentGroup ? colors.primary : colors.textSecondary }
                            ]}
                          >
                            {mg.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

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

export default ExercisesScreen;
