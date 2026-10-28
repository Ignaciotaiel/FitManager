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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // el backend filtra por WHERE member_id = req.user.id
  const loadDashboardData = useCallback(async () => {
    try {
      setErrorMessage(null);
      const routineRes = await routineService.getRoutines(token);

      if (routineRes?.ok && Array.isArray(routineRes?.data?.routines)) {
        setRoutines(routineRes.data.routines);
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

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          RUTINAS ASIGNADAS ({routines.length})
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
                description="tu entrenador aún no te asignó una rutina activa. consultá periódicamente para ver tus ejercicios."
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
  }
});

export default MemberDashboardScreen;
