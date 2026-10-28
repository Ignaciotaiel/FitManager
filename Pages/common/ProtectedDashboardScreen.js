import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useAuth } from '../../contexto/authContext.js';
import { useTheme } from '../../contexto/themeContext.js';
import { Button, Card } from '../../Modules/components/index.js';

// pantalla de inicio del area protegida (marcador de posicion ordenado previo al paso 5)
export function ProtectedDashboardScreen() {
  const { user, logout } = useAuth();
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
              {roleLabels[user?.role] || user?.role || 'socio'}
            </Text>
          </View>
        </View>

        <Card style={styles.infoCard}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            sesion autenticada con exito
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
            title="CERRAR SESIÓN"
            variant="danger"
            onPress={logout}
          />
        </View>
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
    paddingHorizontal: 22,
    paddingVertical: 18,
    justifyContent: 'space-between'
  },
  header: {
    marginTop: 10
  },
  brandTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 8
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1
  },
  roleText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  infoCard: {
    padding: 18
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12
  },
  cardCaption: {
    fontSize: 12,
    marginTop: 4
  },
  actions: {
    paddingBottom: 10
  }
});

export default ProtectedDashboardScreen;
