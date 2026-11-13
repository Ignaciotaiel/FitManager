// Permite al administrador supervisar todas las rutinas del gimnasio filtrando por entrenador o socio.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ScreenProps } from '../../Scripts/navigation/types';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexto/themeContext';
import { withAlpha } from '../../Styles/theme/colors';
import { useAuth } from '../../contexto/authContext';
import { routineService } from '../../Modules/routines/routineService';
import { formatDateAR } from '../../Modules/utils/dateFormat';
import {
  ScreenTopBar,
  Card,
  Input,
  Button,
  FilterChips,
  StatusBanner,
  LoadingSpinner,
  EmptyState
} from '../../Modules/components/index';
import { styles } from './AdminRoutinesScreen.styles';

type AssignmentFilter = 'all' | 'assigned' | 'unassigned';

const ASSIGNMENT_OPTIONS: Array<{ value: AssignmentFilter; label: string }> = [
  { value: 'all', label: 'TODAS' },
  { value: 'assigned', label: 'CON SOCIOS' },
  { value: 'unassigned', label: 'SIN ASIGNAR' }
];

// Pantalla de supervisión de rutinas creadas por entrenadores y socios asignados.
export function AdminRoutinesScreen({ navigation }: ScreenProps<'AdminRoutines'>) {
  const { colors } = useTheme();
  const { token } = useAuth();

  const [routines, setRoutines] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all');
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('all');

  const loadRoutines = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await routineService.getRoutines(token);
      if (res?.ok && Array.isArray(res?.data?.routines)) {
        setRoutines(res.data.routines);
      } else {
        setRoutines([]);
      }
    } catch (error: any) {
      if (error?.code === 'NETWORK_ERROR') {
        setErrorMessage('no se pudo conectar con el servidor para obtener las rutinas');
      } else {
        setErrorMessage(error?.message || 'error al cargar rutinas del gimnasio');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadRoutines();
  }, [loadRoutines]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRoutines();
  };

  // Lista dinámica de entrenadores presentes en las rutinas
  const trainerOptions = useMemo(() => {
    const map = new Map<string, string>();
    routines.forEach((r) => {
      if (r.trainer_id && r.trainer_name) {
        map.set(String(r.trainer_id), String(r.trainer_name));
      }
    });
    const opts: Array<{ value: string; label: string }> = [{ value: 'all', label: 'TODOS LOS PROFESORES' }];
    map.forEach((name, id) => {
      opts.push({ value: id, label: `PROF. ${name.toUpperCase()}` });
    });
    return opts;
  }, [routines]);

  const filteredRoutines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return routines.filter((r) => {
      const assignedCount = Array.isArray(r.assigned_users)
        ? r.assigned_users.length
        : r.member_id
        ? 1
        : 0;

      if (assignmentFilter === 'assigned' && assignedCount === 0) return false;
      if (assignmentFilter === 'unassigned' && assignedCount > 0) return false;

      if (selectedTrainerId !== 'all' && String(r.trainer_id) !== selectedTrainerId) {
        return false;
      }

      if (!q) return true;

      const nameMatch = String(r.name || '').toLowerCase().includes(q);
      const descMatch = String(r.description || '').toLowerCase().includes(q);
      const trainerMatch = String(r.trainer_name || '').toLowerCase().includes(q);
      const memberMatch = Array.isArray(r.assigned_users)
        ? r.assigned_users.some(
            (u: any) =>
              String(u.member_name || '').toLowerCase().includes(q) ||
              String(u.member_email || '').toLowerCase().includes(q)
          )
        : String(r.member_name || '').toLowerCase().includes(q);

      return nameMatch || descMatch || trainerMatch || memberMatch;
    });
  }, [routines, searchQuery, assignmentFilter, selectedTrainerId]);

  const totalAssignedMembers = useMemo(() => {
    const uniqueMembers = new Set<number>();
    routines.forEach((r) => {
      if (Array.isArray(r.assigned_users)) {
        r.assigned_users.forEach((u: any) => {
          if (u.member_id) uniqueMembers.add(Number(u.member_id));
        });
      } else if (r.member_id) {
        uniqueMembers.add(Number(r.member_id));
      }
    });
    return uniqueMembers.size;
  }, [routines]);

  const renderRoutineItem = ({ item }: { item: any }) => {
    const assignedUsers = Array.isArray(item.assigned_users) ? item.assigned_users : [];
    const assignedCount = assignedUsers.length || (item.member_id ? 1 : 0);
    const exercisesCount =
      typeof item.exercises_count === 'number'
        ? item.exercises_count
        : Array.isArray(item.exercises)
        ? item.exercises.length
        : null;

    return (
      <Card style={styles.routineCard}>
        <View style={styles.cardTopRow}>
          <View
            style={[
              styles.trainerBadge,
              {
                backgroundColor: withAlpha(colors.primary, 0.12),
                borderColor: withAlpha(colors.primary, 0.35)
              }
            ]}
          >
            <Ionicons name="fitness-outline" size={12} color={colors.primary} />
            <Text style={[styles.trainerBadgeText, { color: colors.primary }]}>
              {item.trainer_name ? `PROF. ${item.trainer_name.toUpperCase()}` : 'SIN ENTRENADOR'}
            </Text>
          </View>

          <Text style={[styles.dateText, { color: colors.textMuted }]}>
            {formatDateAR(item.created_at)}
          </Text>
        </View>

        <Text style={[styles.routineTitle, { color: colors.text }]}>{item.name}</Text>

        {item.description ? (
          <Text style={[styles.routineDesc, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        <View
          style={[
            styles.metaGrid,
            { backgroundColor: colors.surface, borderColor: colors.border }
          ]}
        >
          <View style={styles.metaCol}>
            <Text style={[styles.metaLabel, { color: colors.textMuted }]}>SOCIOS ASIGNADOS</Text>
            <Text
              style={[
                styles.metaValue,
                { color: assignedCount > 0 ? colors.primary : colors.warning }
              ]}
            >
              {assignedCount > 0
                ? `${assignedCount} ${assignedCount === 1 ? 'socio' : 'socios'}`
                : 'Sin asignar'}
            </Text>
          </View>

          <View style={styles.metaColRight}>
            <Text style={[styles.metaLabel, { color: colors.textMuted }]}>EJERCICIOS</Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>
              {exercisesCount !== null
                ? `${exercisesCount} ${exercisesCount === 1 ? 'ejercicio' : 'ejercicios'}`
                : 'Ver detalle'}
            </Text>
          </View>
        </View>

        {assignedUsers.length > 0 ? (
          <View style={styles.membersSection}>
            <Text style={[styles.membersTitle, { color: colors.textMuted }]}>
              SOCIOS QUE REALIZAN ESTA RUTINA:
            </Text>
            <View style={styles.membersChipWrap}>
              {assignedUsers.map((u: any) => (
                <View
                  key={String(u.member_id)}
                  style={[
                    styles.memberChip,
                    { backgroundColor: colors.surface, borderColor: colors.border }
                  ]}
                >
                  <Ionicons name="person-outline" size={11} color={colors.primary} />
                  <Text style={[styles.memberChipName, { color: colors.text }]} numberOfLines={1}>
                    {u.member_name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : item.member_name ? (
          <View style={styles.membersSection}>
            <Text style={[styles.membersTitle, { color: colors.textMuted }]}>
              SOCIOS: <Text style={{ color: colors.textSecondary }}>{item.member_name}</Text>
            </Text>
          </View>
        ) : null}

        <Button
          title="SUPERVISAR DETALLE Y EJERCICIOS ➔"
          variant="secondary"
          onPress={() => navigation.navigate('RoutineDetail', { routineId: item.id })}
          style={styles.inspectBtn}
        />
      </Card>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScreenTopBar
        title="SUPERVISIÓN DE RUTINAS"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.container}>
        {errorMessage && (
          <View style={styles.bannerWrap}>
            <StatusBanner message={errorMessage} type="error" />
          </View>
        )}

        {loading ? (
          <LoadingSpinner message="cargando rutinas del gimnasio..." />
        ) : (
          <FlatList
            data={filteredRoutines}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderRoutineItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            ListHeaderComponent={
              <View style={styles.headerBlock}>
                {/* Resumen superior */}
                <View style={styles.summaryRow}>
                  <View
                    style={[
                      styles.summaryBox,
                      { backgroundColor: colors.card, borderColor: colors.border }
                    ]}
                  >
                    <Text style={[styles.summaryNum, { color: colors.primary }]}>
                      {routines.length}
                    </Text>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                      RUTINAS CREADAS
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.summaryBox,
                      { backgroundColor: colors.card, borderColor: colors.border }
                    ]}
                  >
                    <Text style={[styles.summaryNum, { color: colors.text }]}>
                      {Math.max(0, trainerOptions.length - 1)}
                    </Text>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                      ENTRENADORES
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.summaryBox,
                      { backgroundColor: colors.card, borderColor: colors.border }
                    ]}
                  >
                    <Text style={[styles.summaryNum, { color: colors.info }]}>
                      {totalAssignedMembers}
                    </Text>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                      SOCIOS CON PLAN
                    </Text>
                  </View>
                </View>

                {/* Buscador y filtros */}
                <View
                  style={[
                    styles.filterCard,
                    { backgroundColor: colors.card, borderColor: colors.border }
                  ]}
                >
                  <Input
                    label="BUSCAR POR RUTINA, PROFESOR O SOCIO"
                    placeholder="Ej. Fuerza, Carlos, Socio..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />

                  <FilterChips
                    label="ESTADO DE ASIGNACIÓN"
                    options={ASSIGNMENT_OPTIONS}
                    value={assignmentFilter}
                    onChange={(val) => setAssignmentFilter(val)}
                  />

                  {trainerOptions.length > 2 && (
                    <FilterChips
                      label="FILTRAR POR PROFESOR"
                      options={trainerOptions}
                      value={selectedTrainerId}
                      onChange={(val) => setSelectedTrainerId(val)}
                    />
                  )}

                  {(searchQuery.trim() !== '' ||
                    assignmentFilter !== 'all' ||
                    selectedTrainerId !== 'all') && (
                    <TouchableOpacity
                      onPress={() => {
                        setSearchQuery('');
                        setAssignmentFilter('all');
                        setSelectedTrainerId('all');
                      }}
                      style={styles.clearFiltersBtn}
                      accessibilityRole="button"
                      accessibilityLabel="limpiar filtros de rutinas"
                    >
                      <Text style={[styles.clearFiltersText, { color: colors.primary }]}>
                        LIMPIAR FILTROS ({filteredRoutines.length} de {routines.length})
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            }
            ListEmptyComponent={
              <EmptyState
                title="no se encontraron rutinas"
                description={
                  routines.length === 0
                    ? 'los entrenadores aún no han registrado rutinas en el gimnasio.'
                    : 'ninguna rutina coincide con la búsqueda o los filtros seleccionados.'
                }
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

export default AdminRoutinesScreen;
