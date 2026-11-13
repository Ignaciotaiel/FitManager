// Pantalla inicial de presentación de FitManager con accesos a inicio de sesión y registro.
import React from 'react';
import type { ScreenProps } from '../../Scripts/navigation/types';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexto/themeContext';
import { withAlpha } from '../../Styles/theme/colors';
import { useAuth } from '../../contexto/authContext';
import { Button, Card, StatusBanner } from '../../Modules/components/index';
import { styles } from './WelcomeScreen.styles';

// Pantalla de bienvenida adaptable a móvil y escritorio con accesos rápidos de cuenta.
export function WelcomeScreen({ navigation }: ScreenProps<'Welcome'>) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { hasPersistedSession, resumeSession, user, oauthFeedback, clearOauthFeedback } = useAuth();
  const { width } = useWindowDimensions();

  const isDesktop = Platform.OS === 'web' && width >= 960;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && styles.scrollContentDesktop
        ]}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
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

        {oauthFeedback ? (
          <View style={{ marginBottom: 12 }}>
            <StatusBanner
              message={oauthFeedback.message}
              type={oauthFeedback.type === 'error' ? 'error' : 'warning'}
            />
          </View>
        ) : null}

        {isDesktop ? (
          /* COMPOSICION DE DOS COLUMNAS PARA ESCRITORIO */
          <View style={styles.desktopGrid}>
            {/* Columna izquierda: Presentacion, descripcion y caracteristicas */}
            <View style={styles.desktopLeftCol}>
              <View
                style={[
                  styles.desktopTag,
                  {
                    backgroundColor: withAlpha(colors.primary, 0.14),
                    borderColor: colors.primary
                  }
                ]}
              >
                <Ionicons name="barbell-outline" size={14} color={colors.primary} />
                <Text style={[styles.desktopTagText, { color: colors.primary }]}>
                  PLATAFORMA INTEGRAL DE GIMNASIOS
                </Text>
              </View>

              <Text style={[styles.desktopTitle, { color: colors.text }]}>
                GESTIÓN DEPORTIVA Y ENTRENAMIENTO
              </Text>

              <View style={[styles.accentLine, { backgroundColor: colors.primary }]} />

              <Text style={[styles.desktopDescription, { color: colors.textSecondary }]}>
                Administrá socios, rutinas, cargas y evolución deportiva en un único entorno profesional tanto desde tu computadora como desde la app Android.
              </Text>

              <Card style={styles.featuresCard}>
                <View style={styles.featureItem}>
                  <Text style={[styles.featureBullet, { color: colors.primary }]}>01</Text>
                  <View style={styles.featureTextWrapper}>
                    <Text style={[styles.featureTitle, { color: colors.text }]}>Panel por roles</Text>
                    <Text style={[styles.featureSubtitle, { color: colors.textSecondary }]}>
                      Administrador, entrenador y socio con permisos dedicados
                    </Text>
                  </View>
                </View>

                <View style={[styles.separator, { backgroundColor: colors.border }]} />

                <View style={styles.featureItem}>
                  <Text style={[styles.featureBullet, { color: colors.primary }]}>02</Text>
                  <View style={styles.featureTextWrapper}>
                    <Text style={[styles.featureTitle, { color: colors.text }]}>Rutinas y ejercicios</Text>
                    <Text style={[styles.featureSubtitle, { color: colors.textSecondary }]}>
                      Planificación de series, repeticiones, tiempos y asignaciones múltiples
                    </Text>
                  </View>
                </View>

                <View style={[styles.separator, { backgroundColor: colors.border }]} />

                <View style={styles.featureItem}>
                  <Text style={[styles.featureBullet, { color: colors.primary }]}>03</Text>
                  <View style={styles.featureTextWrapper}>
                    <Text style={[styles.featureTitle, { color: colors.text }]}>Seguimiento y métricas</Text>
                    <Text style={[styles.featureSubtitle, { color: colors.textSecondary }]}>
                      Gráficos de progreso por ejercicio, auditoría y reportes CSV
                    </Text>
                  </View>
                </View>
              </Card>
            </View>

            {/* Columna derecha: Tarjeta de acceso a la cuenta */}
            <View style={styles.desktopRightCol}>
              <Card style={[styles.accessCard, { borderColor: colors.border }]}>
                <View
                  style={[
                    styles.accessIconWrap,
                    { backgroundColor: withAlpha(colors.primary, 0.14) }
                  ]}
                >
                  <Ionicons name="shield-checkmark-outline" size={26} color={colors.primary} />
                </View>

                <Text style={[styles.accessTitle, { color: colors.text }]}>
                  ACCESO A TU CUENTA
                </Text>
                <Text style={[styles.accessSubtitle, { color: colors.textSecondary }]}>
                  Ingresá con tu cuenta de FitManager o continuá con Google para acceder a tu panel según tu rol asignado.
                </Text>

                <View style={styles.desktopActionsBox}>
                  {hasPersistedSession ? (
                    <Button
                      title={`CONTINUAR SESIÓN (${user?.name || user?.email?.split('@')[0] || 'USUARIO'})`}
                      variant="primary"
                      onPress={() => {
                        clearOauthFeedback();
                        resumeSession();
                      }}
                    />
                  ) : null}
                  <Button
                    title="INICIAR SESIÓN"
                    variant={hasPersistedSession ? 'secondary' : 'primary'}
                    onPress={() => {
                      clearOauthFeedback();
                      navigation.navigate('Login');
                    }}
                  />
                  <Button
                    title="CREAR CUENTA"
                    variant="secondary"
                    onPress={() => {
                      clearOauthFeedback();
                      navigation.navigate('Register');
                    }}
                  />
                </View>

                <View style={[styles.accessFooterNote, { borderTopColor: colors.border }]}>
                  <Ionicons name="laptop-outline" size={15} color={colors.textMuted} />
                  <Text style={[styles.accessFooterText, { color: colors.textMuted }]}>
                    Sincronizado en tiempo real con la aplicación Android FitManager
                  </Text>
                </View>
              </Card>
            </View>
          </View>
        ) : (
          /* COMPOSICION MOVIL (INTACTA PARA ANDROID Y PANTALLAS CHICAS) */
          <>
            <View style={styles.heroSection}>
              <Text style={[styles.title, { color: colors.text }]}>
                GESTIÓN DEPORTIVA Y ENTRENAMIENTO
              </Text>

              <View style={[styles.accentLine, { backgroundColor: colors.primary }]} />

              <Text style={[styles.description, { color: colors.textSecondary }]}>
                administrá socios, rutinas y entrenamientos en un solo lugar con seguimiento profesional.
              </Text>

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

            <View style={styles.actionsSection}>
              {hasPersistedSession ? (
                <Button
                  title={`CONTINUAR SESIÓN (${user?.name || user?.email?.split('@')[0] || 'USUARIO'})`}
                  variant="primary"
                  onPress={resumeSession}
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default WelcomeScreen;
