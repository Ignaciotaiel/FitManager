// Muestra gráficos de evolución de cargas, récords personales y métricas por ejercicio.
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexto/themeContext';
import { withAlpha } from '../../Styles/theme/colors';
import { workoutService } from '../workouts/workoutService';
import { formatDateAR, toLocalIsoDate } from '../utils/dateFormat';
import Card from './Card';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';
import StatusBanner from './StatusBanner';
import { styles } from './ExerciseProgressSection.styles';

export interface ExerciseOption {
  id: number;
  name: string;
  muscleGroup?: string | null;
}

export interface ExerciseProgressSectionProps {
  token?: string | null;
  memberId?: number | string;
  memberName?: string;
  sessions?: any[];
}

type PeriodKey = '30d' | '90d' | 'all';

interface DailyExercisePoint {
  isoDate: string;
  displayDate: string;
  shortDate: string;
  maxWeight: number;
  bestRepsAtMax: number;
  setsCount: number;
}

const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string }> = [
  { key: '30d', label: '30 DÍAS' },
  { key: '90d', label: '3 MESES' },
  { key: 'all', label: 'HISTÓRICO' }
];

// Renderiza el selector de ejercicios, métricas máximas y gráficos de evolución de cargas.
export function ExerciseProgressSection({
  token,
  memberId,
  memberName,
  sessions = []
}: ExerciseProgressSectionProps) {
  const { colors } = useTheme();

  // Extraer ejercicios únicos realizados por el usuario a partir de sus sesiones
  const availableExercises = useMemo<ExerciseOption[]>(() => {
    const map = new Map<number, ExerciseOption>();
    sessions.forEach((session) => {
      if (!Array.isArray(session?.sets)) return;
      session.sets.forEach((st: any) => {
        const exId = Number(st?.exercise_id);
        if (!Number.isInteger(exId) || exId <= 0) return;
        if (!map.has(exId)) {
          map.set(exId, {
            id: exId,
            name: st.exercise_name || `Ejercicio #${exId}`,
            muscleGroup: st.muscle_group || null
          });
        }
      });
    });
    return Array.from(map.values());
  }, [sessions]);

  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  // Seleccionar el primer ejercicio disponible por defecto
  useEffect(() => {
    if (availableExercises.length === 0) {
      setSelectedExerciseId(null);
      setRawLogs([]);
      return;
    }
    const stillExists = availableExercises.some((ex) => ex.id === selectedExerciseId);
    if (!stillExists) {
      setSelectedExerciseId(availableExercises[0].id);
    }
  }, [availableExercises, selectedExerciseId]);

  const fetchExerciseHistory = useCallback(async () => {
    if (!selectedExerciseId) return;
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = {};
      if (memberId) params.member_id = memberId;

      const res = await workoutService.getExerciseHistory(selectedExerciseId, params, token);
      if (res?.ok && Array.isArray(res?.data?.history)) {
        setRawLogs(res.data.history);
      } else {
        setRawLogs([]);
      }
      setSelectedPointIndex(null);
    } catch (err: any) {
      if (err?.status === 403) {
        setError('no tenés permiso para consultar el progreso de este usuario');
      } else if (err?.code === 'NETWORK_ERROR') {
        setError('no se pudo conectar con el servidor para obtener la evolución del ejercicio');
      } else {
        setError(err?.message || 'error al obtener los registros del ejercicio');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedExerciseId, memberId, token]);

  useEffect(() => {
    if (selectedExerciseId) {
      fetchExerciseHistory();
    }
  }, [selectedExerciseId, fetchExerciseHistory]);

  // Agrupar registros por fecha de entrenamiento (tomando el mayor peso logrado cada día)
  const allPoints = useMemo<DailyExercisePoint[]>(() => {
    const byDate = new Map<string, DailyExercisePoint>();

    rawLogs.forEach((log) => {
      const isoDate = toLocalIsoDate(log.session_date || log.created_at);
      if (!isoDate) return;
      const weight = Number(log.weight_kg) || 0;
      const reps = Number(log.reps_completed) || 0;
      const displayDate = formatDateAR(isoDate);
      const shortDate = displayDate.slice(0, 5); // DD/MM

      const current = byDate.get(isoDate);
      if (!current) {
        byDate.set(isoDate, {
          isoDate,
          displayDate,
          shortDate,
          maxWeight: weight,
          bestRepsAtMax: reps,
          setsCount: 1
        });
      } else {
        current.setsCount += 1;
        if (weight > current.maxWeight || (weight === current.maxWeight && reps > current.bestRepsAtMax)) {
          current.maxWeight = weight;
          current.bestRepsAtMax = reps;
        }
      }
    });

    // Orden cronológico ascendente (más antiguo a más reciente)
    return Array.from(byDate.values()).sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  }, [rawLogs]);

  // Filtrar puntos según el período seleccionado
  const filteredPoints = useMemo<DailyExercisePoint[]>(() => {
    if (period === 'all') return allPoints;
    const daysLimit = period === '30d' ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysLimit);
    const cutoffIso = toLocalIsoDate(cutoff);
    return allPoints.filter((pt) => pt.isoDate >= cutoffIso);
  }, [allPoints, period]);

  // Mostrar hasta las últimas 10 sesiones en el gráfico de barras para máxima claridad visual
  const chartPoints = useMemo<DailyExercisePoint[]>(() => {
    return filteredPoints.slice(-10);
  }, [filteredPoints]);

  // Estadísticas clave reales (sobre el histórico completo y sobre el período)
  const metrics = useMemo(() => {
    if (allPoints.length === 0) return null;

    const latestPoint = allPoints[allPoints.length - 1];
    const previousPoint = allPoints.length >= 2 ? allPoints[allPoints.length - 2] : null;
    const firstInPeriod = filteredPoints.length >= 2 ? filteredPoints[0] : null;
    const lastInPeriod = filteredPoints.length >= 1 ? filteredPoints[filteredPoints.length - 1] : latestPoint;

    let bestPoint = allPoints[0];
    allPoints.forEach((pt) => {
      if (pt.maxWeight > bestPoint.maxWeight) {
        bestPoint = pt;
      }
    });

    const diffFromPrev = previousPoint
      ? Number((latestPoint.maxWeight - previousPoint.maxWeight).toFixed(1))
      : null;

    const diffInPeriod = firstInPeriod && lastInPeriod && firstInPeriod.isoDate !== lastInPeriod.isoDate
      ? Number((lastInPeriod.maxWeight - firstInPeriod.maxWeight).toFixed(1))
      : null;

    // Comprobar si lleva más de 30 días sin actividad en este ejercicio
    const lastDateObj = new Date(`${latestPoint.isoDate}T12:00:00`);
    const daysSinceLast = Math.floor((Date.now() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));
    const isInactiveRecently = daysSinceLast > 30;

    return {
      latestPoint,
      previousPoint,
      bestPoint,
      diffFromPrev,
      diffInPeriod,
      firstInPeriod,
      daysSinceLast,
      isInactiveRecently
    };
  }, [allPoints, filteredPoints]);

  const maxChartWeight = useMemo(() => {
    if (chartPoints.length === 0) return 1;
    return Math.max(...chartPoints.map((p) => p.maxWeight), 1);
  }, [chartPoints]);

  const selectedExercise = useMemo(
    () => availableExercises.find((e) => e.id === selectedExerciseId) || null,
    [availableExercises, selectedExerciseId]
  );

  if (availableExercises.length === 0) {
    return null;
  }

  const activePoint =
    selectedPointIndex !== null && chartPoints[selectedPointIndex]
      ? chartPoints[selectedPointIndex]
      : chartPoints.length > 0
        ? chartPoints[chartPoints.length - 1]
        : null;

  return (
    <Card style={styles.card}>
      {/* Cabecera de la sección de progreso */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleWrap}>
          <View style={[styles.iconBadge, { backgroundColor: withAlpha(colors.primary, 0.14) }]}>
            <Ionicons name="trending-up-outline" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              EVOLUCIÓN POR EJERCICIO
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              {memberName
                ? `Progreso de cargas de ${memberName}`
                : 'Seleccioná un ejercicio para ver tu progreso de pesos'}
            </Text>
          </View>
        </View>
      </View>

      {/* Selector horizontal de ejercicios realizados */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.exerciseChipsRow}
      >
        {availableExercises.map((ex) => {
          const isSelected = ex.id === selectedExerciseId;
          return (
            <TouchableOpacity
              key={`ex-prog-${ex.id}`}
              onPress={() => setSelectedExerciseId(ex.id)}
              activeOpacity={0.8}
              style={[
                styles.exerciseChip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border
                }
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                style={[
                  styles.exerciseChipText,
                  { color: isSelected ? colors.primaryText : colors.text }
                ]}
                numberOfLines={1}
              >
                {ex.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Selector de período cuando existen varios registros */}
      {allPoints.length >= 2 && (
        <View style={[styles.periodRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {PERIOD_OPTIONS.map((opt) => {
            const active = period === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => {
                  setPeriod(opt.key);
                  setSelectedPointIndex(null);
                }}
                style={[
                  styles.periodBtn,
                  active && {
                    backgroundColor: colors.card,
                    borderColor: colors.primary,
                    borderWidth: 1
                  }
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.periodBtnText,
                    { color: active ? colors.primary : colors.textSecondary }
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Estado: Cargando */}
      {loading ? (
        <View style={styles.stateBox}>
          <LoadingSpinner message="cargando evolución del ejercicio..." />
        </View>
      ) : error ? (
        /* Estado: Error con opción de reintentar */
        <View style={styles.stateBox}>
          <StatusBanner message={error} type="error" />
          <Button
            title="REINTENTAR"
            variant="secondary"
            onPress={fetchExerciseHistory}
            style={{ marginTop: 8 }}
          />
        </View>
      ) : !metrics || allPoints.length === 0 ? (
        /* Estado: Sin registros */
        <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="barbell-outline" size={24} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Sin registros en este ejercicio
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Todavía no hay series guardadas para {selectedExercise?.name || 'este ejercicio'}.
          </Text>
        </View>
      ) : (
        <>
          {/* Aviso si el ejercicio no tiene actividad reciente (> 30 días) */}
          {metrics.isInactiveRecently && (
            <View
              style={[
                styles.inactivityBanner,
                {
                  backgroundColor: withAlpha(colors.warning, 0.12),
                  borderColor: colors.warning
                }
              ]}
            >
              <Ionicons name="time-outline" size={16} color={colors.warning} />
              <Text style={[styles.inactivityText, { color: colors.textSecondary }]}>
                Ejercicio sin actividad reciente: último registro el{' '}
                <Text style={{ color: colors.text, fontWeight: '800' }}>
                  {metrics.latestPoint.displayDate}
                </Text>{' '}
                (hace {metrics.daysSinceLast} días).
              </Text>
            </View>
          )}

          {/* 3 Indicadores clave limpios y reales */}
          <View style={styles.kpiRow}>
            <View style={[styles.kpiBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>ÚLTIMO PESO</Text>
              <Text style={[styles.kpiValue, { color: colors.text }]}>
                {metrics.latestPoint.maxWeight} kg
              </Text>
              <Text style={[styles.kpiSub, { color: colors.textSecondary }]}>
                {metrics.latestPoint.bestRepsAtMax} reps
              </Text>
            </View>

            <View
              style={[
                styles.kpiBox,
                {
                  backgroundColor: withAlpha(colors.primary, 0.1),
                  borderColor: colors.primary
                }
              ]}
            >
              <Text style={[styles.kpiLabel, { color: colors.primary }]}>MEJOR MARCA</Text>
              <Text style={[styles.kpiValue, { color: colors.primary }]}>
                {metrics.bestPoint.maxWeight} kg
              </Text>
              <Text style={[styles.kpiSub, { color: colors.textSecondary }]}>
                {metrics.bestPoint.displayDate}
              </Text>
            </View>

            <View style={[styles.kpiBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>ÚLTIMO ENTRENO</Text>
              <Text style={[styles.kpiValueDate, { color: colors.text }]}>
                {metrics.latestPoint.displayDate}
              </Text>
              {metrics.diffFromPrev !== null ? (
                <Text
                  style={[
                    styles.kpiSub,
                    {
                      color:
                        metrics.diffFromPrev > 0
                          ? colors.success
                          : metrics.diffFromPrev < 0
                            ? colors.warning
                            : colors.textMuted,
                      fontWeight: '800'
                    }
                  ]}
                >
                  {metrics.diffFromPrev > 0
                    ? `+${metrics.diffFromPrev} kg vs. ant.`
                    : metrics.diffFromPrev < 0
                      ? `${metrics.diffFromPrev} kg vs. ant.`
                      : 'Igual al anterior'}
                </Text>
              ) : (
                <Text style={[styles.kpiSub, { color: colors.textMuted }]}>1ª sesión</Text>
              )}
            </View>
          </View>

          {/* Gráfico o aviso de registros insuficientes en el período */}
          {chartPoints.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Sin registros en este período
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                No hay entrenamientos de {selectedExercise?.name} en el período seleccionado. Probá cambiando a &quot;HISTÓRICO&quot;.
              </Text>
            </View>
          ) : chartPoints.length === 1 ? (
            <View style={[styles.singleRecordBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="analytics-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.singleRecordTitle, { color: colors.text }]}>
                  1 entrenamiento registrado ({chartPoints[0].displayDate})
                </Text>
                <Text style={[styles.singleRecordDesc, { color: colors.textSecondary }]}>
                  Marca inicial: {chartPoints[0].maxWeight} kg × {chartPoints[0].bestRepsAtMax} reps. Cuando registres una segunda sesión en este ejercicio se mostrará la curva comparativa de evolución.
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.chartContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.chartHeaderRow}>
                <Text style={[styles.chartTitle, { color: colors.textSecondary }]}>
                  EVOLUCIÓN DE PESO MÁXIMO (KG)
                </Text>
                {metrics.diffInPeriod !== null && (
                  <View
                    style={[
                      styles.deltaBadge,
                      {
                        backgroundColor:
                          metrics.diffInPeriod >= 0
                            ? withAlpha(colors.primary, 0.14)
                            : withAlpha(colors.warning, 0.14),
                        borderColor: metrics.diffInPeriod >= 0 ? colors.primary : colors.warning
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.deltaBadgeText,
                        { color: metrics.diffInPeriod >= 0 ? colors.primary : colors.warning }
                      ]}
                    >
                      {metrics.diffInPeriod > 0
                        ? `+${metrics.diffInPeriod} kg en el período`
                        : metrics.diffInPeriod < 0
                          ? `${metrics.diffInPeriod} kg en el período`
                          : 'Peso estable'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Barras proporcionales interactivas */}
              <View style={styles.barsArea}>
                {chartPoints.map((pt, idx) => {
                  const ratio = maxChartWeight > 0 ? pt.maxWeight / maxChartWeight : 0;
                  const barHeight = Math.max(18, Math.round(ratio * 105));
                  const isBest = pt.maxWeight === metrics.bestPoint.maxWeight && pt.maxWeight > 0;
                  const isFocused =
                    selectedPointIndex === idx ||
                    (selectedPointIndex === null && idx === chartPoints.length - 1);

                  return (
                    <TouchableOpacity
                      key={pt.isoDate}
                      onPress={() => setSelectedPointIndex(idx)}
                      activeOpacity={0.75}
                      style={styles.barColumn}
                      accessibilityRole="button"
                      accessibilityLabel={`${pt.displayDate}: ${pt.maxWeight} kilos`}
                    >
                      <Text
                        style={[
                          styles.barWeightLabel,
                          {
                            color: isFocused
                              ? colors.primary
                              : isBest
                                ? colors.text
                                : colors.textSecondary,
                            fontWeight: isFocused || isBest ? '900' : '700'
                          }
                        ]}
                        numberOfLines={1}
                      >
                        {pt.maxWeight}
                      </Text>

                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: barHeight,
                              backgroundColor: isFocused
                                ? colors.primary
                                : isBest
                                  ? withAlpha(colors.primary, 0.7)
                                  : withAlpha(colors.primary, 0.38),
                              borderColor: isFocused || isBest ? colors.primary : 'transparent',
                              borderWidth: isFocused ? 1.5 : 0
                            }
                          ]}
                        />
                      </View>

                      <Text
                        style={[
                          styles.barDateLabel,
                          {
                            color: isFocused ? colors.text : colors.textMuted,
                            fontWeight: isFocused ? '800' : '600'
                          }
                        ]}
                        numberOfLines={1}
                      >
                        {pt.shortDate}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Detalle del punto seleccionado al pie del gráfico */}
              {activePoint && (
                <View style={[styles.pointDetailBar, { borderTopColor: colors.border }]}>
                  <Text style={[styles.pointDetailText, { color: colors.textSecondary }]}>
                    Sesión del{' '}
                    <Text style={{ color: colors.text, fontWeight: '800' }}>
                      {activePoint.displayDate}
                    </Text>
                    : mejor serie{' '}
                    <Text style={{ color: colors.primary, fontWeight: '900' }}>
                      {activePoint.maxWeight} kg × {activePoint.bestRepsAtMax} reps
                    </Text>{' '}
                    ({activePoint.setsCount} {activePoint.setsCount === 1 ? 'serie' : 'series'})
                  </Text>
                </View>
              )}
            </View>
          )}
        </>
      )}
    </Card>
  );
}

export default ExerciseProgressSection;

