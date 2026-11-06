import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexto/themeContext';
import { withAlpha } from '../../Styles/theme/colors';
import {
  MONTH_NAMES_ES,
  WEEKDAY_LABELS_ES,
  dateToIso,
  isoToDate,
  todayIso,
  isoToDisplay,
  describePeriod,
  daysInMonth,
  firstWeekdayOffset
} from '../utils/dateFormat';
import Button from './Button';
import StatusBanner from './StatusBanner';

export type CalendarTarget = 'start' | 'end';

export interface DateRangeCalendarModalProps {
  visible: boolean;
  initialStartDate?: string;
  initialEndDate?: string;
  initialTarget?: CalendarTarget;
  onConfirm: (range: { startDate: string; endDate: string }) => void;
  onClear?: () => void;
  onClose: () => void;
}

// calendario visual compatible con Expo SDK 58 (sin dependencias externas)
// muestra fechas en formato argentino DD-MM-AAAA y emite valores ISO AAAA-MM-DD para el backend
export function DateRangeCalendarModal({
  visible,
  initialStartDate = '',
  initialEndDate = '',
  initialTarget = 'start',
  onConfirm,
  onClear,
  onClose
}: DateRangeCalendarModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [activeTarget, setActiveTarget] = useState<CalendarTarget>(initialTarget);
  const [draftStart, setDraftStart] = useState<string>(initialStartDate);
  const [draftEnd, setDraftEnd] = useState<string>(initialEndDate);
  const [validationError, setValidationError] = useState<string | null>(null);

  const today = useMemo(() => todayIso(), []);

  const initialFocusDate = useMemo(() => {
    const candidate =
      (initialTarget === 'end' ? isoToDate(initialEndDate) : isoToDate(initialStartDate)) ||
      isoToDate(initialStartDate) ||
      isoToDate(initialEndDate) ||
      new Date();
    return candidate;
  }, [initialStartDate, initialEndDate, initialTarget]);

  const [viewYear, setViewYear] = useState<number>(initialFocusDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialFocusDate.getMonth());

  useEffect(() => {
    if (visible) {
      setDraftStart(initialStartDate || '');
      setDraftEnd(initialEndDate || '');
      setActiveTarget(initialTarget);
      setValidationError(null);
      const base =
        (initialTarget === 'end' ? isoToDate(initialEndDate) : isoToDate(initialStartDate)) ||
        isoToDate(initialStartDate) ||
        isoToDate(initialEndDate) ||
        new Date();
      setViewYear(base.getFullYear());
      setViewMonth(base.getMonth());
    }
  }, [visible, initialStartDate, initialEndDate, initialTarget]);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const cells = useMemo(() => {
    const offset = firstWeekdayOffset(viewYear, viewMonth);
    const totalDays = daysInMonth(viewYear, viewMonth);
    const list: Array<{ key: string; day: number | null; iso: string | null }> = [];

    for (let i = 0; i < offset; i += 1) {
      list.push({ key: `empty-start-${i}`, day: null, iso: null });
    }
    for (let day = 1; day <= totalDays; day += 1) {
      const iso = dateToIso(new Date(viewYear, viewMonth, day));
      list.push({ key: iso, day, iso });
    }
    while (list.length % 7 !== 0) {
      list.push({ key: `empty-end-${list.length}`, day: null, iso: null });
    }
    return list;
  }, [viewYear, viewMonth]);

  const handleSelectDay = (iso: string) => {
    setValidationError(null);

    if (activeTarget === 'start') {
      if (draftEnd && iso > draftEnd) {
        // si la nueva fecha inicial supera a la fecha final, ajustamos la final e invitamos a elegirla
        setDraftStart(iso);
        setDraftEnd(iso);
      } else {
        setDraftStart(iso);
      }
      setActiveTarget('end');
    } else {
      if (draftStart && iso < draftStart) {
        setValidationError(
          `la fecha final (${isoToDisplay(iso)}) no puede ser anterior a la fecha inicial (${isoToDisplay(draftStart)})`
        );
        return;
      }
      setDraftEnd(iso);
    }
  };

  const applyPreset = (preset: 'today' | 'last7' | 'month') => {
    setValidationError(null);
    const now = new Date();
    const endIso = dateToIso(now);

    if (preset === 'today') {
      setDraftStart(endIso);
      setDraftEnd(endIso);
    } else if (preset === 'last7') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      setDraftStart(dateToIso(start));
      setDraftEnd(endIso);
    } else if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setDraftStart(dateToIso(start));
      setDraftEnd(endIso);
    }
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  const handleClear = () => {
    setValidationError(null);
    setDraftStart('');
    setDraftEnd('');
    if (onClear) {
      onClear();
    }
  };

  const handleConfirm = () => {
    if (draftStart && draftEnd && draftEnd < draftStart) {
      setValidationError('la fecha final no puede ser anterior a la fecha inicial');
      return;
    }
    onConfirm({ startDate: draftStart, endDate: draftEnd });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              marginBottom: Math.max(insets.bottom, 12)
            }
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Cabecera del calendario */}
            <View style={styles.headerRow}>
              <View style={styles.headerTitleWrap}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                <Text style={[styles.title, { color: colors.text }]}>SELECCIONAR PERÍODO</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeIconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel="cerrar calendario"
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Selectores de campo activo: DESDE y HASTA en formato DD-MM-AAAA */}
            <View style={styles.rangeTabsRow}>
              <TouchableOpacity
                onPress={() => {
                  setValidationError(null);
                  setActiveTarget('start');
                }}
                activeOpacity={0.85}
                style={[
                  styles.rangeTab,
                  {
                    backgroundColor:
                      activeTarget === 'start' ? withAlpha(colors.primary, 0.12) : colors.surface,
                    borderColor: activeTarget === 'start' ? colors.primary : colors.border
                  }
                ]}
              >
                <View style={styles.rangeTabTop}>
                  <Text
                    style={[
                      styles.rangeTabLabel,
                      { color: activeTarget === 'start' ? colors.primary : colors.textMuted }
                    ]}
                  >
                    FECHA INICIAL (DESDE)
                  </Text>
                  {draftStart ? (
                    <TouchableOpacity
                      onPress={() => setDraftStart('')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="borrar fecha inicial"
                    >
                      <Ionicons name="close-circle" size={15} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text style={[styles.rangeTabValue, { color: colors.text }]}>
                  {draftStart ? isoToDisplay(draftStart) : 'DD-MM-AAAA'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setValidationError(null);
                  setActiveTarget('end');
                }}
                activeOpacity={0.85}
                style={[
                  styles.rangeTab,
                  {
                    backgroundColor:
                      activeTarget === 'end' ? withAlpha(colors.primary, 0.12) : colors.surface,
                    borderColor: activeTarget === 'end' ? colors.primary : colors.border
                  }
                ]}
              >
                <View style={styles.rangeTabTop}>
                  <Text
                    style={[
                      styles.rangeTabLabel,
                      { color: activeTarget === 'end' ? colors.primary : colors.textMuted }
                    ]}
                  >
                    FECHA FINAL (HASTA)
                  </Text>
                  {draftEnd ? (
                    <TouchableOpacity
                      onPress={() => setDraftEnd('')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="borrar fecha final"
                    >
                      <Ionicons name="close-circle" size={15} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text style={[styles.rangeTabValue, { color: colors.text }]}>
                  {draftEnd ? isoToDisplay(draftEnd) : 'DD-MM-AAAA'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Atajos rapidos */}
            <View style={styles.presetsRow}>
              <TouchableOpacity
                onPress={() => applyPreset('today')}
                style={[styles.presetChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.presetChipText, { color: colors.textSecondary }]}>HOY</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => applyPreset('last7')}
                style={[styles.presetChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.presetChipText, { color: colors.textSecondary }]}>ÚLTIMOS 7 DÍAS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => applyPreset('month')}
                style={[styles.presetChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.presetChipText, { color: colors.textSecondary }]}>ESTE MES</Text>
              </TouchableOpacity>
            </View>

            {/* Navegacion de mes y año */}
            <View style={[styles.monthNav, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity
                onPress={goPrevMonth}
                style={styles.monthArrowBtn}
                accessibilityRole="button"
                accessibilityLabel="mes anterior"
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </TouchableOpacity>

              <Text style={[styles.monthTitle, { color: colors.text }]}>
                {MONTH_NAMES_ES[viewMonth].toUpperCase()} {viewYear}
              </Text>

              <TouchableOpacity
                onPress={goNextMonth}
                style={styles.monthArrowBtn}
                accessibilityRole="button"
                accessibilityLabel="mes siguiente"
              >
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Cabecera de dias de la semana (L a D) */}
            <View style={styles.weekdaysRow}>
              {WEEKDAY_LABELS_ES.map((label, idx) => (
                <View key={`wd-${idx}`} style={styles.weekdayCell}>
                  <Text style={[styles.weekdayText, { color: colors.textMuted }]}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Grilla del mes */}
            <View style={styles.daysGrid}>
              {cells.map((cell) => {
                if (!cell.iso || cell.day === null) {
                  return <View key={cell.key} style={styles.dayCell} />;
                }

                const iso = cell.iso;
                const isStart = Boolean(draftStart && iso === draftStart);
                const isEnd = Boolean(draftEnd && iso === draftEnd);
                const isSelectedEndpoint = isStart || isEnd;
                const isInRange = Boolean(
                  draftStart && draftEnd && iso > draftStart && iso < draftEnd
                );
                const isDisabledForEnd = Boolean(
                  activeTarget === 'end' && draftStart && iso < draftStart
                );
                const isToday = iso === today;

                return (
                  <TouchableOpacity
                    key={cell.key}
                    onPress={() => handleSelectDay(iso)}
                    disabled={isDisabledForEnd}
                    activeOpacity={0.75}
                    style={[
                      styles.dayCell,
                      isInRange && { backgroundColor: withAlpha(colors.primary, 0.14) },
                      isSelectedEndpoint && {
                        backgroundColor: colors.primary,
                        borderRadius: 10
                      },
                      !isSelectedEndpoint &&
                        isToday && {
                          borderWidth: 1,
                          borderColor: colors.primary,
                          borderRadius: 10
                        }
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${isoToDisplay(iso)}`}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        {
                          color: isSelectedEndpoint
                            ? colors.primaryText
                            : isDisabledForEnd
                              ? colors.textMuted
                              : isInRange
                                ? colors.primary
                                : colors.text,
                          opacity: isDisabledForEnd ? 0.35 : 1,
                          fontWeight: isSelectedEndpoint || isToday ? '900' : '600'
                        }
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Resumen del período seleccionado */}
            <View style={[styles.periodBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={[styles.periodBannerText, { color: colors.textSecondary }]}>
                Período:{' '}
                <Text style={{ color: colors.text, fontWeight: '800' }}>
                  {describePeriod(draftStart, draftEnd)}
                </Text>
              </Text>
            </View>

            {validationError ? <StatusBanner message={validationError} type="error" /> : null}

            {/* Acciones del modal */}
            <View style={styles.actionsRow}>
              <Button
                title="LIMPIAR"
                variant="secondary"
                onPress={handleClear}
                disabled={!draftStart && !draftEnd}
                style={styles.actionBtn}
              />
              <Button
                title="APLICAR FECHAS"
                variant="primary"
                onPress={handleConfirm}
                style={styles.actionBtn}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '92%',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  scrollContent: {
    paddingBottom: 4
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rangeTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10
  },
  rangeTab: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  rangeTabTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  rangeTabLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  rangeTabValue: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: 0.4
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10
  },
  presetChip: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center'
  },
  presetChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 8
  },
  monthArrowBtn: {
    padding: 4
  },
  monthTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 4
  },
  weekdayCell: {
    width: '14.2857%',
    alignItems: 'center',
    paddingVertical: 4
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '800'
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10
  },
  dayCell: {
    width: '14.2857%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1
  },
  dayText: {
    fontSize: 13
  },
  periodBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8
  },
  periodBannerText: {
    fontSize: 12,
    flex: 1
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  actionBtn: {
    flex: 1
  }
});

export default DateRangeCalendarModal;

