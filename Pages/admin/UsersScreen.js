import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { userService } from '../../Modules/users/userService.js';
import {
  Card,
  Input,
  Button,
  RoleBadge,
  StatusBanner,
  LoadingSpinner,
  EmptyState,
  ConfirmModal
} from '../../Modules/components/index.js';

export function UsersScreen({ navigation }) {
  const { colors } = useTheme();
  const { token, user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // estado para modal de confirmacion de cambio de estado
  const [modalState, setModalState] = useState({
    visible: false,
    userToToggle: null,
    loading: false
  });

  // consulta real de usuarios al backend
  const loadUsers = useCallback(async () => {
    try {
      setErrorMessage(null);
      const res = await userService.getUsers(token);
      if (res?.ok && Array.isArray(res?.data?.users)) {
        setUsers(res.data.users);
      }
    } catch (error) {
      if (error.code === 'NETWORK_ERROR') {
        setErrorMessage('no se pudo conectar con el servidor. revisá tu conexión');
      } else {
        setErrorMessage(error.message || 'error al cargar usuarios');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  // filtrado en cliente por nombre o email
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  // apertura del modal de confirmacion con comprobacion de seguridad
  const handleOpenToggleStatus = (targetUser) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // regla de seguridad: evitar que el administrador se deshabilite a si mismo
    if (String(targetUser.id) === String(currentUser?.id)) {
      setErrorMessage('por seguridad no puedes desactivar tu propia cuenta de administrador');
      return;
    }

    setModalState({
      visible: true,
      userToToggle: targetUser,
      loading: false
    });
  };

  // ejecucion de la actualizacion en el backend
  const handleConfirmToggle = async () => {
    const targetUser = modalState.userToToggle;
    if (!targetUser) return;

    setModalState((prev) => ({ ...prev, loading: true }));
    const newStatus = targetUser.is_active ? 0 : 1;

    try {
      const res = await userService.updateUser(
        targetUser.id,
        { is_active: newStatus },
        token
      );

      if (res?.ok) {
        setSuccessMessage(
          `usuario ${targetUser.name || targetUser.email} ${newStatus ? 'activado' : 'desactivado'} con éxito`
        );
        // actualizacion local optimista confirmada
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: newStatus } : u))
        );
      }
    } catch (error) {
      setErrorMessage(error.message || 'no fue posible actualizar el estado del usuario');
    } finally {
      setModalState({ visible: false, userToToggle: null, loading: false });
    }
  };

  const renderUserItem = ({ item }) => {
    const isActive = item.is_active === 1 || item.is_active === true;
    const isSelf = String(item.id) === String(currentUser?.id);

    return (
      <Card style={styles.userCard}>
        <View style={styles.userCardTop}>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>
              {item.name} {isSelf ? '(tu cuenta)' : ''}
            </Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
              {item.email}
            </Text>
          </View>
          <RoleBadge role={item.role} />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.userCardBottom}>
          <View style={styles.statusIndicator}>
            <View
              style={[
                styles.dot,
                { backgroundColor: isActive ? colors.success : colors.danger }
              ]}
            />
            <Text style={[styles.statusText, { color: isActive ? colors.success : colors.danger }]}>
              {isActive ? 'ACTIVO' : 'DESACTIVADO'}
            </Text>
          </View>

          {!isSelf && (
            <TouchableOpacity
              onPress={() => handleOpenToggleStatus(item)}
              style={[
                styles.toggleBtn,
                {
                  borderColor: isActive ? colors.danger : colors.success,
                  backgroundColor: isActive ? colors.dangerSurface : 'rgba(16, 185, 129, 0.15)'
                }
              ]}
              accessibilityRole="button"
              accessibilityLabel={isActive ? 'desactivar usuario' : 'activar usuario'}
            >
              <Text style={[styles.toggleBtnText, { color: isActive ? colors.danger : colors.success }]}>
                {isActive ? 'DESACTIVAR' : 'ACTIVAR'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        {/* cabecera con boton volver */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="volver al panel"
          >
            <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>
              VOLVER
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            USUARIOS DEL SISTEMA
          </Text>
        </View>

        {errorMessage && <StatusBanner message={errorMessage} type="error" />}
        {successMessage && <StatusBanner message={successMessage} type="success" />}

        {/* buscador */}
        <Input
          placeholder="buscar por nombre o correo..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />

        {loading ? (
          <LoadingSpinner message="cargando usuarios..." />
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderUserItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <EmptyState
                title="no hay usuarios para mostrar"
                description={
                  searchQuery
                    ? 'no se encontraron coincidencias para la búsqueda'
                    : 'no existen usuarios registrados en la base de datos'
                }
              />
            }
          />
        )}

        {/* modal de confirmacion seguro */}
        <ConfirmModal
          visible={modalState.visible}
          title={
            modalState.userToToggle?.is_active
              ? '¿desactivar cuenta de usuario?'
              : '¿activar cuenta de usuario?'
          }
          message={`esta acción cambiará el estado de acceso de ${modalState.userToToggle?.name || modalState.userToToggle?.email}.`}
          confirmText={modalState.userToToggle?.is_active ? 'desactivar' : 'activar'}
          isDestructive={Boolean(modalState.userToToggle?.is_active)}
          loading={modalState.loading}
          onConfirm={handleConfirmToggle}
          onCancel={() => setModalState({ visible: false, userToToggle: null, loading: false })}
        />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: '800'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900'
  },
  searchInput: {
    marginVertical: 4
  },
  listContent: {
    paddingBottom: 20
  },
  userCard: {
    padding: 14,
    marginVertical: 6
  },
  userCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  userInfo: {
    flex: 1,
    paddingRight: 8
  },
  userName: {
    fontSize: 15,
    fontWeight: '800'
  },
  userEmail: {
    fontSize: 13,
    marginTop: 2
  },
  divider: {
    height: 1,
    marginVertical: 10
  },
  userCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800'
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '800'
  }
});

export default UsersScreen;
