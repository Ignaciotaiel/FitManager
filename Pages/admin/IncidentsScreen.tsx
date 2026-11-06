import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ScreenProps } from '../../Scripts/navigation/types';
import { useTheme } from '../../contexto/themeContext';
import { useAuth } from '../../contexto/authContext';
import { adminService } from '../../Modules/admin/adminService';
import { formatDateTimeAR } from '../../Modules/utils/dateFormat';
import type { Incident, IncidentCategory, IncidentStatus } from '../../Modules/types';
import {
  Card,
  Input,
  Button,
  StatusBanner,
  LoadingSpinner,
  EmptyState,
  ConfirmModal,
  ScreenTopBar,
  FilterChips
} from '../../Modules/components/index';

const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  equipment: 'EQUIPAMIENTO',
  facility: 'INSTALACIONES',
  safety: 'SEGURIDAD',
  cleanliness: 'LIMPIEZA',
  other: 'OTRO'
};

const STATUS_LABELS: Record<IncidentStatus, string> = {
  pending: 'PENDIENTE',
  in_progress: 'EN PROCESO',
  resolved: 'RESUELTA'
};

const CATEGORY_FORM_OPTIONS = (Object.keys(CATEGORY_LABELS) as IncidentCategory[]).map((value) => ({
  value,
  label: CATEGORY_LABELS[value]
}));

const CATEGORY_FILTER_OPTIONS: { value: IncidentCategory | null; label: string }[] = [
  { value: null, label: 'TODAS' },
  ...CATEGORY_FORM_OPTIONS
];

const STATUS_FILTER_OPTIONS: { value: IncidentStatus | null; label: string }[] = [
  { value: null, label: 'TODOS' },
  { value: 'pending', label: STATUS_LABELS.pending },
  { value: 'in_progress', label: STATUS_LABELS.in_progress },
  { value: 'resolved', label: STATUS_LABELS.resolved }
];

export function IncidentsScreen({ navigation }: ScreenProps<'Incidents'>) {
  const { colors } = useTheme();
  const { token } = useAuth();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<IncidentStatus | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<IncidentCategory | null>(null);

  // formulario de alta / edicion
  const [formVisible, setFormVisible] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<IncidentCategory>('other');

  // notas de resolucion al cambiar de estado
  const [notesTarget, setNotesTarget] = useState<{ incident: Incident; status: IncidentStatus } | null>(null);
  const [notes, setNotes] = useState<string>('');

  const [toDelete, setToDelete] = useState<Incident | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const loadIncidents = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await adminService.getIncidents({ status: statusFilter, category: categoryFilter }, token);
      setIncidents(res?.data?.incidents || []);
    } catch (error: any) {
      setErrorMessage(error?.message || 'no se pudieron cargar las incidencias');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, statusFilter, categoryFilter]);

  useEffect(() => {
    setLoading(true);
    loadIncidents();
  }, [loadIncidents]);

  const openCreate = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setCategory('other');
    setErrorMessage(null);
    setFormVisible(true);
  };

  const openEdit = (item: Incident) => {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description);
    setCategory(item.category);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFormVisible(true);
  };

  const closeForm = () => {
    setFormVisible(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) {
      setErrorMessage('el título y la descripción son obligatorios');
      return;
    }
    try {
      setSaving(true);
      setErrorMessage(null);
      if (editingId) {
        await adminService.updateIncident(editingId, { title: title.trim(), description: description.trim(), category }, token);
        setSuccessMessage('incidencia actualizada correctamente');
      } else {
        await adminService.createIncident({ title: title.trim(), description: description.trim(), category }, token);
        setSuccessMessage('incidencia registrada correctamente');
      }
      closeForm();
      await loadIncidents();
    } catch (error: any) {
      setErrorMessage(error?.message || 'no se pudo guardar la incidencia');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (incident: Incident, status: IncidentStatus, resolutionNotes?: string) => {
    try {
      setSaving(true);
      setErrorMessage(null);
      await adminService.updateIncident(
        incident.id,
        resolutionNotes !== undefined ? { status, resolution_notes: resolutionNotes } : { status },
        token
      );
      setSuccessMessage(`estado actualizado: ${STATUS_LABELS[status].toLowerCase()}`);
      await loadIncidents();
    } catch (error: any) {
      setErrorMessage(error?.message || 'no se pudo cambiar el estado');
    } finally {
      setSaving(false);
    }
  };

  const requestStatusChange = (incident: Incident, status: IncidentStatus) => {
    if (status === 'resolved') {
      setNotes(incident.resolution_notes || '');
      setNotesTarget({ incident, status });
      return;
    }
    changeStatus(incident, status);
  };

  const confirmResolution = async () => {
    if (!notesTarget) return;
    const { incident, status } = notesTarget;
    setNotesTarget(null);
    await changeStatus(incident, status, notes.trim());
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      setDeleting(true);
      await adminService.deleteIncident(toDelete.id, token);
      setSuccessMessage('incidencia eliminada correctamente');
      setToDelete(null);
      await loadIncidents();
    } catch (error: any) {
      setErrorMessage(error?.message || 'no se pudo eliminar la incidencia');
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const statusColor = (status: IncidentStatus): string => {
    if (status === 'resolved') return colors.primary;
    if (status === 'in_progress') return colors.warning;
    return colors.danger;
  };

  const header = (
    <View>
      {errorMessage ? <StatusBanner message={errorMessage} type="error" /> : null}
      {successMessage ? <StatusBanner message={successMessage} type="success" /> : null}

      {formVisible ? (
        <Card style={styles.formCard}>
          <Text style={[styles.formTitle, { color: colors.text }]}>
            {editingId ? 'EDITAR INCIDENCIA' : 'NUEVA INCIDENCIA'}
          </Text>
          <Input label="título" placeholder="ej. Cinta de correr #3 fuera de servicio" value={title} onChangeText={setTitle} autoCapitalize="sentences" maxLength={255} />
          <Input label="descripción" placeholder="detalle del problema..." value={description} onChangeText={setDescription} autoCapitalize="sentences" multiline numberOfLines={4} />
          <FilterChips label="categoría" options={CATEGORY_FORM_OPTIONS} value={category} onChange={setCategory} />
          <View style={styles.buttonRow}>
            <Button title={editingId ? 'GUARDAR CAMBIOS' : 'REGISTRAR'} onPress={handleSave} loading={saving} style={styles.flexBtn} />
            <Button title="CANCELAR" variant="secondary" onPress={closeForm} disabled={saving} style={styles.flexBtn} />
          </View>
        </Card>
      ) : (
        <Button title="+ NUEVA INCIDENCIA" onPress={openCreate} />
      )}

      {notesTarget ? (
        <Card style={styles.formCard}>
          <Text style={[styles.formTitle, { color: colors.text }]}>MARCAR COMO RESUELTA</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>{notesTarget.incident.title}</Text>
          <Input
            label="notas de resolución (opcional)"
            placeholder="solución aplicada..."
            value={notes}
            onChangeText={setNotes}
            autoCapitalize="sentences"
            multiline
            numberOfLines={3}
          />
          <View style={styles.buttonRow}>
            <Button title="CONFIRMAR" onPress={confirmResolution} loading={saving} style={styles.flexBtn} />
            <Button title="CANCELAR" variant="secondary" onPress={() => setNotesTarget(null)} disabled={saving} style={styles.flexBtn} />
          </View>
        </Card>
      ) : null}

      <FilterChips label="estado" options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
      <FilterChips label="categoría" options={CATEGORY_FILTER_OPTIONS} value={categoryFilter} onChange={setCategoryFilter} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenTopBar title="INCIDENCIAS" onBack={() => navigation.goBack()} />

      <View style={styles.container}>
        {loading && incidents.length === 0 ? (
          <LoadingSpinner message="cargando incidencias..." />
        ) : (
          <FlatList
            data={incidents}
            keyExtractor={(item) => String(item.id)}
            ListHeaderComponent={header}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadIncidents();
                }}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <EmptyState title="sin incidencias" description="no hay incidencias que coincidan con los filtros." />
            }
            renderItem={({ item }) => (
              <Card style={styles.itemCard}>
                <View style={styles.itemTop}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.statusTag, { color: statusColor(item.status), borderColor: statusColor(item.status) }]}>
                    {STATUS_LABELS[item.status] || item.status}
                  </Text>
                </View>
                <Text style={[styles.itemContent, { color: colors.textSecondary }]}>{item.description}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {CATEGORY_LABELS[item.category] || item.category} · registrada {formatDateTimeAR(item.created_at)}
                  {item.created_by_name ? ` por ${item.created_by_name}` : ''}
                </Text>
                {item.updated_at && item.updated_at !== item.created_at ? (
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    última actualización: {formatDateTimeAR(item.updated_at)}
                  </Text>
                ) : null}
                {item.status === 'resolved' && item.resolved_at ? (
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    resuelta: {formatDateTimeAR(item.resolved_at)}
                  </Text>
                ) : null}
                {item.resolution_notes ? (
                  <Text style={[styles.notes, { color: colors.textSecondary }]}>notas: {item.resolution_notes}</Text>
                ) : null}

                <View style={styles.buttonRow}>
                  {(['pending', 'in_progress', 'resolved'] as IncidentStatus[]).map((s) => (
                    <Button
                      key={s}
                      title={STATUS_LABELS[s]}
                      variant={item.status === s ? 'primary' : 'secondary'}
                      disabled={item.status === s || saving}
                      onPress={() => requestStatusChange(item, s)}
                      style={styles.flexBtn}
                      textStyle={styles.smallBtnText}
                    />
                  ))}
                </View>
                <View style={styles.buttonRow}>
                  <Button title="EDITAR" variant="secondary" onPress={() => openEdit(item)} style={styles.flexBtn} />
                  <Button title="ELIMINAR" variant="danger" onPress={() => setToDelete(item)} style={styles.flexBtn} />
                </View>
              </Card>
            )}
          />
        )}
      </View>

      <ConfirmModal
        visible={toDelete !== null}
        title="eliminar incidencia"
        message={toDelete ? `¿Querés eliminar "${toDelete.title}"? Esta acción no se puede deshacer.` : ''}
        confirmText="eliminar"
        isDestructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  listContent: { flexGrow: 1, paddingBottom: 36 },
  formCard: { padding: 14, marginVertical: 6 },
  formTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 0.8, marginBottom: 4 },
  buttonRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  flexBtn: { flex: 1, paddingHorizontal: 4 },
  smallBtnText: { fontSize: 10, letterSpacing: 0.3 },
  itemCard: { padding: 12, marginVertical: 5 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  itemTitle: { fontSize: 14, fontWeight: '800', flex: 1 },
  statusTag: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  itemContent: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  meta: { fontSize: 11, marginTop: 4 },
  notes: { fontSize: 12, marginTop: 6, fontStyle: 'italic' }
});

export default IncidentsScreen;
