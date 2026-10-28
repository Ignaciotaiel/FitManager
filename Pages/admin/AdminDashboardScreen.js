import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { useTheme } from '../../contexto/themeContext.js';
import { useAuth } from '../../contexto/authContext.js';
import { userService } from '../../Modules/users/userService.js';
import {
  DashboardHeader,
  Card,
  Button,
  StatusBanner,
  LoadingSpinner,
  FeaturePlaceholder
} from '../../Modules/components/index.js';

export function AdminDashboardScreen({ navigation }) {
  const { colors } = useTheme();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [userStats, setUserStats] = useState({ total: 0, active: 0, inactive: 0 });

  // carga de estadisticas reales consultando la api de usuarios
  const loadSystemStats = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await userService.getUsers(token);
      if (res?.ok && Array.isArray(res?.data?.users)) {
        const users = res.data.users;
        const total = users.length;
        const active = users.filter((u) => u.is_active === 1 || u.is_active === true).length;
        const inactive = total - active;
        setUserStats({ total, active, inactive });
      }
    } catch (error) {
      if (error.code === 'NETWORK_ERROR') {
        setErrorMessage('no se pudo conectar con el servidor para obtener estadisticas');
      } else {
        setErrorMessage(error.message || 'error al cargar datos del sistema');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadSystemStats();
  }, [loadSystemStats]);

  const onRefresh = () => {
    setRefreshing(true);
    loadSystemStats();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <DashboardHeader
          title="PANEL DE ADMINISTRACIÓN"
          subtitle="supervisión general del gimnasio y control de cuentas"
        />

        {errorMessage && <StatusBanner message={errorMessage} type="error" />}

        {loading ? (
          <LoadingSpinner message="cargando resumen del gimnasio..." />
        ) : (
          <>
            {/* estadisticas reales calculadas de la base de datos */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              RESUMEN DE USUARIOS REGISTRADOS
            </Text>

            <View style={styles.statsRow}>
              <Card style={[styles.statCard, { flex: 1 }]}>
                <Text style={[styles.statNumber, { color: colors.text }]}>
                  {userStats.total}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  total cuentas
                </Text>
              </Card>

              <Card style={[styles.statCard, { flex: 1 }]}>
                <Text style={[styles.statNumber, { color: colors.primary }]}>
                  {userStats.active}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  activas
                </Text>
              </Card>

              <Card style={[styles.statCard, { flex: 1 }]}>
                <Text style={[styles.statNumber, { color: colors.danger }]}>
                  {userStats.inactive}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  desactivadas
                </Text>
              </Card>
            </View>

            {/* acceso directo a la gestion de usuarios */}
            <Card style={styles.actionCard}>
              <View style={styles.actionCardHeader}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  gestión de usuarios y roles
                </Text>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                  consultá el listado, buscá por nombre o correo, y modificá estados de cuenta.
                </Text>
              </View>
              <Button
                title="VER LISTADO DE USUARIOS"
                variant="primary"
                onPress={() => navigation.navigate('Users')}
              />
            </Card>

            {/* acceso directo a la biblioteca de ejercicios */}
            <Card style={[styles.actionCard, { marginTop: 14 }]}>
              <View style={styles.actionCardHeader}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  supervisión de ejercicios y técnicas
                </Text>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                  administrá el catálogo global de ejercicios disponibles en el gimnasio.
                </Text>
              </View>
              <Button
                title="VER CATÁLOGO DE EJERCICIOS"
                variant="secondary"
                onPress={() => navigation.navigate('Exercises')}
              />
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: 40
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 8
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10
  },
  statCard: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '900'
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 4
  },
  actionCard: {
    padding: 16,
    marginTop: 12
  },
  actionCardHeader: {
    marginBottom: 12
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800'
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4
  }
});

export default AdminDashboardScreen;
