import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ScreenProps } from '../../Scripts/navigation/types';
import { useTheme } from '../../contexto/themeContext';
import { useAuth } from '../../contexto/authContext';
import { adminService } from '../../Modules/admin/adminService';
import { userService } from '../../Modules/users/userService';
import type { ActivityLog, User } from '../../Modules/types';
import {
  Card,
  Input,
  Button,
  StatusBanner,
  LoadingSpinner,
  EmptyState,
  ScreenTopBar,
  FilterChips
} from '../../Modules/components/index';

const CATEGORY_OPTIONS = [
  { value: null as string | null, label: 'TODAS' },
  { value: 'users', label: 'USUARIOS' },
  { value: 'routines', label: 'RUTINAS' },
  { value: 'exercises', label: 'EJERCICIOS' },
  { value: 'incidents', label: 'INCIDENCIAS' },
  { value: 'notifications', label: 'NOTIFICACIONES' }
];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-AR');
}

export function ActivityLogScreen({ navigation }: ScreenProps<'ActivityLog'>) {
  const { colors } = useTheme();
  const { token } = useAuth();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // filtros editables y filtros aplicados
  const [userFilter, setUserFilter] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [appliedDates, setAppliedDates] = useState<{ start: string; end: string }>({ start: '', end: '' });

  const loadLogs = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await adminService.getActivityLogs(
        {
          userId: userFilter,
          category: categoryFilter,
          startDate: appliedDates.start || null,
          endDate: appliedDates.end || null,
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
  }, [token, userFilter, categoryFilter, appliedDates]);

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

  const applyDates = () => {
    if ((startDate && !DATE_REGEX.test(startDate)) || (endDate && !DATE_REGEX.test(endDate))) {
      setErrorMessage('las fechas deben tener el formato AAAA-MM-DD (ej. 2026-11-02)');
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      setErrorMessage('la fecha inicial no puede ser posterior a la fecha final');
      return;
    }
    setAppliedDates({ start: startDate, end: endDate });
  };

  const clearFilters = () => {
    setUserFilter(null);
    setCategoryFilter(null);
    setStartDate('');
    setEndDate('');
    setAppliedDates({ start: '', end: '' });
  };

  const userOptions = [
    { value: null as number | null, label: 'TODOS' },
    ...users.map((u) => ({ value: u.id as number | null, label: (u.name || u.email).toUpperCase() }))
  ];

  const header = (
    <View>
      {errorMessage ? <StatusBanner message={errorMessage} type="error" /> : null}
      <FilterChips label="usuario" options={userOptions} value={userFilter} onChange={setUserFilter} />
      <FilterChips
        label="categoría"
        options={CATEGORY_OPTIONS}
        value={categoryFilter}
        onChange={setCategoryFilter}
      />
      <View style={styles.dateRow}>
        <Input
          label="desde"
          placeholder="AAAA-MM-DD"
          value={startDate}
          onChangeText={setStartDate}
          style={styles.dateInput}
          maxLength={10}
        />
        <Input
          label="hasta"
          placeholder="AAAA-MM-DD"
          value={endDate}
          onChangeText={setEndDate}
          style={styles.dateInput}
          maxLength={10}
        />
      </View>
      <View style={styles.buttonRow}>
        <Button title="APLICAR FECHAS" onPress={applyDates} style={styles.flexBtn} />
        <Button title="LIMPIAR" variant="secondary" onPress={clearFilters} style={styles.flexBtn} />
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
                description="no hay acciones que coincidan con los filtros seleccionados."
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
                  {item.user_name || item.user_email || 'usuario eliminado / sistema'} · {formatDateTime(item.created_at)}
                </Text>
              </Card>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  listContent: { flexGrow: 1, paddingBottom: 36 },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateInput: { flex: 1, width: undefined },
  buttonRow: { flexDirection: 'row', gap: 8 },
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

