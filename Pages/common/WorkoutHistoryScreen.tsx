// Muestra el historial de sesiones de entrenamiento, gráficos de progreso y filtros por fecha.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ScreenProps } from '../../Scripts/navigation/types';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
  Platform,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexto/themeContext';
import { withAlpha } from '../../Styles/theme/colors';
import { useAuth } from '../../contexto/authContext';
import { workoutService } from '../../Modules/workouts/workoutService';
import {
  isoToDisplay,
  formatDateAR,
  toLocalIsoDate,
  describePeriod
} from '../../Modules/utils/dateFormat';
import {
  DashboardHeader,
  Card,
  Input,
  Button,
  StatusBanner,
  LoadingSpinner,
  EmptyState,
  DateRangeCalendarModal,
  ExerciseProgressSection
} from '../../Modules/components/index';
import type { CalendarTarget } from '../../Modules/components/DateRangeCalendarModal';
import { styles } from './WorkoutHistoryScreen.styles';

// Pantalla de historial deportivo con filtros por rutina, ejercicio y rango de fechas.
export function WorkoutHistoryScreen({ route, navigation }: ScreenProps<'WorkoutHistory'>) {
  const { colors } = useTheme();
  const { token } = useAuth();
  const targetMemberId = route?.params?.memberId; // Para cuando un trainer o admin consulta el historial de un alumno
  const targetMemberName = route?.params?.memberName;
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 768;

  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<any>(null);

  // Estados de búsqueda y filtros (rango de fechas en ISO para comparación y DD/MM/AAAA en interfaz)
  const [searchRoutine, setSearchRoutine] = useState('');
  const [searchExercise, setSearchExercise] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Calendario visual con selección directa de año y mes
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<CalendarTarget>('start');

  // Modal para ver el detalle de una sesión puntual y sus series
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      setErrorMessage(null);
      const params: Record<string, any> = { limit: 50 };
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

  const openCalendar = (target: CalendarTarget) => {
    setCalendarTarget(target);
    setCalendarVisible(true);
  };

  const handleConfirmDates = (range: { startDate: string; endDate: string }) => {
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setCalendarVisible(false);
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

  // Filtrado y búsqueda del historial en tiempo real
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // 1. Filtro por nombre de rutina
      if (searchRoutine.trim()) {
        const query = searchRoutine.toLowerCase().trim();
        const routineName = (session.routine_name || 'entrenamiento libre').toLowerCase();
        if (!routineName.includes(query)) return false;
      }

      // 2. Filtro por nombre de ejercicio
      if (searchExercise.trim()) {
        const query = searchExercise.toLowerCase().trim();
        const hasMatchingExercise = Array.isArray(session.sets) && session.sets.some(s =>
          s.exercise_name && s.exercise_name.toLowerCase().includes(query)
        );
        if (!hasMatchingExercise) return false;
      }

      // 3. Filtro por período de fechas (comparación en ISO local)
      if (startDate || endDate) {
        const sessionIso = toLocalIsoDate(session.session_date || session.created_at);
        if (!sessionIso) return false;
        if (startDate && sessionIso < startDate) return false;
        if (endDate && sessionIso > endDate) return false;
      }

      return true;
    });
  }, [sessions, searchRoutine, searchExercise, startDate, endDate]);

  const hasActiveFilters = Boolean(
    searchRoutine.trim() || searchExercise.trim() || startDate || endDate
  );

  const handleClearFilters = () => {
    setSearchRoutine('');
    setSearchExercise('');
    setStartDate('');
    setEndDate('');
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
    const formattedDate = item.session_date
      ? formatDateAR(item.session_date)
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
                backgroundColor: item.status === 'in_progress' ? withAlpha(colors.warning, 0.15) : withAlpha(colors.primary, 0.12),
                borderColor: item.status === 'in_progress' ? colors.warning : colors.primary
              }
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                { color: item.status === 'in_progress' ? colors.warning : colors.primary }
              ]}
            >
              {item.status === 'in_progress' ? 'EN CURSO' : 'FINALIZADO'}
            </Text>
          </View>
        </View>

        {/* Resumen de series, ejercicios y duración */}
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
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>DURACIÓN</Text>
            <Text style={[styles.statVal, { color: item.duration_formatted ? colors.primary : colors.textMuted }]}>
              {item.duration_formatted ? item.duration_formatted : (item.status === 'in_progress' ? 'En curso' : 'No disponible')}
            </Text>
          </View>
        </View>

        {/* Tags de ejercicios realizados */}
        {uniqueExercises.length > 0 && (
          <View style={styles.exerciseTagsRow}>
            {uniqueExercises.slice(0, 3).map((name: any, i: number) => (
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

  const listHeader = (
    <View>
      {/* Sección integrada de Evolución y Gráficos por Ejercicio */}
      {sessions.length > 0 && (
        <ExerciseProgressSection
          token={token}
          memberId={targetMemberId}
          memberName={targetMemberName}
          sessions={sessions}
        />
      )}

      {/* Barra de Filtros y Búsqueda */}
      <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.filterHeaderRow}>
          <Text style={[styles.filterHeaderTitle, { color: colors.text }]}>
            🔍 FILTROS DE SESIONES {hasActiveFilters ? `(${filteredSessions.length} resultados)` : ''}
          </Text>
          <TouchableOpacity
            onPress={() => setShowFilters(prev => !prev)}
            style={[styles.toggleFilterBtn, { borderColor: colors.border }]}
            accessibilityRole="button"
          >
            <Text style={[styles.toggleFilterText, { color: colors.primary }]}>
              {showFilters ? 'OCULTAR ▲' : 'EXPANDIR ▼'}
            </Text>
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.filterInputsContainer}>
            <Input
              label="BUSCAR POR RUTINA"
              placeholder="ej. Fuerza, Piernas, Libre"
              value={searchRoutine}
              onChangeText={setSearchRoutine}
            />
            <Input
              label="BUSCAR POR EJERCICIO"
              placeholder="ej. Press de Banca, Sentadilla"
              value={searchExercise}
              onChangeText={setSearchExercise}
            />

            {/* Selector de fecha en formato argentino DD/MM/AAAA */}
            <View style={styles.dateFilterSection}>
              <View style={styles.dateFilterLabelRow}>
                <Text style={[styles.dateFilterLabel, { color: colors.textSecondary }]}>
                  FILTRAR POR FECHA (DD/MM/AAAA)
                </Text>
                {(startDate || endDate) && (
                  <TouchableOpacity
                    onPress={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.clearDatesText, { color: colors.primary }]}>
                      BORRAR FECHAS
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.dateButtonsRow}>
                <TouchableOpacity
                  onPress={() => openCalendar('start')}
                  activeOpacity={0.85}
                  style={[
                    styles.dateBtn,
                    {
                      backgroundColor: colors.card,
                      borderColor: startDate ? colors.primary : colors.border
                    }
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="seleccionar fecha desde"
                >
                  <View style={styles.dateBtnTop}>
                    <Text style={[styles.dateBtnCaption, { color: colors.textMuted }]}>DESDE</Text>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color={startDate ? colors.primary : colors.textSecondary}
                    />
                  </View>
                  <Text
                    style={[
                      styles.dateBtnValue,
                      { color: startDate ? colors.text : colors.textMuted }
                    ]}
                  >
                    {startDate ? isoToDisplay(startDate) : 'DD/MM/AAAA'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => openCalendar('end')}
                  activeOpacity={0.85}
                  style={[
                    styles.dateBtn,
                    {
                      backgroundColor: colors.card,
                      borderColor: endDate ? colors.primary : colors.border
                    }
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="seleccionar fecha hasta"
                >
                  <View style={styles.dateBtnTop}>
                    <Text style={[styles.dateBtnCaption, { color: colors.textMuted }]}>HASTA</Text>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color={endDate ? colors.primary : colors.textSecondary}
                    />
                  </View>
                  <Text
                    style={[
                      styles.dateBtnValue,
                      { color: endDate ? colors.text : colors.textMuted }
                    ]}
                  >
                    {endDate ? isoToDisplay(endDate) : 'DD/MM/AAAA'}
                  </Text>
                </TouchableOpacity>
              </View>

              {(startDate || endDate) && (
                <Text style={[styles.periodActiveText, { color: colors.primary }]}>
                  Período: {describePeriod(startDate, endDate)}
                </Text>
              )}
            </View>

            {hasActiveFilters && (
              <Button
                title="LIMPIAR TODOS LOS FILTROS ✕"
                variant="secondary"
                onPress={handleClearFilters}
                style={styles.clearFiltersBtn}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {/* Barra superior con volver (en web de escritorio la provee WebContainer) */}
        {!isDesktopWeb && (
          <View style={styles.topNavBar}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
              accessibilityRole="button"
            >
              <Text style={[styles.backBtnText, { color: colors.text }]}>← VOLVER</Text>
            </TouchableOpacity>
          </View>
        )}

        <DashboardHeader
          title={targetMemberName ? `HISTORIAL: ${targetMemberName.toUpperCase()}` : 'HISTORIAL DE ENTRENAMIENTOS'}
          subtitle={targetMemberName ? 'seguimiento, evolución y marcas del alumno' : 'registro cronológico de tus sesiones y progreso de cargas'}
        />

        {errorMessage && <StatusBanner message={errorMessage} type="error" />}

        {loading ? (
          <LoadingSpinner message="cargando historial..." fullScreen />
        ) : (
          <FlatList
            data={filteredSessions}
            keyExtractor={item => String(item.id)}
            renderItem={renderSessionItem}
            ListHeaderComponent={listHeader}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <EmptyState
                title={hasActiveFilters ? 'sin resultados para los filtros' : 'sin entrenamientos registrados'}
                description={hasActiveFilters ? 'probá ajustando el nombre de la rutina, ejercicio o el período de fechas.' : 'cuando finalices tu primer entrenamiento, vas a poder consultar el detalle de todos tus pesos y repeticiones acá.'}
              />
            }
          />
        )}

        {/* Modal de Calendario para filtrar sesiones por fecha */}
        <DateRangeCalendarModal
          visible={calendarVisible}
          initialStartDate={startDate}
          initialEndDate={endDate}
          initialTarget={calendarTarget}
          onConfirm={handleConfirmDates}
          onClear={() => {
            setStartDate('');
            setEndDate('');
          }}
          onClose={() => setCalendarVisible(false)}
        />

        {/* Modal de Detalle Completo de una Sesión */}
        <Modal
          visible={detailModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setDetailModalVisible(false)}
        >
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalDate, { color: colors.primary }]}>
                    {selectedSession?.session_date
                      ? formatDateAR(selectedSession.session_date)
                      : 'Detalle de Sesión'}
                  </Text>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {selectedSession?.routine_name || 'Entrenamiento Libre'}
                  </Text>
                  {selectedSession?.duration_formatted ? (
                    <Text style={[styles.modalDuration, { color: colors.primary }]}>
                      ⏱ Duración total: {selectedSession.duration_formatted}
                    </Text>
                  ) : null}
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
                    (groupedSets as any[]).map((group: any) => (
                      <View key={String(group.exercise_id || group.exercise_name)} style={[styles.exerciseGroupCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
                        <View style={[styles.groupHeader, { borderBottomColor: colors.border }]}>
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

export default WorkoutHistoryScreen;
