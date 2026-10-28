import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useAuth } from '../../contexto/authContext.js';
import { useTheme } from '../../contexto/themeContext.js';
import { AuthNavigator } from './AuthNavigator.js';
import { AdminNavigator } from './AdminNavigator.js';
import { TrainerNavigator } from './TrainerNavigator.js';
import { MemberNavigator } from './MemberNavigator.js';
import { LoadingSpinner, Button, Card } from '../../Modules/components/index.js';

export function AppNavigator() {
  const { isAuthenticated, loading, role, logout } = useAuth();
  const { colors } = useTheme();

  // estado de carga inicial de sesion
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <LoadingSpinner message="verificando sesión..." fullScreen />
      </View>
    );
  }

  // flujo publico cuando no hay sesion autenticada
  if (!isAuthenticated) {
    return <AuthNavigator />;
  }

  // navegacion condicional protegida segun el rol autenticado y validado por jwt
  if (role === 'admin') {
    return <AdminNavigator />;
  }

  if (role === 'trainer') {
    return <TrainerNavigator />;
  }

  if (role === 'member') {
    return <MemberNavigator />;
  }

  // estado de seguridad controlado si el rol devuelto no coincide con ninguno valido
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.unknownRoleContainer}>
        <Card style={styles.unknownRoleCard}>
          <Text style={[styles.unknownTitle, { color: colors.danger }]}>
            ROL NO RECONOCIDO
          </Text>
          <Text style={[styles.unknownBody, { color: colors.textSecondary }]}>
            tu cuenta no cuenta con un rol válido asignado en el sistema ({String(role)}).
          </Text>
          <Button
            title="CERRAR SESIÓN"
            variant="danger"
            onPress={logout}
          />
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1
  },
  safeArea: {
    flex: 1
  },
  unknownRoleContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  unknownRoleCard: {
    width: '100%',
    padding: 20
  },
  unknownTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8
  },
  unknownBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16
  }
});

export default AppNavigator;
