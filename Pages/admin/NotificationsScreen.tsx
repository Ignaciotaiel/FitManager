import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ScreenProps } from '../../Scripts/navigation/types';
import { useTheme } from '../../contexto/themeContext';
import { useAuth } from '../../contexto/authContext';
import { adminService } from '../../Modules/admin/adminService';
import type { AdminNotification, NotificationTarget } from '../../Modules/types';
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

const TARGET_OPTIONS: { value: NotificationTarget; label: string }[] = [
  { value: 'all', label: 'TODOS' },
  { value: 'trainer', label: 'ENTRENADORES' },
  { value: 'member', label: 'SOCIOS' }
];

const TARGET_LABELS: Record<NotificationTarget, string> = {
  all: 'TODOS LOS USUARIOS',
  trainer: 'SOLO ENTRENADORES',
  member: 'SOLO SOCIOS'
};

function formatDateTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-AR');
}

export function NotificationsScreen({ navigation }: ScreenProps<'Notifications'>) {
  const { colors } = useTheme();
  const { token } = useAuth();

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // formulario de creacion / edicion
  const [formVisible, setFormVisible] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [targetRole, setTargetRole] = useState<NotificationTarget>('all');

  // confirmacion de eliminacion
  const [toDelete, setToDelete] = useState<AdminNotification | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const loadNotifications = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await adminService.getNotifications(token);
      setNotifications(res?.data?.notifications || []);
    } catch (error: any) {
      setErrorMessage(error?.message || 'no se pudieron cargar las notificaciones');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const openCreate = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setTargetRole('all');
    setErrorMessage(null);
    setFormVisible(true);
  };

  const openEdit = (item: AdminNotification) => {
    setEditingId(item.id);
    setTitle(item.title);
    setContent(item.content);
    setTargetRole(item.target_role);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFormVisible(true);
  };

  const closeForm = () => {
    setFormVisible(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setErrorMessage('el título y el contenido son obligatorios');
      return;
    }
    try {
      setSaving(true);
      setErrorMessage(null);
      if (editingId) {
        await adminService.updateNotification(
          editingId,
          { title: title.trim(), content: content.trim(), target_role: targetRole },
          token
        );
        setSuccessMessage('notificación actualizada correctamente');
      } else {
        await adminService.createNotification(
          { title: title.trim(), content: content.trim(), target_role: targetRole },
          token
        );
        setSuccessMessage('notificación publicada correctamente');
      }
      closeForm();
      await loadNotifications();
    } catch (error: any) {
      setErrorMessage(error?.message || 'no se pudo guardar la notificación');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: AdminNotification) => {
    try {
      setErrorMessage(null);
      await adminService.updateNotification(item.id, { is_active: !item.is_active }, token);
      setSuccessMessage(item.is_active ? 'notificación ocultada' : 'notificación publicada nuevamente');
      await loadNotifications();
    } catch (error: any) {
      setErrorMessage(error?.message || 'no se pudo cambiar el estado');
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      setDeleting(true);
      await adminService.deleteNotification(toDelete.id, token);
      setSuccessMessage('notificación eliminada correctamente');
      setToDelete(null);
      await loadNotifications();
    } catch (error: any) {
      setErrorMessage(error?.message || 'no se pudo eliminar la notificación');
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const header = (
    <View>
      {errorMessage ? <StatusBanner message={errorMessage} type="error" /> : null}
      {successMessage ? <StatusBanner message={successMessage} type="success" /> : null}

      {formVisible ? (
        <Card style={styles.formCard}>
          <Text style={[styles.formTitle, { color: colors.text }]}>
            {editingId ? 'EDITAR NOTIFICACIÓN' : 'NUEVA NOTIFICACIÓN'}
          </Text>
          <Input label="título" placeholder="ej. Mantenimiento del área de pesas" value={title} onChangeText={setTitle} autoCapitalize="sentences" maxLength={255} />
          <Input
            label="contenido"
            placeholder="detalle del aviso..."
            value={content}
            onChangeText={setContent}
            autoCapitalize="sentences"
            multiline
            numberOfLines={4}
          />
          <FilterChips label="destinatarios" options={TARGET_OPTIONS} value={targetRole} onChange={setTargetRole} />
          <View style={styles.buttonRow}>
            <Button title={editingId ? 'GUARDAR CAMBIOS' : 'PUBLICAR'} onPress={handleSave} loading={saving} style={styles.flexBtn} />
            <Button title="CANCELAR" variant="secondary" onPress={closeForm} disabled={saving} style={styles.flexBtn} />
          </View>
        </Card>
      ) : (
        <Button title="+ NUEVA NOTIFICACIÓN" onPress={openCreate} />
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenTopBar title="NOTIFICACIONES" onBack={() => navigation.goBack()} />

      <View style={styles.container}>
        {loading ? (
          <LoadingSpinner message="cargando notificaciones..." />
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => String(item.id)}
            ListHeaderComponent={header}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadNotifications();
                }}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <EmptyState
                title="sin notificaciones"
                description="todavía no publicaste avisos internos."
              />
            }
            renderItem={({ item }) => {
              const active = Boolean(item.is_active);
              return (
                <Card style={styles.itemCard}>
                  <View style={styles.itemTop}>
                    <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
                    <Text style={[styles.statusTag, { color: active ? colors.primary : colors.textMuted, borderColor: active ? colors.primary : colors.border }]}>
                      {active ? 'VISIBLE' : 'OCULTA'}
                    </Text>
                  </View>
                  <Text style={[styles.itemContent, { color: colors.textSecondary }]}>{item.content}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {TARGET_LABELS[item.target_role] || item.target_role} · publicada {formatDateTime(item.created_at)}
                    {item.created_by_name ? ` por ${item.created_by_name}` : ''}
                  </Text>
                  <View style={styles.buttonRow}>
                    <Button title="EDITAR" variant="secondary" onPress={() => openEdit(item)} style={styles.flexBtn} />
                    <Button title={active ? 'OCULTAR' : 'MOSTRAR'} variant="secondary" onPress={() => handleToggleActive(item)} style={styles.flexBtn} />
                    <Button title="ELIMINAR" variant="danger" onPress={() => setToDelete(item)} style={styles.flexBtn} />
                  </View>
                </Card>
              );
            }}
          />
        )}
      </View>

      <ConfirmModal
        visible={toDelete !== null}
        title="eliminar notificación"
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
  meta: { fontSize: 11, marginTop: 6 }
});

export default NotificationsScreen;

