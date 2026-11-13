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
import { formatDateAR, formatDateTimeAR, toLocalIsoDate, cleanDisplayText } from '../utils/dateFormat';
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

export interface SessionSetDetail {
  id?: number | string;
  setNumber: number;
  weight: number;
  reps: number;
  rpe?: number | null;
}

export interface SessionExercisePoint {
  sessionId: number;
  sessionTimestamp: string;
  timestampMs: number;
  isoDate: string;
  displayDate: string;
  displayTime: string;
  displayDateTime: string;
  shortDate: string;
  sameDayCount: number;
  sameDayIndex: number;
  differentiatorLabel: string | null;
  maxWeight: number;
  bestRepsAtMax: number;
  bestPerformanceWeight: number;
  bestPerformanceReps: number;
  bestPerformanceVolume: number;
  totalVolume: number;
  setsCount: number;
  sets: SessionSetDetail[];
}

interface ExercisePersonalRecordSummary {
  id: number;
  name: string;
  muscleGroup?: string | null;
  sessionsCount: number;
  maxWeight: number;
  repsAtMax: number;
  bestWeightDate: string;
  bestWeightIso: string;
  bestPerfWeight: number;
  bestPerfReps: number;
  bestPerfVolume: number;
  bestPerfDate: string;
  bestPerfIso: string;
}

const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string }> = [
  { key: '30d', label: '30 DÍAS' },
  { key: '90d', label: '3 MESES' },
  { key: 'all', label: 'HISTÓRICO' }
];

// Agrupa los registros históricos por sesión única (session_id), nunca por fecha calendario.
export function buildSessionExercisePoints(
  rawLogs: any[],
  selectedExerciseId: number | null
): SessionExercisePoint[] {
  const bySession = new Map<number, SessionExercisePoint>();

  rawLogs.forEach((log) => {
    if (!log || typeof log !== 'object') return;

    // Garantizar que nunca se mezclen series de otro ejercicio
    if (log.exercise_id !== undefined && selectedExerciseId !== null) {
      if (Number(log.exercise_id) !== Number(selectedExerciseId)) return;
    }

    // Gestión explícita del identificador de sesión: NO usar la fecha como alternativa silenciosa
    const parsedSessionId = Number(log.session_id);
    if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0) {
      return;
    }

    const rawTimestamp = String(log.session_date || log.created_at || '');
    const isoDate = toLocalIsoDate(rawTimestamp);
    if (!isoDate) return;

    const parsedMs = new Date(rawTimestamp).getTime();
    const timestampMs = Number.isFinite(parsedMs) ? parsedMs : new Date(`${isoDate}T12:00:00`).getTime();

    const displayDate = formatDateAR(isoDate);
    const fullDateTime = formatDateTimeAR(rawTimestamp);
    const displayTime = fullDateTime.length >= 16 ? fullDateTime.slice(11, 16) : '';
    const displayDateTime = displayTime ? `${displayDate} ${displayTime}` : displayDate;
    const shortDate = displayDate.slice(0, 5); // DD/MM

    const weight = Number(log.weight_kg) || 0;
    const reps = Number(log.reps_completed) || 0;
    const setVolume = Number((weight * reps).toFixed(1));

    const current = bySession.get(parsedSessionId);
    const setItem: SessionSetDetail = {
      id: log.id,
      setNumber: Number(log.set_number) || (current ? current.sets.length + 1 : 1),
      weight,
      reps,
      rpe: log.rpe !== undefined && log.rpe !== null ? Number(log.rpe) : null
    };

    if (!current) {
      bySession.set(parsedSessionId, {
        sessionId: parsedSessionId,
        sessionTimestamp: rawTimestamp,
        timestampMs,
        isoDate,
        displayDate,
        displayTime,
        displayDateTime,
        shortDate,
        sameDayCount: 1,
        sameDayIndex: 1,
        differentiatorLabel: null,
        maxWeight: weight,
        bestRepsAtMax: reps,
        bestPerformanceWeight: weight,
        bestPerformanceReps: reps,
        bestPerformanceVolume: setVolume,
        totalVolume: setVolume,
        setsCount: 1,
        sets: [setItem]
      });
    } else {
      current.setsCount += 1;
      current.totalVolume = Number((current.totalVolume + setVolume).toFixed(1));
      current.sets.push(setItem);

      if (weight > current.maxWeight || (weight === current.maxWeight && reps > current.bestRepsAtMax)) {
        current.maxWeight = weight;
        current.bestRepsAtMax = reps;
      }

      if (
        setVolume > current.bestPerformanceVolume ||
        (setVolume === current.bestPerformanceVolume && weight > current.bestPerformanceWeight)
      ) {
        current.bestPerformanceWeight = weight;
        current.bestPerformanceReps = reps;
        current.bestPerformanceVolume = setVolume;
      }
    }
  });

  const points = Array.from(bySession.values());

  // Ordenar las series internas de cada sesión por número de serie ascendente
  points.forEach((pt) => {
    pt.sets.sort((a, b) => a.setNumber - b.setNumber);
  });

  // Orden cronológico de más antiguo a más reciente usando fecha/hora y sessionId como desempate
  points.sort((a, b) => {
    if (a.timestampMs !== b.timestampMs) {
      return a.timestampMs - b.timestampMs;
    }
    return a.sessionId - b.sessionId;
  });

  // Identificar y numerar sesiones ocurridas en el mismo día calendario para diferenciarlas visualmente
  const countsByIsoDate = new Map<string, number>();
  points.forEach((pt) => {
    countsByIsoDate.set(pt.isoDate, (countsByIsoDate.get(pt.isoDate) || 0) + 1);
  });

  const runningIndexByIsoDate = new Map<string, number>();
  points.forEach((pt) => {
    const totalSameDay = countsByIsoDate.get(pt.isoDate) || 1;
    const nextIdx = (runningIndexByIsoDate.get(pt.isoDate) || 0) + 1;
    runningIndexByIsoDate.set(pt.isoDate, nextIdx);

    pt.sameDayCount = totalSameDay;
    pt.sameDayIndex = nextIdx;

    if (totalSameDay > 1) {
      pt.differentiatorLabel = pt.displayTime ? pt.displayTime : `#${nextIdx}`;
    } else {
      pt.differentiatorLabel = null;
    }
  });

  return points;
}

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
            name: cleanDisplayText(st.exercise_name) || `Ejercicio #${exId}`,
            muscleGroup: cleanDisplayText(st.muscle_group) || null
          });
        }
      });
    });
    return Array.from(map.values());
  }, [sessions]);

  // Calcular resumen de mejores marcas por ejercicio a partir de las sesiones reales del usuario (sin mezclar ejercicios ni sesiones)
  const personalRecordsByExercise = useMemo<ExercisePersonalRecordSummary[]>(() => {
    const map = new Map<number, ExercisePersonalRecordSummary>();
    const sessionTracker = new Map<number, Set<number>>();

    sessions.forEach((session) => {
      if (!Array.isArray(session?.sets)) return;
      const parsedSessionId = Number(session?.id);
      const sessionIso = toLocalIsoDate(session.session_date || session.created_at);
      if (!sessionIso) return;
      const sessionDisplay = formatDateAR(sessionIso);

      session.sets.forEach((st: any) => {
        const exId = Number(st?.exercise_id);
        if (!Number.isInteger(exId) || exId <= 0) return;
        const weight = Number(st?.weight_kg) || 0;
        const reps = Number(st?.reps_completed) || 0;
        if (reps <= 0 && weight <= 0) return;

        const volume = Number((weight * reps).toFixed(1));
        const name = cleanDisplayText(st.exercise_name) || `Ejercicio #${exId}`;
        const muscleGroup = cleanDisplayText(st.muscle_group) || null;

        const effectiveSessionId = Number.isInteger(parsedSessionId) && parsedSessionId > 0
          ? parsedSessionId
          : Number(st?.session_id);

        if (Number.isInteger(effectiveSessionId) && effectiveSessionId > 0) {
          if (!sessionTracker.has(exId)) {
            sessionTracker.set(exId, new Set<number>());
          }
          sessionTracker.get(exId)!.add(effectiveSessionId);
        }

        const existing = map.get(exId);
        if (!existing) {
          map.set(exId, {
            id: exId,
            name,
            muscleGroup,
            sessionsCount: sessionTracker.get(exId)?.size || 1,
            maxWeight: weight,
            repsAtMax: reps,
            bestWeightDate: sessionDisplay,
            bestWeightIso: sessionIso,
            bestPerfWeight: weight,
            bestPerfReps: reps,
            bestPerfVolume: volume,
            bestPerfDate: sessionDisplay,
            bestPerfIso: sessionIso
          });
        } else {
          existing.sessionsCount = sessionTracker.get(exId)?.size || existing.sessionsCount;

          // Criterio 1: Mayor peso levantado (a igualdad de peso, mayor cantidad de repeticiones)
          if (
            weight > existing.maxWeight ||
            (weight === existing.maxWeight && reps > existing.repsAtMax)
          ) {
            existing.maxWeight = weight;
            existing.repsAtMax = reps;
            existing.bestWeightDate = sessionDisplay;
            existing.bestWeightIso = sessionIso;
          }

          // Criterio 2: Mejor rendimiento combinado peso × repeticiones (a igualdad de volumen, mayor peso)
          if (
            volume > existing.bestPerfVolume ||
            (volume === existing.bestPerfVolume && weight > existing.bestPerfWeight)
          ) {
            existing.bestPerfWeight = weight;
            existing.bestPerfReps = reps;
            existing.bestPerfVolume = volume;
            existing.bestPerfDate = sessionDisplay;
            existing.bestPerfIso = sessionIso;
          }
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

  // Agrupar registros por sesión única de entrenamiento (session_id), manteniendo independiente cada entrenamiento
  const allPoints = useMemo<SessionExercisePoint[]>(() => {
    return buildSessionExercisePoints(rawLogs, selectedExerciseId);
  }, [rawLogs, selectedExerciseId]);

  // Filtrar puntos según el período seleccionado
  const filteredPoints = useMemo<SessionExercisePoint[]>(() => {
    if (period === 'all') return allPoints;
    const daysLimit = period === '30d' ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysLimit);
    const cutoffIso = toLocalIsoDate(cutoff);
    return allPoints.filter((pt) => pt.isoDate >= cutoffIso);
  }, [allPoints, period]);

  // Mostrar hasta las últimas 10 sesiones en el gráfico de barras para máxima claridad visual
  const chartPoints = useMemo<SessionExercisePoint[]>(() => {
    return filteredPoints.slice(-10);
  }, [filteredPoints]);

  // Estadísticas clave reales (sobre el histórico completo y sobre el período)
  const metrics = useMemo(() => {
    if (allPoints.length === 0) return null;

    const latestPoint = allPoints[allPoints.length - 1];
    const previousPoint = allPoints.length >= 2 ? allPoints[allPoints.length - 2] : null;
    const firstInPeriod = filteredPoints.length >= 2 ? filteredPoints[0] : null;
    const lastInPeriod = filteredPoints.length >= 1 ? filteredPoints[filteredPoints.length - 1] : latestPoint;

    // Criterio 1: Mayor peso levantado (a igualdad de peso, mayor cantidad de repeticiones)
    let bestPoint = allPoints[0];
    allPoints.forEach((pt) => {
      if (
        pt.maxWeight > bestPoint.maxWeight ||
        (pt.maxWeight === bestPoint.maxWeight && pt.bestRepsAtMax > bestPoint.bestRepsAtMax)
      ) {
        bestPoint = pt;
      }
    });

    // Criterio 2: Mejor rendimiento combinado peso × repeticiones
    let bestPerformancePoint = allPoints[0];
    allPoints.forEach((pt) => {
      if (
        pt.bestPerformanceVolume > bestPerformancePoint.bestPerformanceVolume ||
        (pt.bestPerformanceVolume === bestPerformancePoint.bestPerformanceVolume &&
          pt.bestPerformanceWeight > bestPerformancePoint.bestPerformanceWeight)
      ) {
        bestPerformancePoint = pt;
      }
    });

    const diffFromPrev = previousPoint
      ? Number((latestPoint.maxWeight - previousPoint.maxWeight).toFixed(1))
      : null;

    // Comparar entre la primera y la última sesión del período usando sessionId (permite comparar sesiones del mismo día)
    const diffInPeriod =
      firstInPeriod && lastInPeriod && firstInPeriod.sessionId !== lastInPeriod.sessionId
        ? Number((lastInPeriod.maxWeight - firstInPeriod.maxWeight).toFixed(1))
        : null;

    // Comprobar si lleva más de 30 días sin actividad en este ejercicio
    const lastDateObj = new Date(`${latestPoint.isoDate}T12:00:00`);
    const daysSinceLast = Math.floor((Date.now() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));
    const isInactiveRecently = daysSinceLast > 30;

    return {
      totalSessionsCount: allPoints.length,
      latestPoint,
      previousPoint,
      bestPoint,
      bestPerformancePoint,
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
                {metrics.bestPoint.bestRepsAtMax} reps · {metrics.bestPoint.shortDate}
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

          {/* Tarjeta dedicada de MEJORES MARCAS del ejercicio seleccionado (peso máximo + repeticiones + mejor rendimiento peso × reps) */}
          <View
            style={[
              styles.bestMarksCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border
              }
            ]}
          >
            <View style={styles.bestMarksHeader}>
              <View style={styles.bestMarksHeaderLeft}>
                <Ionicons name="trophy-outline" size={16} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bestMarksTitle, { color: colors.primary }]}>
                    MEJORES MARCAS REGISTRADAS ({metrics.totalSessionsCount}{' '}
                    {metrics.totalSessionsCount === 1 ? 'entrenamiento' : 'entrenamientos'})
                  </Text>
                  <Text style={[styles.bestMarksExerciseName, { color: colors.text }]}>
                    {selectedExercise?.name || 'Ejercicio seleccionado'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.bestMarksGrid}>
              {/* 1. Mayor peso levantado */}
              <View
                style={[
                  styles.bestMarkItem,
                  {
                    backgroundColor: withAlpha(colors.primary, 0.08),
                    borderColor: colors.primary
                  }
                ]}
              >
                <Text style={[styles.bestMarkBadge, { color: colors.primary }]}>
                  MAYOR PESO LEVANTADO
                </Text>
                <Text style={[styles.bestMarkMainValue, { color: colors.text }]}>
                  Mejor marca: {metrics.bestPoint.maxWeight} kg
                </Text>
                <Text style={[styles.bestMarkMetaText, { color: colors.textSecondary }]}>
                  Repeticiones:{' '}
                  <Text style={{ color: colors.text, fontWeight: '800' }}>
                    {metrics.bestPoint.bestRepsAtMax}
                  </Text>
                </Text>
                <Text style={[styles.bestMarkMetaText, { color: colors.textSecondary }]}>
                  Fecha:{' '}
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {metrics.bestPoint.displayDate}
                  </Text>
                </Text>
              </View>

              {/* 2. Mejor rendimiento combinado (peso × repeticiones) */}
              <View
                style={[
                  styles.bestMarkItem,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border
                  }
                ]}
              >
                <Text style={[styles.bestMarkBadge, { color: colors.textSecondary }]}>
                  MEJOR RENDIMIENTO (PESO × REPS)
                </Text>
                <Text style={[styles.bestMarkMainValue, { color: colors.text }]}>
                  {metrics.bestPerformancePoint.bestPerformanceWeight} kg ×{' '}
                  {metrics.bestPerformancePoint.bestPerformanceReps} reps
                </Text>
                <Text style={[styles.bestMarkMetaText, { color: colors.textSecondary }]}>
                  Volumen de serie:{' '}
                  <Text style={{ color: colors.primary, fontWeight: '800' }}>
                    {metrics.bestPerformancePoint.bestPerformanceVolume} kg
                  </Text>
                </Text>
                <Text style={[styles.bestMarkMetaText, { color: colors.textSecondary }]}>
                  Fecha:{' '}
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {metrics.bestPerformancePoint.displayDate}
                  </Text>
                </Text>
              </View>
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
                  Marca inicial: {chartPoints[0].maxWeight} kg × {chartPoints[0].bestRepsAtMax} repeticiones ({chartPoints[0].setsCount}{' '}
                  {chartPoints[0].setsCount === 1 ? 'serie' : 'series'}). Cuando registres una segunda sesión en este ejercicio se mostrará la curva comparativa de evolución.
                </Text>
                {chartPoints[0].sets.length > 0 && (
                  <View style={[styles.pointSetsWrap, { justifyContent: 'flex-start', marginTop: 6 }]}>
                    {chartPoints[0].sets.map((st, sIdx) => (
                      <View
                        key={`single-set-${st.id || sIdx}`}
                        style={[
                          styles.pointSetChip,
                          { backgroundColor: colors.card, borderColor: colors.border }
                        ]}
                      >
                        <Text style={[styles.pointSetChipText, { color: colors.textSecondary }]}>
                          #{st.setNumber}:{' '}
                          <Text style={{ color: colors.primary, fontWeight: '900' }}>
                            {st.weight} kg
                          </Text>{' '}
                          × {st.reps} reps
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={[styles.chartContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.chartHeaderRow}>
                <Text style={[styles.chartTitle, { color: colors.textSecondary }]}>
                  EVOLUCIÓN DE PESO (KG) Y REPETICIONES ({chartPoints.length}{' '}
                  {chartPoints.length === 1 ? 'sesión' : 'sesiones'})
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

              {/* Barras proporcionales interactivas con peso (kg), repeticiones y diferenciación de sesiones del mismo día */}
              <View style={styles.barsArea}>
                {chartPoints.map((pt, idx) => {
                  const ratio = maxChartWeight > 0 ? pt.maxWeight / maxChartWeight : 0;
                  const barHeight = Math.max(18, Math.round(ratio * 96));
                  const isBest =
                    pt.maxWeight === metrics.bestPoint.maxWeight &&
                    pt.bestRepsAtMax === metrics.bestPoint.bestRepsAtMax &&
                    pt.maxWeight > 0;
                  const isFocused =
                    selectedPointIndex === idx ||
                    (selectedPointIndex === null && idx === chartPoints.length - 1);

                  return (
                    <TouchableOpacity
                      key={`session-pt-${pt.sessionId}`}
                      onPress={() => setSelectedPointIndex(idx)}
                      activeOpacity={0.75}
                      style={styles.barColumn}
                      accessibilityRole="button"
                      accessibilityLabel={`Sesión ${pt.sessionId} (${pt.displayDateTime}): ${pt.maxWeight} kilos por ${pt.bestRepsAtMax} repeticiones`}
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
                        {pt.maxWeight}kg
                      </Text>

                      <Text
                        style={[
                          styles.barRepsLabel,
                          {
                            color: isFocused ? colors.text : colors.textMuted,
                            fontWeight: isFocused || isBest ? '800' : '600'
                          }
                        ]}
                        numberOfLines={1}
                      >
                        ×{pt.bestRepsAtMax}r
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

                      {pt.differentiatorLabel && (
                        <Text
                          style={[
                            styles.barSubDateLabel,
                            {
                              color: isFocused ? colors.primary : colors.textMuted,
                              fontWeight: isFocused ? '800' : '600'
                            }
                          ]}
                          numberOfLines={1}
                        >
                          {pt.differentiatorLabel}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Detalle del punto seleccionado al pie del gráfico con todas sus series exclusivas de esa sesión */}
              {activePoint && (
                <View style={[styles.pointDetailBar, { borderTopColor: colors.border }]}>
                  <Text style={[styles.pointDetailText, { color: colors.textSecondary }]}>
                    Sesión #{activePoint.sessionId} del{' '}
                    <Text style={{ color: colors.text, fontWeight: '800' }}>
                      {activePoint.displayDate}
                      {activePoint.displayTime ? ` (${activePoint.displayTime} hs)` : ''}
                    </Text>
                    : mejor marca{' '}
                    <Text style={{ color: colors.primary, fontWeight: '900' }}>
                      {activePoint.maxWeight} kg × {activePoint.bestRepsAtMax} repeticiones
                    </Text>{' '}
                    ({activePoint.setsCount} {activePoint.setsCount === 1 ? 'serie' : 'series'} ·
                    Volumen total: {activePoint.totalVolume} kg)
                  </Text>

                  {activePoint.sets.length > 0 && (
                    <View style={styles.pointSetsWrap}>
                      {activePoint.sets.map((st, sIdx) => (
                        <View
                          key={`pt-set-${activePoint.sessionId}-${st.id || sIdx}`}
                          style={[
                            styles.pointSetChip,
                            { backgroundColor: colors.card, borderColor: colors.border }
                          ]}
                        >
                          <Text style={[styles.pointSetChipText, { color: colors.textSecondary }]}>
                            #{st.setNumber}:{' '}
                            <Text style={{ color: colors.primary, fontWeight: '900' }}>
                              {st.weight} kg
                            </Text>{' '}
                            × {st.reps} reps
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </>
      )}

      {/* Resumen general de mejores marcas por ejercicio (cuando hay registros históricos reales) */}
      {personalRecordsByExercise.length > 0 && (
        <View style={[styles.allRecordsSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.allRecordsTitle, { color: colors.textSecondary }]}>
            RESUMEN DE MEJORES MARCAS POR EJERCICIO ({personalRecordsByExercise.length})
          </Text>
          <View style={styles.allRecordsGrid}>
            {personalRecordsByExercise.map((rec) => {
              const isCurrent = rec.id === selectedExerciseId;
              const hasDifferentBestVolume =
                rec.bestPerfWeight !== rec.maxWeight || rec.bestPerfReps !== rec.repsAtMax;

              return (
                <TouchableOpacity
                  key={`pr-summary-${rec.id}`}
                  activeOpacity={0.8}
                  onPress={() => setSelectedExerciseId(rec.id)}
                  style={[
                    styles.recordSummaryCard,
                    {
                      backgroundColor: isCurrent
                        ? withAlpha(colors.primary, 0.08)
                        : colors.surface,
                      borderColor: isCurrent ? colors.primary : colors.border
                    }
                  ]}
                  accessibilityRole="button"
                >
                  <View style={styles.recordSummaryTop}>
                    <Text style={[styles.recordSummaryExName, { color: colors.text }]}>
                      {rec.name}
                    </Text>
                    {rec.muscleGroup ? (
                      <Text style={[styles.recordSummaryMuscle, { color: colors.textMuted }]}>
                        {rec.muscleGroup.toUpperCase()}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.recordSummaryDetailsRow}>
                    <Text style={[styles.recordSummaryText, { color: colors.textSecondary }]}>
                      Mejor marca:{' '}
                      <Text style={{ color: colors.primary, fontWeight: '900' }}>
                        {rec.maxWeight} kg
                      </Text>
                    </Text>
                    <Text style={[styles.recordSummaryText, { color: colors.textSecondary }]}>
                      Repeticiones:{' '}
                      <Text style={{ color: colors.text, fontWeight: '800' }}>
                        {rec.repsAtMax}
                      </Text>
                    </Text>
                    <Text style={[styles.recordSummaryText, { color: colors.textSecondary }]}>
                      Sesiones:{' '}
                      <Text style={{ color: colors.text, fontWeight: '800' }}>
                        {rec.sessionsCount}
                      </Text>
                    </Text>
                    <Text style={[styles.recordSummaryText, { color: colors.textSecondary }]}>
                      Fecha:{' '}
                      <Text style={{ color: colors.text, fontWeight: '700' }}>
                        {rec.bestWeightDate}
                      </Text>
                    </Text>
                  </View>

                  {hasDifferentBestVolume && (
                    <Text style={[styles.recordSummaryText, { color: colors.textSecondary }]}>
                      Mejor rendimiento peso × repeticiones:{' '}
                      <Text style={{ color: colors.primary, fontWeight: '800' }}>
                        {rec.bestPerfWeight} kg × {rec.bestPerfReps} reps
                      </Text>{' '}
                      ({rec.bestPerfDate})
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </Card>
  );
}

export default ExerciseProgressSection;

