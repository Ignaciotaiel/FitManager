import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useTheme } from '../../contexto/themeContext.js';
import { useAuth } from '../../contexto/authContext.js';
import { membershipService } from '../../Modules/memberships/membershipService.js';
import { userService } from '../../Modules/users/userService.js';
import {
  Card,
  Input,
  Button,
  StatusBanner,
  LoadingSpinner,
  EmptyState,
  ConfirmModal
} from '../../Modules/components/index.js';

export function MembershipsScreen({ navigation }) {
  const { colors } = useTheme();
  const { token } = useAuth();

  const [memberships, setMemberships] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // modal de creacion de membresia
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // modal de edicion / renovacion de membresia
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [membershipToEdit, setMembershipToEdit] = useState(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // modal de confirmacion para cancelacion rapida
  const [cancelModal, setCancelModal] = useState({
    visible: false,
    item: null,
    loading: false
  });

  const loadData = useCallback(async () => {
    try {
      setErrorMessage(null);
      const query = statusFilter !== 'all' ? { status: statusFilter } : {};
      const [memRes, userRes] = await Promise.all([
        membershipService.getMemberships(token, query),
        userService.getUsers(token)
      ]);

      if (memRes?.ok && Array.isArray(memRes?.data?.memberships)) {
        setMemberships(memRes.data.memberships);
      }
      if (userRes?.ok && Array.isArray(userRes?.data?.users)) {
        // filtrar solo socios con rol member
        setUsers(userRes.data.users.filter((u) => u.role === 'member'));
      }
    } catch (error) {
      if (error.code === 'NETWORK_ERROR') {
        setErrorMessage('no se pudo conectar con el servidor. revisá tu conexión');
      } else {
        setErrorMessage(error.message || 'error al cargar las membresías');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    setSuccessMessage(null);
    loadData();
  };

  // filtro local por busqueda de nombre o email
  const filteredMemberships = useMemo(() => {
    if (!searchQuery.trim()) return memberships;
    const q = searchQuery.toLowerCase();
    return memberships.filter(
      (m) =>
        m.user_name?.toLowerCase().includes(q) ||
        m.user_email?.toLowerCase().includes(q)
    );
  }, [memberships, searchQuery]);

  // inicializar modal de creacion con fecha de hoy y +30 dias
  const openCreateModal = () => {
    const today = new Date();
    const todayStr = today.toISOString().substring(0, 10);
    const nextMonth = new Date(today);
    nextMonth.setDate(today.getDate() + 30);
    const nextMonthStr = nextMonth.toISOString().substring(0, 10);

    setStartDateInput(todayStr);
    setEndDateInput(nextMonthStr);
    setSelectedUser(null);
    setCreateModalVisible(true);
  };

  const handleCreateSubmit = async () => {
    if (!selectedUser) {
      setErrorMessage('debes seleccionar un socio');
      return;
    }
    if (!startDateInput.trim()) {
      setErrorMessage('la fecha de inicio es requerida');
      return;
    }

    setSubmittingCreate(true);
    setErrorMessage(null);
    try {
      const res = await membershipService.createMembership(
        {
          user_id: selectedUser.id,
          start_date: startDateInput.trim(),
          end_date: endDateInput.trim() ? endDateInput.trim() : null,
          status: 'active'
        },
        token
      );

      if (res?.ok) {
        setSuccessMessage(`membresía asignada a ${selectedUser.name}`);
        setCreateModalVisible(false);
        loadData();
      }
    } catch (error) {
      setErrorMessage(error.message || 'error al crear la membresía');
    } finally {
      setSubmittingCreate(false);
    }
  };

  // abrir modal de edicion
  const openEditModal = (item) => {
    setMembershipToEdit(item);
    setEditStartDate(item.start_date || '');
    setEditEndDate(item.end_date || '');
    setEditStatus(item.status || 'active');
    setEditModalVisible(true);
  };

  const handleEditSubmit = async () => {
    if (!membershipToEdit) return;

    setSubmittingEdit(true);
    setErrorMessage(null);
    try {
      const res = await membershipService.updateMembership(
        membershipToEdit.id,
        {
          start_date: editStartDate.trim(),
          end_date: editEndDate.trim() ? editEndDate.trim() : null,
          status: editStatus
        },
        token
      );

      if (res?.ok) {
        setSuccessMessage('membresía actualizada correctamente');
        setEditModalVisible(false);
        loadData();
      }
    } catch (error) {
      setErrorMessage(error.message || 'error al actualizar la membresía');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // confirmacion de cancelacion
  const handleConfirmCancel = async () => {
    if (!cancelModal.item) return;
    setCancelModal((prev) => ({ ...prev, loading: true }));
    try {
      await membershipService.updateMembership(
        cancelModal.item.id,
        { status: 'cancelled' },
        token
      );
      setSuccessMessage('membresía cancelada con éxito');
      setCancelModal({ visible: false, item: null, loading: false });
      loadData();
    } catch (error) {
      setErrorMessage(error.message || 'error al cancelar la membresía');
      setCancelModal({ visible: false, item: null, loading: false });
    }
  };

  // helper visual para color del badge segun estado
  const getStatusBadge = (status) => {
    let bg = colors.surfaceLight;
    let text = colors.textSecondary;
    let label = 'ACTIVA';

    if (status === 'active') {
      bg = 'rgba(16, 185, 129, 0.15)';
      text = colors.success || '#10b981';
      label = 'ACTIVA';
    } else if (status === 'expired') {
      bg = 'rgba(239, 68, 68, 0.15)';
      text = colors.danger || '#ef4444';
      label = 'VENCIDA';
    } else if (status === 'cancelled') {
      bg = 'rgba(148, 163, 184, 0.15)';
      text = colors.textMuted || '#94a3b8';
      label = 'CANCELADA';
    }

    return (
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.badgeText, { color: text }]}>{label}</Text>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: colors.text }]}>
              {item.user_name}
            </Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
              {item.user_email}
            </Text>
          </View>
          {getStatusBadge(item.status)}
        </View>

        <View style={styles.datesRow}>
          <View style={styles.dateCol}>
            <Text style={[styles.dateLabel, { color: colors.textMuted }]}>INICIO</Text>
            <Text style={[styles.dateValue, { color: colors.text }]}>
              {item.start_date || '—'}
            </Text>
          </View>
          <View style={styles.dateCol}>
            <Text style={[styles.dateLabel, { color: colors.textMuted }]}>VENCE</Text>
            <Text style={[styles.dateValue, { color: colors.text }]}>
              {item.end_date || 'sin límite'}
            </Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <Button
            title="RENOVAR / EDITAR"
            variant="secondary"
            size="small"
            onPress={() => openEditModal(item)}
            style={{ flex: 1, marginRight: 8 }}
          />
          {item.status === 'active' ? (
            <Button
              title="CANCELAR"
              variant="outline"
              size="small"
              onPress={() => setCancelModal({ visible: true, item, loading: false })}
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        {/* Cabecera */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.backBtnText, { color: colors.text }]}>← VOLVER</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            MEMBRESÍAS
          </Text>
        </View>

        {errorMessage && (
          <StatusBanner
            message={errorMessage}
            type="error"
            onDismiss={() => setErrorMessage(null)}
          />
        )}
        {successMessage && (
          <StatusBanner
            message={successMessage}
            type="success"
            onDismiss={() => setSuccessMessage(null)}
          />
        )}

        {/* Accion de creacion */}
        <Button
          title="+ ASIGNAR NUEVA MEMBRESÍA"
          variant="primary"
          onPress={openCreateModal}
          style={styles.createBtn}
        />

        {/* Buscador */}
        <Input
          placeholder="buscar socio por nombre o correo..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />

        {/* Filtros por estado */}
        <View style={styles.filterRow}>
          {[
            { id: 'all', label: 'TODAS' },
            { id: 'active', label: 'ACTIVAS' },
            { id: 'expired', label: 'VENCIDAS' },
            { id: 'cancelled', label: 'CANCELADAS' }
          ].map((f) => {
            const isSelected = statusFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setStatusFilter(f.id)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border
                  }
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isSelected ? '#ffffff' : colors.textSecondary }
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Lista de membresias */}
        {loading ? (
          <LoadingSpinner message="cargando registros de membresías..." />
        ) : (
          <FlatList
            data={filteredMemberships}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <EmptyState
                title="no se encontraron membresías"
                description="no hay registros que coincidan con los filtros o la búsqueda."
              />
            }
          />
        )}

        {/* Modal de Asignacion de Membresia */}
        <Modal
          visible={createModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setCreateModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                ASIGNAR MEMBRESÍA
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                selecciona un socio y define el período de cobertura.
              </Text>

              <ScrollView style={{ maxHeight: 350 }}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  SELECCIONAR SOCIO ({users.length} DISPONIBLES)
                </Text>
                <View style={styles.userPickerContainer}>
                  {users.map((u) => {
                    const isPicked = selectedUser?.id === u.id;
                    return (
                      <TouchableOpacity
                        key={u.id}
                        onPress={() => setSelectedUser(u)}
                        style={[
                          styles.userPickItem,
                          {
                            backgroundColor: isPicked ? colors.primaryLight : colors.background,
                            borderColor: isPicked ? colors.primary : colors.border
                          }
                        ]}
                      >
                        <Text style={[styles.userPickName, { color: isPicked ? colors.primary : colors.text }]}>
                          {u.name}
                        </Text>
                        <Text style={[styles.userPickEmail, { color: colors.textSecondary }]}>
                          {u.email}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Input
                  label="FECHA DE INICIO (YYYY-MM-DD)"
                  value={startDateInput}
                  onChangeText={setStartDateInput}
                  placeholder="2026-10-27"
                  style={{ marginTop: 12 }}
                />

                <Input
                  label="FECHA DE FIN / VENCIMIENTO (YYYY-MM-DD)"
                  value={endDateInput}
                  onChangeText={setEndDateInput}
                  placeholder="2026-11-27"
                  style={{ marginTop: 12 }}
                />
              </ScrollView>

              <View style={styles.modalBtnRow}>
                <Button
                  title="CANCELAR"
                  variant="outline"
                  onPress={() => setCreateModalVisible(false)}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title={submittingCreate ? 'GUARDANDO...' : 'CONFIRMAR'}
                  variant="primary"
                  onPress={handleCreateSubmit}
                  disabled={submittingCreate}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Modal de Edicion / Renovacion */}
        <Modal
          visible={editModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setEditModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                RENOVAR O EDITAR MEMBRESÍA
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                socio: {membershipToEdit?.user_name} ({membershipToEdit?.user_email})
              </Text>

              <ScrollView style={{ maxHeight: 300 }}>
                <Input
                  label="FECHA DE INICIO (YYYY-MM-DD)"
                  value={editStartDate}
                  onChangeText={setEditStartDate}
                  placeholder="YYYY-MM-DD"
                  style={{ marginTop: 12 }}
                />

                <Input
                  label="FECHA DE VENCIMIENTO (YYYY-MM-DD)"
                  value={editEndDate}
                  onChangeText={setEditEndDate}
                  placeholder="YYYY-MM-DD"
                  style={{ marginTop: 12 }}
                />

                <Text style={[styles.inputLabel, { color: colors.text, marginTop: 14 }]}>
                  ESTADO DE LA MEMBRESÍA
                </Text>
                <View style={styles.statusOptionRow}>
                  {['active', 'expired', 'cancelled'].map((st) => {
                    const isSelected = editStatus === st;
                    return (
                      <TouchableOpacity
                        key={st}
                        onPress={() => setEditStatus(st)}
                        style={[
                          styles.statusOptionBtn,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.background,
                            borderColor: isSelected ? colors.primary : colors.border
                          }
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusOptionText,
                            { color: isSelected ? '#ffffff' : colors.text }
                          ]}
                        >
                          {st.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={styles.modalBtnRow}>
                <Button
                  title="CANCELAR"
                  variant="outline"
                  onPress={() => setEditModalVisible(false)}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title={submittingEdit ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                  variant="primary"
                  onPress={handleEditSubmit}
                  disabled={submittingEdit}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Modal de confirmacion de cancelacion */}
        <ConfirmModal
          visible={cancelModal.visible}
          title="CANCELAR MEMBRESÍA"
          message={`¿seguro que deseas cancelar la membresía activa de ${cancelModal.item?.user_name}?`}
          confirmText="SÍ, CANCELAR"
          cancelText="VOLVER"
          onConfirm={handleConfirmCancel}
          onCancel={() => setCancelModal({ visible: false, item: null, loading: false })}
          loading={cancelModal.loading}
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
    paddingHorizontal: 16,
    paddingTop: 12
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 12
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '700'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  createBtn: {
    marginBottom: 12
  },
  searchInput: {
    marginBottom: 12
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 6
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700'
  },
  listContent: {
    paddingBottom: 24
  },
  card: {
    marginBottom: 12
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  userName: {
    fontSize: 15,
    fontWeight: '700'
  },
  userEmail: {
    fontSize: 12,
    marginTop: 2
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800'
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
    marginBottom: 10
  },
  dateCol: {
    flex: 1
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 16
  },
  modalContent: {
    borderRadius: 12,
    padding: 20
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4
  },
  modalSubtitle: {
    fontSize: 12,
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8
  },
  userPickerContainer: {
    maxHeight: 140,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 8,
    padding: 6
  },
  userPickItem: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 4
  },
  userPickName: {
    fontSize: 13,
    fontWeight: '700'
  },
  userPickEmail: {
    fontSize: 11
  },
  statusOptionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 12
  },
  statusOptionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center'
  },
  statusOptionText: {
    fontSize: 11,
    fontWeight: '700'
  },
  modalBtnRow: {
    flexDirection: 'row',
    marginTop: 18
  }
});

export default MembershipsScreen;
