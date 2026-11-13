// Enrutador raíz que selecciona la pila de navegación según el estado de autenticación y rol.
import React from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import { useAuth } from '../../contexto/authContext';
import { useTheme } from '../../contexto/themeContext';
import { AuthNavigator } from './AuthNavigator';
import { AdminNavigator } from './AdminNavigator';
import { TrainerNavigator } from './TrainerNavigator';
import { MemberNavigator } from './MemberNavigator';
import { LoadingSpinner, Button, Card, WebContainer } from '../../Modules/components/index';
import { styles } from './AppNavigator.styles';

export interface AppNavigatorProps {
  currentRouteName?: string;
  canGoBack?: boolean;
  onNavigate?: (routeName: string, params?: any) => void;
  onGoBack?: () => void;
}

// Selecciona el navegador correspondiente según el estado de sesión y rol del usuario.
export function AppNavigator({
  currentRouteName,
  canGoBack,
  onNavigate,
  onGoBack
}: AppNavigatorProps = {}) {
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
    return (
      <WebContainer>
        <AuthNavigator />
      </WebContainer>
    );
  }

  // navegacion condicional protegida segun el rol autenticado y validado por jwt
  if (role === 'admin') {
    return (
      <WebContainer
        maxWidth={1360}
        currentRouteName={currentRouteName}
        canGoBack={canGoBack}
        onNavigate={onNavigate}
        onGoBack={onGoBack}
      >
        <AdminNavigator />
      </WebContainer>
    );
  }

  if (role === 'trainer') {
    return (
      <WebContainer
        maxWidth={1360}
        currentRouteName={currentRouteName}
        canGoBack={canGoBack}
        onNavigate={onNavigate}
        onGoBack={onGoBack}
      >
        <TrainerNavigator />
      </WebContainer>
    );
  }

  if (role === 'member') {
    return (
      <WebContainer
        maxWidth={1360}
        currentRouteName={currentRouteName}
        canGoBack={canGoBack}
        onNavigate={onNavigate}
        onGoBack={onGoBack}
      >
        <MemberNavigator />
      </WebContainer>
    );
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

export default AppNavigator;
