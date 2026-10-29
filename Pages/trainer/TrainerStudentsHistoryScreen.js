import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexto/themeContext.js';
import { useAuth } from '../../contexto/authContext.js';
import { workoutService } from '../../Modules/workouts/workoutService.js';
import {
  DashboardHeader,
  Card,
  Input,
  Button,
  StatusBanner,
  LoadingSpinner,
  EmptyState
} from '../../Modules/components/index.js';

export function TrainerStudentsHistoryScreen({ navigation }) {
  const { colors } = useTheme();
  const { token } = useAuth();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  const loadMembers = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await workoutService.getTrainerMembers(token);
      if (res?.ok && Array.isArray(res?.data?.members)) {
        setMembers(res.data.members);
      } else {
        setMembers([]);
      }
    } catch (err) {
      if (err.code === 'NETWORK_ERROR') {
        setErrorMessage('no se pudo conectar con el servidor para obtener los alumnos');
      } else {
        setErrorMessage(err.message || 'error al cargar la lista de alumnos asignados');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const onRefresh = () => {
    setRefreshing(true);
    loadMembers();
  };

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase().trim();
    return members.filter(m =>
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.email && m.email.toLowerCase().includes(q))
    );
  }, [members, searchQuery]);

  const renderMemberItem = ({ item }) => (
    <Card style={[styles.memberCard, { borderColor: colors.border }]}>
      <View style={styles.memberInfoRow}>
        <View style={[styles.avatarCircle, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {item.name ? item.name.charAt(0).toUpperCase() : 'A'}
          </Text>
        </View>
        <View style={styles.nameContainer}>
          <Text style={[styles.memberName, { color: colors.text }]}>
            {item.name}
          </Text>
          <Text style={[styles.memberEmail, { color: colors.textSecondary }]}>
            {item.email}
          </Text>
        </View>
      </View>

      <Button
        title="VER HISTORIAL DE ENTRENAMIENTOS ➔"
        variant="primary"
        onPress={() => navigation.navigate('WorkoutHistory', {
          memberId: item.id,
          memberName: item.name
        })}
        style={styles.historyBtn}
      />
    </Card>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.topNavBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            accessibilityRole="button"
          >
            <Text style={[styles.backBtnText, { color: colors.text }]}>← VOLVER</Text>
          </TouchableOpacity>
        </View>

        <DashboardHeader
          title="HISTORIAL DE ALUMNOS"
          subtitle="consultá las marcas y series logradas por los socios a tu cargo"
        />

        {errorMessage && <StatusBanner message={errorMessage} type="error" />}

        <View style={styles.searchBox}>
          <Input
            label="BUSCAR ALUMNO"
            placeholder="Buscar por nombre o correo..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {loading ? (
          <LoadingSpinner message="cargando alumnos asignados..." fullScreen />
        ) : (
          <FlatList
            data={filteredMembers}
            keyExtractor={item => String(item.id)}
            renderItem={renderMemberItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <EmptyState
                title={searchQuery.trim() ? "sin alumnos encontrados" : "sin alumnos asignados"}
                description={searchQuery.trim()
                  ? "no se encontraron socios que coincidan con la búsqueda."
                  : "asigná socios a tus planes de entrenamiento desde el panel para consultar su historial de series y progresiones."
                }
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
    paddingHorizontal: 16
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4
  },
  backBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  searchBox: {
    marginBottom: 12
  },
  listContent: {
    paddingBottom: 32
  },
  memberCard: {
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderRadius: 12
  },
  memberInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '900'
  },
  nameContainer: {
    flex: 1
  },
  memberName: {
    fontSize: 16,
    fontWeight: '800'
  },
  memberEmail: {
    fontSize: 12,
    marginTop: 2
  },
  historyBtn: {
    marginTop: 4
  }
});

export default TrainerStudentsHistoryScreen;
