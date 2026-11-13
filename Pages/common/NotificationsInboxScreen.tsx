// Muestra la bandeja de avisos activos del gimnasio para entrenadores y socios con control de lectura individual.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ScreenProps } from '../../Scripts/navigation/types';
import { useTheme } from '../../contexto/themeContext';
import { withAlpha } from '../../Styles/theme/colors';
import { useAuth } from '../../contexto/authContext';
import { adminService } from '../../Modules/admin/adminService';
import { formatDateTimeAR } from '../../Modules/utils/dateFormat';
import type { AdminNotification } from '../../Modules/types';
import { Card, StatusBanner, LoadingSpinner, EmptyState, ScreenTopBar } from '../../Modules/components/index';
import { styles } from './NotificationsInboxScreen.styles';

// Bandeja de avisos internos: muestra avisos activos para el rol del usuario y marca como leídos los nuevos al consultarlos.
export function NotificationsInboxScreen({ navigation }: ScreenProps<'NotificationsInbox'>) {
  const { colors } = useTheme();
  const { token } = useAuth();

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [highlightedUnreadIds, setHighlightedUnreadIds] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Carga los avisos activos del usuario y registra la lectura individual de los avisos nuevos.
  const load = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await adminService.getActiveNotifications(token);
      const list = res?.data?.notifications || [];
      setNotifications(list);

      const unreadIds = list.filter((n) => !n.is_read).map((n) => Number(n.id));
      if (unreadIds.length > 0) {
        setHighlightedUnreadIds((prev) => Array.from(new Set([...prev, ...unreadIds])));
        await adminService.markNotificationsRead(unreadIds, token).catch(() => null);
      }
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

  // Refrescar al volver a enfocar la pantalla o de forma periódica cada 30 segundos.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      load();
    });
    const intervalId = setInterval(() => {
      load();
    }, 30000);
    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, [navigation, load]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenTopBar title="AVISOS DEL GIMNASIO" onBack={() => navigation.goBack()} />

      <View style={styles.container}>
        {errorMessage ? <StatusBanner message={errorMessage} type="error" /> : null}

        {notifications.length > 0 && !loading && (
          <View
            style={[
              styles.summaryBanner,
              {
                backgroundColor:
                  highlightedUnreadIds.length > 0 ? withAlpha(colors.primary, 0.12) : colors.surface,
                borderColor: highlightedUnreadIds.length > 0 ? colors.primary : colors.border
              }
            ]}
          >
            <Text
              style={[
                styles.summaryBannerText,
                { color: highlightedUnreadIds.length > 0 ? colors.primary : colors.textSecondary }
              ]}
            >
              {highlightedUnreadIds.length > 0
                ? `✓ ${highlightedUnreadIds.length} ${
                    highlightedUnreadIds.length === 1 ? 'nuevo aviso marcado como leído' : 'nuevos avisos marcados como leídos'
                  }`
                : `Estás al día (${notifications.length} ${
                    notifications.length === 1 ? 'aviso publicado' : 'avisos publicados'
                  })`}
            </Text>
          </View>
        )}

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
            ListEmptyComponent={
              <EmptyState
                title="sin avisos"
                description="no hay avisos publicados para vos por el momento."
              />
            }
            renderItem={({ item }) => {
              const isNew = !item.is_read || highlightedUnreadIds.includes(Number(item.id));
              const audienceText =
                item.target_role === 'trainer'
                  ? 'PARA ENTRENADORES'
                  : item.target_role === 'member'
                  ? 'PARA SOCIOS'
                  : 'COMUNICADO GENERAL';

              return (
                <Card
                  style={[
                    styles.itemCard,
                    {
                      borderColor: isNew ? colors.primary : colors.border,
                      backgroundColor: colors.card
                    }
                  ]}
                >
                  <View style={styles.itemHeaderRow}>
                    <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        isNew
                          ? {
                              backgroundColor: withAlpha(colors.primary, 0.15),
                              borderColor: colors.primary
                            }
                          : {
                              backgroundColor: colors.surface,
                              borderColor: colors.border
                            }
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: isNew ? colors.primary : colors.textMuted }
                        ]}
                      >
                        {isNew ? '● NUEVO' : 'LEÍDO'}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.itemContent, { color: colors.textSecondary }]}>
                    {item.content}
                  </Text>

                  <View style={styles.itemFooterRow}>
                    <Text style={[styles.audienceTag, { color: colors.primary }]}>
                      {audienceText}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      {formatDateTimeAR(item.created_at)}
                    </Text>
                  </View>
                </Card>
              );
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

export default NotificationsInboxScreen;
