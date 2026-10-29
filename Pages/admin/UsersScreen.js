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

  // estado para modal de confirmacion de cambio de estado activo/inactivo
  const [modalState, setModalState] = useState({
    visible: false,
    userToToggle: null,
    loading: false
  });

  // estado para modal de confirmacion de cambio de rol (solo entre member y trainer)
  const [roleModalState, setRoleModalState] = useState({
    visible: false,
    targetUser: null,
    selectedRole: null,
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

  // ejecucion de la actualizacion de estado activo/inactivo
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

  // apertura del modal para cambiar rol entre member y trainer
  const handleOpenRoleModal = (targetUser, newRole) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // regla de seguridad: no permitir cambiar roles de cuentas admin ni convertir a admin por esta interfaz
    if (targetUser.role === 'admin') {
      setErrorMessage('las cuentas de administrador no pueden modificarse desde esta opción');
      return;
    }

    if (newRole !== 'member' && newRole !== 'trainer') {
      return;
    }

    if (targetUser.role === newRole) {
      return;
    }

    setRoleModalState({
      visible: true,
      targetUser,
      selectedRole: newRole,
      loading: false
    });
  };

  // confirmacion y guardado del cambio de rol via PATCH /api/users/:id
  const handleConfirmRoleChange = async () => {
    const { targetUser, selectedRole } = roleModalState;
    if (!targetUser || !selectedRole) return;

    setRoleModalState((prev) => ({ ...prev, loading: true }));

    try {
      const res = await userService.updateUser(
        targetUser.id,
        { role: selectedRole },
        token
      );

      if (res?.ok) {
        const roleLabel = selectedRole === 'trainer' ? 'Entrenador' : 'Socio (Member)';
        setSuccessMessage(
          `rol de ${targetUser.name || targetUser.email} actualizado a ${roleLabel} con éxito`
        );
        // actualizacion de la lista tras exito
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, role: selectedRole } : u))
        );
      } else {
        setErrorMessage(res?.error?.message || 'no fue posible actualizar el rol del usuario');
      }
    } catch (error) {
      setErrorMessage(error.message || 'error al comunicar con el servidor al cambiar el rol');
    } finally {
      setRoleModalState({ visible: false, targetUser: null, selectedRole: null, loading: false });
    }
  };

  const renderUserItem = ({ item }) => {
    const isActive = item.is_active === 1 || item.is_active === true;
    const isSelf = String(item.id) === String(currentUser?.id);
    const isAdmin = item.role === 'admin';

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

        {/* selector de rol para usuarios no administradores */}
        {!isAdmin && (
          <View style={styles.roleSelectorSection}>
            <Text style={[styles.roleSelectorLabel, { color: colors.textMuted }]}>
              CAMBIAR ROL:
            </Text>
            <View style={styles.roleChipsRow}>
              <TouchableOpacity
                onPress={() => handleOpenRoleModal(item, 'member')}
                style={[
                  styles.roleChip,
                  { borderColor: colors.border },
                  item.role === 'member' && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary
                  }
                ]}
                accessibilityRole="button"
                accessibilityLabel="asignar rol socio"
              >
                <Text
                  style={[
                    styles.roleChipText,
                    { color: item.role === 'member' ? '#000000' : colors.textSecondary }
                  ]}
                >
                  SOCIO
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleOpenRoleModal(item, 'trainer')}
                style={[
                  styles.roleChip,
                  { borderColor: colors.border },
                  item.role === 'trainer' && {
                    backgroundColor: colors.info || '#3b82f6',
                    borderColor: colors.info || '#3b82f6'
                  }
                ]}
                accessibilityRole="button"
                accessibilityLabel="asignar rol entrenador"
              >
                <Text
                  style={[
                    styles.roleChipText,
                    { color: item.role === 'trainer' ? '#ffffff' : colors.textSecondary }
                  ]}
                >
                  ENTRENADOR
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* barra superior fija y limpia */}
      <View style={styles.topNavBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel="volver al panel"
        >
          <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>
            ← VOLVER
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          USUARIOS DEL SISTEMA
        </Text>
        <View style={styles.navBarSpacer} />
      </View>

      <View style={styles.container}>

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

        {/* modal de confirmacion seguro para activar/desactivar */}
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

        {/* modal de confirmacion para cambio de rol (member <-> trainer) */}
        <ConfirmModal
          visible={roleModalState.visible}
          title="¿cambiar rol de usuario?"
          message={`¿deseas cambiar el rol de ${roleModalState.targetUser?.name || roleModalState.targetUser?.email} a ${roleModalState.selectedRole === 'trainer' ? 'entrenador (trainer)' : 'socio (member)'}?`}
          confirmText="guardar rol"
          cancelText="cancelar"
          loading={roleModalState.loading}
          onConfirm={handleConfirmRoleChange}
          onCancel={() => setRoleModalState({ visible: false, targetUser: null, selectedRole: null, loading: false })}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)'
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4
  },
  navBarSpacer: {
    width: 70
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  searchInput: {
    marginVertical: 4
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 36
  },
  userCard: {
    padding: 12,
    marginVertical: 4
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
    fontSize: 14,
    fontWeight: '800'
  },
  userEmail: {
    fontSize: 12,
    marginTop: 1
  },
  roleSelectorSection: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)'
  },
  roleSelectorLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 5
  },
  roleChipsRow: {
    flexDirection: 'row',
    gap: 6
  },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1
  },
  roleChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  divider: {
    height: 1,
    marginVertical: 8
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
    width: 7,
    height: 7,
    borderRadius: 4
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800'
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '800'
  }
});

export default UsersScreen;
