import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ScreenProps } from '../../Scripts/navigation/types';
import { useTheme } from '../../contexto/themeContext';
import { withAlpha } from '../../Styles/theme/colors';
import { useAuth } from '../../contexto/authContext';
import { adminService } from '../../Modules/admin/adminService';
import { userService } from '../../Modules/users/userService';
import {
  isoToDisplay,
  formatDateTimeAR,
  describePeriod
} from '../../Modules/utils/dateFormat';
import type { ActivityLog, User } from '../../Modules/types';
import {
  Card,
  Button,
  StatusBanner,
  LoadingSpinner,
  EmptyState,
  ScreenTopBar,
  FilterChips,
  DateRangeCalendarModal
} from '../../Modules/components/index';
import type { CalendarTarget } from '../../Modules/components/DateRangeCalendarModal';

const CATEGORY_OPTIONS = [
  { value: null as string | null, label: 'TODAS' },
  { value: 'users', label: 'USUARIOS' },
  { value: 'routines', label: 'RUTINAS' },
  { value: 'exercises', label: 'EJERCICIOS' },
  { value: 'incidents', label: 'INCIDENCIAS' },
  { value: 'notifications', label: 'NOTIFICACIONES' }
];

export function ActivityLogScreen({ navigation }: ScreenProps<'ActivityLog'>) {
  const { colors } = useTheme();
  const { token } = useAuth();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // filtros por usuario, categoria y rango de fechas (almacenadas en ISO AAAA-MM-DD para el backend y mostradas en DD-MM-AAAA)
  const [userFilter, setUserFilter] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // estado del calendario visual
  const [calendarVisible, setCalendarVisible] = useState<boolean>(false);
  const [calendarTarget, setCalendarTarget] = useState<CalendarTarget>('start');

  const loadLogs = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await adminService.getActivityLogs(
        {
          userId: userFilter,
          category: categoryFilter,
          startDate: startDate || null,
          endDate: endDate || null,
          limit: 100
        },
        token
      );
      setLogs(res?.data?.logs || []);
    } catch (error: any) {
      setErrorMessage(error?.message || 'no se pudo cargar el registro de actividad');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, userFilter, categoryFilter, startDate, endDate]);

  // listado de usuarios para el filtro por usuario
  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await userService.getUsers(token);
        setUsers(res?.data?.users || []);
      } catch {
        setUsers([]);
      }
    }
    loadUsers();
  }, [token]);

  useEffect(() => {
    setLoading(true);
    loadLogs();
  }, [loadLogs]);

  const openCalendar = (target: CalendarTarget) => {
    setCalendarTarget(target);
    setCalendarVisible(true);
  };

  const handleConfirmDates = (range: { startDate: string; endDate: string }) => {
    if (range.startDate && range.endDate && range.endDate < range.startDate) {
      setErrorMessage('la fecha final no puede ser anterior a la fecha inicial');
      return;
    }
    setErrorMessage(null);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setCalendarVisible(false);
  };

  const clearDatesOnly = () => {
    setErrorMessage(null);
    setStartDate('');
    setEndDate('');
  };

  const clearFilters = () => {
    setErrorMessage(null);
    setUserFilter(null);
    setCategoryFilter(null);
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters = Boolean(userFilter !== null || categoryFilter !== null || startDate || endDate);

  const userOptions = [
    { value: null as number | null, label: 'TODOS' },
    ...users.map((u) => ({ value: u.id as number | null, label: (u.name || u.email).toUpperCase() }))
  ];

  const header = (
    <View style={styles.headerContainer}>
      {errorMessage ? <StatusBanner message={errorMessage} type="error" /> : null}

      <FilterChips label="usuario" options={userOptions} value={userFilter} onChange={setUserFilter} />
      <FilterChips
        label="categoría"
        options={CATEGORY_OPTIONS}
        value={categoryFilter}
        onChange={setCategoryFilter}
      />

      {/* Selector visual de rango de fechas en formato argentino DD-MM-AAAA */}
      <View style={styles.dateSection}>
        <View style={styles.dateHeaderRow}>
          <Text style={[styles.dateSectionLabel, { color: colors.textSecondary }]}>
            FILTRAR POR FECHA (DD-MM-AAAA)
          </Text>
          {(startDate || endDate) && (
            <TouchableOpacity onPress={clearDatesOnly} accessibilityRole="button">
              <Text style={[styles.clearDatesLink, { color: colors.primary }]}>BORRAR FECHAS</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.dateRow}>
          <TouchableOpacity
            onPress={() => openCalendar('start')}
            activeOpacity={0.85}
            style={[
              styles.dateSelectorBtn,
              {
                backgroundColor: colors.surface,
                borderColor: startDate ? colors.primary : colors.border
              }
            ]}
            accessibilityRole="button"
            accessibilityLabel="seleccionar fecha inicial"
          >
            <View style={styles.dateSelectorTop}>
              <Text style={[styles.dateSelectorLabel, { color: colors.textMuted }]}>DESDE</Text>
              <Ionicons
                name="calendar-outline"
                size={15}
                color={startDate ? colors.primary : colors.textSecondary}
              />
            </View>
            <Text
              style={[
                styles.dateSelectorValue,
                { color: startDate ? colors.text : colors.textMuted }
              ]}
            >
              {startDate ? isoToDisplay(startDate) : 'DD-MM-AAAA'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => openCalendar('end')}
            activeOpacity={0.85}
            style={[
              styles.dateSelectorBtn,
              {
                backgroundColor: colors.surface,
                borderColor: endDate ? colors.primary : colors.border
              }
            ]}
            accessibilityRole="button"
            accessibilityLabel="seleccionar fecha final"
          >
            <View style={styles.dateSelectorTop}>
              <Text style={[styles.dateSelectorLabel, { color: colors.textMuted }]}>HASTA</Text>
              <Ionicons
                name="calendar-outline"
                size={15}
                color={endDate ? colors.primary : colors.textSecondary}
              />
            </View>
            <Text
              style={[
                styles.dateSelectorValue,
                { color: endDate ? colors.text : colors.textMuted }
              ]}
            >
              {endDate ? isoToDisplay(endDate) : 'DD-MM-AAAA'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Indicador claro del periodo seleccionado */}
        <View
          style={[
            styles.periodSummaryBox,
            {
              backgroundColor:
                startDate || endDate ? withAlpha(colors.primary, 0.1) : colors.surface,
              borderColor: startDate || endDate ? colors.primary : colors.border
            }
          ]}
        >
          <View style={styles.periodSummaryLeft}>
            <Ionicons
              name="time-outline"
              size={16}
              color={startDate || endDate ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.periodSummaryText, { color: colors.textSecondary }]}>
              Período seleccionado:{' '}
              <Text style={[styles.periodSummaryHighlight, { color: colors.text }]}>
                {describePeriod(startDate, endDate)}
              </Text>
            </Text>
          </View>
          <Text style={[styles.resultsCountBadge, { color: colors.primary }]}>
            {logs.length} {logs.length === 1 ? 'registro' : 'registros'}
          </Text>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Button
          title="ABRIR CALENDARIO"
          onPress={() => openCalendar('start')}
          style={styles.flexBtn}
        />
        <Button
          title="LIMPIAR FILTROS"
          variant="secondary"
          onPress={clearFilters}
          disabled={!hasActiveFilters}
          style={styles.flexBtn}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenTopBar title="REGISTRO DE ACTIVIDAD" onBack={() => navigation.goBack()} />

      <View style={styles.container}>
        {loading && logs.length === 0 ? (
          <LoadingSpinner message="cargando actividad..." />
        ) : (
          <FlatList
            data={logs}
            keyExtractor={(item) => String(item.id)}
            ListHeaderComponent={header}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadLogs();
                }}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <EmptyState
                title="sin actividad registrada"
                description="no hay acciones que coincidan con los filtros o el período seleccionados."
              />
            }
            renderItem={({ item }) => (
              <Card style={styles.logCard}>
                <View style={styles.logTop}>
                  <Text style={[styles.actionType, { color: colors.primary }]}>{item.action_type}</Text>
                  <Text style={[styles.categoryTag, { color: colors.textSecondary, borderColor: colors.border }]}>
                    {String(item.category).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.description, { color: colors.text }]}>{item.description}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {item.user_name || item.user_email || 'usuario eliminado / sistema'} · {formatDateTimeAR(item.created_at)}
                </Text>
              </Card>
            )}
          />
        )}
      </View>

      <DateRangeCalendarModal
        visible={calendarVisible}
        initialStartDate={startDate}
        initialEndDate={endDate}
        initialTarget={calendarTarget}
        onConfirm={handleConfirmDates}
        onClear={clearDatesOnly}
        onClose={() => setCalendarVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  listContent: { flexGrow: 1, paddingBottom: 36 },
  headerContainer: { marginBottom: 8 },
  dateSection: { marginTop: 6, marginBottom: 4 },
  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  dateSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6
  },
  clearDatesLink: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8
  },
  dateSelectorBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  dateSelectorTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  dateSelectorLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6
  },
  dateSelectorValue: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: 0.4
  },
  periodSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    gap: 8
  },
  periodSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1
  },
  periodSummaryText: {
    fontSize: 12,
    flex: 1
  },
  periodSummaryHighlight: {
    fontWeight: '800'
  },
  resultsCountBadge: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  flexBtn: { flex: 1 },
  logCard: { padding: 12, marginVertical: 4 },
  logTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionType: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  categoryTag: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  description: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  meta: { fontSize: 11, marginTop: 6 }
});

export default ActivityLogScreen;
