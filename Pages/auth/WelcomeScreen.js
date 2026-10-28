import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexto/themeContext.js';
import { useAuth } from '../../contexto/authContext.js';
import { Button, Card } from '../../Modules/components/index.js';

export function WelcomeScreen({ navigation }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { hasPersistedSession, resumeSession, user } = useAuth();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        {/* barra superior con selector de tema discreto */}
        <View style={styles.topBar}>
          <View style={styles.brandBadge}>
            <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.brandText, { color: colors.textSecondary }]}>
              FITMANAGER PRO
            </Text>
          </View>

          <TouchableOpacity
            onPress={toggleTheme}
            style={[styles.themeToggle, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="cambiar tema"
          >
            <Text style={[styles.themeToggleText, { color: colors.textSecondary }]}>
              {isDark ? 'MODO CLARO' : 'MODO OSCURO'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* seccion central de presentacion */}
        <View style={styles.heroSection}>
          <Text style={[styles.title, { color: colors.text }]}>
            GESTIÓN DEPORTIVA Y ENTRENAMIENTO
          </Text>

          <View style={[styles.accentLine, { backgroundColor: colors.primary }]} />

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            administrá socios, rutinas y entrenamientos en un solo lugar con seguimiento profesional.
          </Text>

          {/* caracteristicas funcionales del gimnasio */}
          <Card style={styles.featuresCard}>
            <View style={styles.featureItem}>
              <Text style={[styles.featureBullet, { color: colors.primary }]}>01</Text>
              <View style={styles.featureTextWrapper}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>panel por roles</Text>
                <Text style={[styles.featureSubtitle, { color: colors.textSecondary }]}>
                  administrador, entrenador y socio
                </Text>
              </View>
            </View>

            <View style={[styles.separator, { backgroundColor: colors.border }]} />

            <View style={styles.featureItem}>
              <Text style={[styles.featureBullet, { color: colors.primary }]}>02</Text>
              <View style={styles.featureTextWrapper}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>rutinas y ejercicios</Text>
                <Text style={[styles.featureSubtitle, { color: colors.textSecondary }]}>
                  planificación de series, repeticiones y descansos
                </Text>
              </View>
            </View>

            <View style={[styles.separator, { backgroundColor: colors.border }]} />

            <View style={styles.featureItem}>
              <Text style={[styles.featureBullet, { color: colors.primary }]}>03</Text>
              <View style={styles.featureTextWrapper}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>gestión y seguimiento</Text>
                <Text style={[styles.featureSubtitle, { color: colors.textSecondary }]}>
                  control de cuentas y entrenamiento activo
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* acciones de navegacion */}
        <View style={styles.actionsSection}>
          {hasPersistedSession ? (
            <Button
              title={`CONTINUAR SESIÓN (${user?.name || user?.email?.split('@')[0] || 'USUARIO'})`}
              variant="primary"
              onPress={resumeSession}
              style={{ marginBottom: 8 }}
            />
          ) : null}
          <Button
            title="INICIAR SESIÓN"
            variant={hasPersistedSession ? 'secondary' : 'primary'}
            onPress={() => navigation.navigate('Login')}
          />
          <Button
            title="CREAR CUENTA"
            variant="secondary"
            onPress={() => navigation.navigate('Register')}
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
    justifyContent: 'space-between',
    paddingVertical: 14
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  brandText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1
  },
  themeToggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  themeToggleText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  heroSection: {
    marginVertical: 'auto'
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    letterSpacing: 0.5
  },
  accentLine: {
    width: 48,
    height: 4,
    borderRadius: 2,
    marginVertical: 14
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20
  },
  featuresCard: {
    padding: 14,
    marginVertical: 0
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6
  },
  featureBullet: {
    fontSize: 14,
    fontWeight: '800',
    width: 32
  },
  featureTextWrapper: {
    flex: 1
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize'
  },
  featureSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  separator: {
    height: 1,
    marginVertical: 4
  },
  actionsSection: {
    paddingTop: 12
  }
});

export default WelcomeScreen;
