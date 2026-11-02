import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ScreenProps } from '../../Scripts/navigation/types';
import { useTheme } from '../../contexto/themeContext';
import { useAuth } from '../../contexto/authContext';
import { adminService } from '../../Modules/admin/adminService';
import type { AdminNotification } from '../../Modules/types';
import { Card, StatusBanner, LoadingSpinner, EmptyState, ScreenTopBar } from '../../Modules/components/index';

function formatDateTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-AR');
}

// bandeja de avisos internos: el backend solo devuelve las notificaciones activas dirigidas
// a todos o al rol del usuario autenticado
export function NotificationsInboxScreen({ navigation }: ScreenProps<'NotificationsInbox'>) {
  const { colors } = useTheme();
  const { token } = useAuth();

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await adminService.getActiveNotifications(token);
      setNotifications(res?.data?.notifications || []);
    } catch (error: any) {
      setErrorMessage(error?.message || 'no se pudieron cargar los avisos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenTopBar title="AVISOS DEL GIMNASIO" onBack={() => navigation.goBack()} />

      <View style={styles.container}>
        {errorMessage ? <StatusBanner message={errorMessage} type="error" /> : null}
        {loading ? (
          <LoadingSpinner message="cargando avisos..." />
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={<EmptyState title="sin avisos" description="no hay avisos publicados para vos por el momento." />}
            renderItem={({ item }) => (
              <Card style={styles.itemCard}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.itemContent, { color: colors.textSecondary }]}>{item.content}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{formatDateTime(item.created_at)}</Text>
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
  itemCard: { padding: 12, marginVertical: 5 },
  itemTitle: { fontSize: 14, fontWeight: '800' },
  itemContent: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  meta: { fontSize: 11, marginTop: 6 }
});

export default NotificationsInboxScreen;

