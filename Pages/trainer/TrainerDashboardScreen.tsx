// Muestra el panel principal del entrenador para crear, editar y asignar planes de entrenamiento.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexto/themeContext';
import { withAlpha } from '../../Styles/theme/colors';
import { useAuth } from '../../contexto/authContext';
import { routineService } from '../../Modules/routines/routineService';
import {
  exerciseService,
  reconcileExercisesState
} from '../../Modules/exercises/exerciseService';
import { userService } from '../../Modules/users/userService';
import { adminService } from '../../Modules/admin/adminService';
import {
  DashboardHeader,
  Card,
  Input,
  Button,
  StatusBanner,
  LoadingSpinner,
  EmptyState,
  ConfirmModal,
  MemberPickerModal
} from '../../Modules/components/index';
import { styles } from './TrainerDashboardScreen.styles';

// Pantalla principal del entrenador con métricas, creador de rutinas y selector de socios.
export function TrainerDashboardScreen({ navigation }: ScreenProps<'TrainerDashboard'>) {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 960;
  const numColumns = isDesktop ? 2 : 1;

  const [routines, setRoutines] = useState<any[]>([]);
  const [exercisesLibrary, setExercisesLibrary] = useState<any[]>([]);
  const [availableMembers, setAvailableMembers] = useState<any[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<any>(null);
  const [successMessage, setSuccessMessage] = useState<any>(null);

  // estado para modal de creacion / edicion de rutina
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<any>(null); // null = crear, objeto = editar
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<any[]>([]); // array de { exercise_id, name, sets_count, reps, position }
  
  // asignaciones multiples de socios
  const [selectedMemberIds, setSelectedMemberIds] = useState<any[]>([]); // array de user_ids
  const [memberPickerVisible, setMemberPickerVisible] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  // busqueda en biblioteca de ejercicios
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<any>(null);

  // modal de confirmacion para eliminar rutina
  const [deleteModal, setDeleteModal] = useState({
    visible: false,
    routineId: null,
    loading: false
  });

  // Sincroniza la cantidad de avisos no leídos para el entrenador sin recargar todo el panel.
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

  const loadData = useCallback(async () => {
    try {
      setErrorMessage(null);
      // cargar rutinas del trainer, biblioteca de ejercicios, socios activos y avisos vigentes
      const [routinesRes, exercisesRes, usersRes, notifRes] = await Promise.all([
        routineService.getRoutines(token),
        exerciseService.getExercises({}, token),
        userService.getUsers(token),
        adminService.getActiveNotifications(token).catch(() => ({ ok: false, data: undefined }))
      ]);

      if (notifRes?.ok && notifRes?.data) {
        const list = Array.isArray(notifRes.data.notifications) ? notifRes.data.notifications : [];
        const unread =
          typeof notifRes.data.unread_count === 'number'
            ? notifRes.data.unread_count
            : list.filter((n: any) => !n.is_read).length;
        setUnreadNotificationsCount(unread);
      }

      if (routinesRes?.ok && Array.isArray(routinesRes?.data?.routines)) {
        setRoutines(routinesRes.data.routines);
      }
      if (exercisesRes?.ok && Array.isArray(exercisesRes?.data?.exercises)) {
        setExercisesLibrary((prev) => reconcileExercisesState(prev, exercisesRes.data.exercises));
      }
      if (usersRes?.ok && Array.isArray(usersRes?.data?.users)) {
        // filtrar solo socios activos (el backend rechaza asignar rutinas a socios inactivos)
        setAvailableMembers(
          usersRes.data.users.filter(
            u => u.role === 'member' && (u.is_active === 1 || u.is_active === true)
          )
        );
        setMembersError(null);
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

  const reloadExercises = useCallback(async () => {
    if (!token) return;
    try {
      const exercisesRes = await exerciseService.getExercises({}, token);
      if (exercisesRes?.ok && Array.isArray(exercisesRes?.data?.exercises)) {
        setExercisesLibrary((prev) => reconcileExercisesState(prev, exercisesRes.data.exercises));
      }
    } catch (err) {
      // mantener la biblioteca previa si falla una recarga puntual en segundo plano
    }
  }, [token]);

  const reloadMembers = useCallback(async () => {
    try {
      setMembersLoading(true);
      setMembersError(null);
      const usersRes = await userService.getUsers(token);
      if (usersRes?.ok && Array.isArray(usersRes?.data?.users)) {
        setAvailableMembers(
          usersRes.data.users.filter(
            u => u.role === 'member' && (u.is_active === 1 || u.is_active === true)
          )
        );
      }
    } catch (err: any) {
      setMembersError(err?.message || 'no se pudieron cargar los socios disponibles');
    } finally {
      setMembersLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sincronizar rutinas, catálogo de técnicas/ejercicios y avisos al regresar al panel o periódicamente
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    const intervalId = setInterval(() => {
      refreshUnreadNotifications();
      reloadExercises();
    }, 30000);
    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, [navigation, loadData, refreshUnreadNotifications, reloadExercises]);

  // Si el modal de crear/editar rutina está abierto, sincronizar técnicas cada 4 segundos sin parpadeos
  useEffect(() => {
    if (!modalVisible) return;
    const modalIntervalId = setInterval(() => {
      reloadExercises();
    }, 4000);
    return () => clearInterval(modalIntervalId);
  }, [modalVisible, reloadExercises]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // lista de objetos socio seleccionados para mostrar chips de resumen
  const selectedMembersList = useMemo(() => {
    const normalizedIds = selectedMemberIds.map(Number);
    return availableMembers.filter(m => normalizedIds.includes(Number(m.id)));
  }, [availableMembers, selectedMemberIds]);

  // filtrar biblioteca de ejercicios segun busqueda en tiempo real (por nombre, grupo muscular o descripcion, ignorando tildes)
  const filteredExercisesLibrary = useMemo(() => {
    if (!exerciseSearchQuery.trim()) return exercisesLibrary;
    const normalizeSearch = (str: string) =>
      String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    const q = normalizeSearch(exerciseSearchQuery);
    return exercisesLibrary.filter(ex => {
      const nameMatch = ex.name && normalizeSearch(ex.name).includes(q);
      const groupMatch = ex.muscle_group && normalizeSearch(ex.muscle_group).includes(q);
      const descMatch = ex.description && normalizeSearch(ex.description).includes(q);
      return Boolean(nameMatch || groupMatch || descMatch);
    });
  }, [exercisesLibrary, exerciseSearchQuery]);

  // abrir modal para crear nueva rutina
  const handleOpenCreate = () => {
    setEditingRoutine(null);
    setFormName('');
    setFormDesc('');
    setSelectedMemberIds([]);
    setMemberPickerVisible(false);
    setExerciseSearchQuery('');
    setSelectedExercises([]);
    setFormError(null);
    setModalVisible(true);
    reloadExercises();
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
    setMemberPickerVisible(false);
    setExerciseSearchQuery('');
    setFormError(null);
    setModalVisible(true);
    reloadExercises();

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
    const numericId = Number(memberId);
    setSelectedMemberIds(prev => {
      const normalized = prev.map(Number);
      if (normalized.includes(numericId)) {
        return normalized.filter(id => id !== numericId);
      } else {
        return [...normalized, numericId];
      }
    });
  };

  // agregar un ejercicio de la biblioteca a la rutina
  const handleAddExerciseToRoutine = (ex) => {
    const targetId = Number(ex.id);
    if (selectedExercises.some((item) => Number(item.exercise_id) === targetId)) {
      return; // ya seleccionado
    }

    const newPos = selectedExercises.length + 1;
    setSelectedExercises((prev) => [
      ...prev,
      {
        exercise_id: targetId,
        name: ex.name,
        sets_count: 3,
        reps: '10-12',
        position: newPos
      }
    ]);
  };

  // remover ejercicio seleccionado
  const handleRemoveExercise = (exerciseId) => {
    const targetId = Number(exerciseId);
    setSelectedExercises((prev) =>
      prev
        .filter((item) => Number(item.exercise_id) !== targetId)
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
    const targetId = Number(exerciseId);
    setSelectedExercises((prev) =>
      prev.map((item) => {
        if (Number(item.exercise_id) === targetId) {
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
      <Card style={[styles.routineCard, isDesktop && styles.routineCardDesktop]}>
        <View style={styles.routineHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={styles.routineBadgeRow}>
              <Text style={[styles.routineTag, { color: colors.primary }]}>
                RUTINA #{index + 1}
              </Text>
              <View style={[
                styles.assignedBadge,
                {
                  backgroundColor: assignedCount > 0 ? withAlpha(colors.primary, 0.12) : withAlpha(colors.warning, 0.12),
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
              {typeof item.exercises_count === 'number' && (
                <View
                  style={[
                    styles.assignedBadge,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border
                    }
                  ]}
                >
                  <Text style={[styles.assignedBadgeText, { color: colors.textSecondary }]}>
                    {item.exercises_count} {item.exercises_count === 1 ? 'ejercicio' : 'ejercicios'}
                  </Text>
                </View>
              )}
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

        {/* 0. Indicador discreto de nuevos avisos del gimnasio */}
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
        {isDesktop ? (
          <View style={styles.desktopToolbar}>
            <Button
              title="+ CREAR NUEVA RUTINA"
              variant="primary"
              onPress={handleOpenCreate}
              style={styles.desktopToolbarBtn}
            />
            <Button
              title="📖 BIBLIOTECA DE TÉCNICAS"
              variant="secondary"
              onPress={() => navigation.navigate('Exercises')}
              style={styles.desktopToolbarBtn}
            />
            <Button
              title="👥 HISTORIAL DE ALUMNOS Y PROGRESO"
              variant="secondary"
              onPress={() => navigation.navigate('TrainerStudentsHistory')}
              style={styles.desktopToolbarBtn}
            />
            <TouchableOpacity
              onPress={() => navigation.navigate('NotificationsInbox')}
              activeOpacity={0.85}
              style={[
                styles.desktopToolbarBtn,
                styles.noticeAccessBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: unreadNotificationsCount > 0 ? colors.primary : colors.border
                }
              ]}
              accessibilityRole="button"
              accessibilityLabel="Avisos del gimnasio"
            >
              <Text style={[styles.noticeAccessBtnText, { color: colors.text }]}>
                🔔 AVISOS DEL GIMNASIO
              </Text>
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
            </TouchableOpacity>
          </View>
        ) : (
          <>
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

            <View style={{ marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => navigation.navigate('NotificationsInbox')}
                activeOpacity={0.85}
                style={[
                  styles.noticeAccessBtn,
                  {
                    backgroundColor: colors.surface,
                    borderColor: unreadNotificationsCount > 0 ? colors.primary : colors.border
                  }
                ]}
                accessibilityRole="button"
                accessibilityLabel="Avisos del gimnasio"
              >
                <Text style={[styles.noticeAccessBtnText, { color: colors.text }]}>
                  🔔 AVISOS DEL GIMNASIO
                </Text>
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
              </TouchableOpacity>
            </View>
          </>
        )}

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
            key={String(numColumns)}
            numColumns={numColumns}
            columnWrapperStyle={numColumns > 1 ? styles.routineColumnsWrapper : undefined}
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
              ) : undefined
            }
          />
        )}

        {/* modal de creacion / edicion de rutina */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => {
            if (memberPickerVisible) {
              setMemberPickerVisible(false);
            } else {
              setModalVisible(false);
            }
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}
          >
            <View style={[styles.modalContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {memberPickerVisible ? (
                <MemberPickerModal
                  inline
                  visible={memberPickerVisible}
                  members={availableMembers}
                  selectedIds={selectedMemberIds}
                  onToggle={toggleMemberSelection}
                  onClear={() => setSelectedMemberIds([])}
                  onClose={() => setMemberPickerVisible(false)}
                  loading={membersLoading}
                  error={membersError}
                  onRetry={reloadMembers}
                />
              ) : (
                <ScrollView
                  contentContainerStyle={styles.modalScroll}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
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

                  {/* SECCION ASIGNAR USUARIOS MULTIPLES (abre en panel dedicado sin invadir ejercicios) */}
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

                    <TouchableOpacity
                      onPress={() => setMemberPickerVisible(true)}
                      activeOpacity={0.85}
                      style={[
                        styles.memberPickerTrigger,
                        {
                          borderColor: selectedMemberIds.length > 0 ? colors.primary : colors.border,
                          backgroundColor: colors.surface
                        }
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="abrir selector de socios"
                    >
                      <View style={styles.memberPickerTriggerLeft}>
                        <View
                          style={[
                            styles.memberPickerIconWrap,
                            { backgroundColor: withAlpha(colors.primary, 0.14) }
                          ]}
                        >
                          <Ionicons name="people-outline" size={18} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.memberPickerTriggerTitle, { color: colors.text }]}>
                            {selectedMemberIds.length === 0
                              ? 'Seleccionar socios para esta rutina'
                              : `${selectedMemberIds.length} ${selectedMemberIds.length === 1 ? 'socio seleccionado' : 'socios seleccionados'}`}
                          </Text>
                          <Text style={[styles.memberPickerTriggerSub, { color: colors.textSecondary }]}>
                            tocá para buscar por nombre o correo ({availableMembers.length} disponibles)
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                    </TouchableOpacity>

                    {selectedMembersList.length > 0 && (
                      <View
                        style={[
                          styles.selectedMembersChipsWrap,
                          { borderColor: colors.border, backgroundColor: colors.surface }
                        ]}
                      >
                        {selectedMembersList.map((member) => (
                          <View
                            key={String(member.id)}
                            style={[
                              styles.memberChip,
                              {
                                borderColor: colors.primary,
                                backgroundColor: withAlpha(colors.primary, 0.12)
                              }
                            ]}
                          >
                            <Text
                              style={[styles.memberChipText, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {member.name || member.email}
                            </Text>
                            <TouchableOpacity
                              onPress={() => toggleMemberSelection(member.id)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              accessibilityLabel={`quitar a ${member.name || member.email}`}
                            >
                              <Ionicons name="close-circle" size={16} color={colors.primary} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
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
                        placeholder="Buscar técnica por nombre o grupo muscular..."
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
                            const isAlreadyAdded = selectedExercises.some((s) => Number(s.exercise_id) === Number(ex.id));
                            return (
                              <TouchableOpacity
                                key={String(ex.id)}
                                onPress={() => handleAddExerciseToRoutine(ex)}
                                disabled={isAlreadyAdded}
                                style={[
                                  styles.pickItemBtn,
                                  {
                                    borderColor: isAlreadyAdded ? colors.primary : colors.border,
                                    backgroundColor: isAlreadyAdded ? withAlpha(colors.primary, 0.12) : colors.surface
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
              )}
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

export default TrainerDashboardScreen;
