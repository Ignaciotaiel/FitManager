// Pantalla base de respaldo para sesiones autenticadas con resumen de identidad y rol.
import React from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import { useAuth } from '../../contexto/authContext';
import { useTheme } from '../../contexto/themeContext';
import { Button, Card } from '../../Modules/components/index';
import { styles } from './ProtectedDashboardScreen.styles';

// pantalla de inicio del area protegida (marcador de posicion ordenado previo al paso 5)
export function ProtectedDashboardScreen() {
  const { user, exitApp, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();

  const roleLabels = {
    admin: 'administrador del gimnasio',
    trainer: 'entrenador deportivo',
    member: 'socio del gimnasio'
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.brandTitle, { color: colors.primary }]}>
            FITMANAGER PRO
          </Text>
          <Text style={[styles.welcomeText, { color: colors.text }]}>
            hola, {user?.name || user?.email || 'usuario'}
          </Text>
          <View style={[styles.roleBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.roleText, { color: colors.primary }]}>
              {roleLabels[user?.role as string] || user?.role || 'socio'}
            </Text>
          </View>
        </View>

        <Card style={styles.infoCard}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            sesión autenticada con éxito
          </Text>
          <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
            tu identidad fue verificada por el backend mediante token jwt firmado.
          </Text>
          <Text style={[styles.cardCaption, { color: colors.textMuted }]}>
            correo verificado: {user?.email}
          </Text>
          <Text style={[styles.cardCaption, { color: colors.textMuted }]}>
            rol asignado: {user?.role}
          </Text>
        </Card>

        <View style={styles.actions}>
          <Button
            title={`CAMBIAR A MODO ${isDark ? 'CLARO' : 'OSCURO'}`}
            variant="secondary"
            onPress={toggleTheme}
          />
          <Button
            title="SALIR DE FITMANAGER"
            variant="secondary"
            onPress={exitApp}
          />
          <Button
            title="CERRAR SESIÓN POR COMPLETO"
            variant="danger"
            onPress={logout}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

export default ProtectedDashboardScreen;
