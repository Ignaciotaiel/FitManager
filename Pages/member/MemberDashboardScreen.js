import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl
} from 'react-native';
import { useTheme } from '../../contexto/themeContext.js';
import { useAuth } from '../../contexto/authContext.js';
import { routineService } from '../../Modules/routines/routineService.js';
import { membershipService } from '../../Modules/memberships/membershipService.js';
import {
  DashboardHeader,
  Card,
  Button,
  StatusBanner,
  LoadingSpinner,
  EmptyState
} from '../../Modules/components/index.js';

export function MemberDashboardScreen({ navigation }) {
  const { colors } = useTheme();
  const { token, user } = useAuth();

  const [routines, setRoutines] = useState([]);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // el backend filtra por WHERE member_id = req.user.id y /memberships/my
  const loadDashboardData = useCallback(async () => {
    try {
      setErrorMessage(null);
      const [routineRes, memRes] = await Promise.all([
        routineService.getRoutines(token),
        membershipService.getMyMembership(token)
      ]);

      if (routineRes?.ok && Array.isArray(routineRes?.data?.routines)) {
        setRoutines(routineRes.data.routines);
      }
      if (memRes?.ok) {
        setMembership(memRes.data.membership);
      }
    } catch (error) {
      if (error.code === 'NETWORK_ERROR') {
        setErrorMessage('no se pudo conectar con el servidor para obtener tus datos');
      } else {
        setErrorMessage(error.message || 'error al cargar información');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const renderRoutineItem = ({ item }) => {
    return (
      <Card style={styles.routineCard}>
        <Text style={[styles.routineName, { color: colors.text }]}>
          {item.name}
        </Text>
        {item.description ? (
          <Text style={[styles.routineDesc, { color: colors.textSecondary }]}>
            {item.description}
          </Text>
        ) : null}

        <View style={styles.trainerRow}>
          <Text style={[styles.trainerLabel, { color: colors.textMuted }]}>
            asignada por:{' '}
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              {item.trainer_name || 'entrenador'}
            </Text>
          </Text>
        </View>

        <Button
          title="VER SESIÓN DE ENTRENAMIENTO"
          variant="primary"
          onPress={() => navigation.navigate('RoutineDetail', { routineId: item.id })}
          style={styles.routineBtn}
        />
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        <DashboardHeader
          title="MI ENTRENAMIENTO"
          subtitle="tus rutinas asignadas y biblioteca de técnicas"
        />

        {errorMessage && <StatusBanner message={errorMessage} type="error" />}

        {/* boton de acceso a la biblioteca de ejercicios en modo solo lectura */}
        <Button
          title="CONSULTAR BIBLIOTECA DE EJERCICIOS"
          variant="secondary"
          onPress={() => navigation.navigate('Exercises')}
          style={styles.libBtn}
        />

        {/* estado de membresia real */}
        <Card style={styles.membershipCard}>
          <View style={styles.membershipHeader}>
            <Text style={[styles.membershipTitle, { color: colors.text }]}>
              ESTADO DE TU MEMBRESÍA
            </Text>
            {membership ? (
              <View
                style={[
                  styles.membershipBadge,
                  {
                    backgroundColor:
                      membership.status === 'active'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : membership.status === 'expired'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(148, 163, 184, 0.15)'
                  }
                ]}
              >
                <Text
                  style={[
                    styles.membershipBadgeText,
                    {
                      color:
                        membership.status === 'active'
                          ? colors.success || '#10b981'
                          : membership.status === 'expired'
                          ? colors.danger || '#ef4444'
                          : colors.textMuted || '#94a3b8'
                    }
                  ]}
                >
                  {membership.status === 'active'
                    ? 'ACTIVA'
                    : membership.status === 'expired'
                    ? 'VENCIDA'
                    : 'CANCELADA'}
                </Text>
              </View>
            ) : null}
          </View>

          {membership ? (
            <View style={styles.membershipDatesRow}>
              <View style={styles.membershipDateCol}>
                <Text style={[styles.membershipDateLabel, { color: colors.textMuted }]}>
                  INICIO DEL PLAN
                </Text>
                <Text style={[styles.membershipDateValue, { color: colors.text }]}>
                  {membership.start_date || '—'}
                </Text>
              </View>
              <View style={styles.membershipDateCol}>
                <Text style={[styles.membershipDateLabel, { color: colors.textMuted }]}>
                  VENCE EL
                </Text>
                <Text
                  style={[
                    styles.membershipDateValue,
                    {
                      color:
                        membership.status === 'expired'
                          ? colors.danger || '#ef4444'
                          : colors.primary
                    }
                  ]}
                >
                  {membership.end_date || 'sin límite'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.noMembershipText, { color: colors.textSecondary }]}>
              no posees una membresía activa registrada actualmente. consulta en recepción o con tu administrador para renovar o activar tu plan.
            </Text>
          )}
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          RUTINAS ASIGNADAS A TU PLAN ({routines.length})
        </Text>

        {loading ? (
          <LoadingSpinner message="cargando tus rutinas..." />
        ) : (
          <FlatList
            data={routines}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderRoutineItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <EmptyState
                title="sin rutinas asignadas"
                description="tu entrenador aún no te asignó un plan de entrenamiento activo. consultá periódicamente para ver tus ejercicios."
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10
  },
  libBtn: {
    marginVertical: 4
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 8
  },
  listContent: {
    paddingBottom: 24
  },
  routineCard: {
    padding: 16,
    marginVertical: 6
  },
  routineName: {
    fontSize: 18,
    fontWeight: '800'
  },
  routineDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginVertical: 6
  },
  trainerRow: {
    marginBottom: 10
  },
  trainerLabel: {
    fontSize: 12
  },
  routineBtn: {
    marginTop: 4
  },
  membershipCard: {
    marginVertical: 10,
    padding: 16
  },
  membershipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  membershipTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  membershipBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  membershipBadgeText: {
    fontSize: 10,
    fontWeight: '800'
  },
  membershipDatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)'
  },
  membershipDateCol: {
    flex: 1
  },
  membershipDateLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  membershipDateValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2
  },
  noMembershipText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4
  }
});

export default MemberDashboardScreen;
