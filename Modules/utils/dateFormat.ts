// utilidades de fecha para la capa de presentacion (formato argentino DD-MM-AAAA)
// el backend sigue recibiendo y devolviendo fechas ISO (AAAA-MM-DD / ISO 8601): la conversion ocurre solo en el frontend

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export const MONTH_NAMES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
];

// lunes como primer dia de la semana (convencion argentina)
export const WEEKDAY_LABELS_ES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

// Date -> 'AAAA-MM-DD' usando la fecha local del dispositivo (evita desfases por zona horaria)
export function dateToIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// 'AAAA-MM-DD' -> Date local a las 00:00 (null si el valor no es una fecha valida)
export function isoToDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const match = ISO_DATE_REGEX.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function todayIso(): string {
  return dateToIso(new Date());
}

// 'AAAA-MM-DD' -> 'DD-MM-AAAA' (cadena vacia si no es valida)
export function isoToDisplay(iso: string | null | undefined): string {
  const date = isoToDate(iso);
  if (!date) return '';
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

// marca de tiempo del backend (ISO 8601 o Date) -> 'DD-MM-AAAA HH:mm' en hora local del dispositivo
export function formatDateTimeAR(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// descripcion legible del periodo seleccionado
export function describePeriod(startIso: string, endIso: string): string {
  const start = isoToDisplay(startIso);
  const end = isoToDisplay(endIso);
  if (start && end) return start === end ? `Día ${start}` : `Del ${start} al ${end}`;
  if (start) return `Desde el ${start}`;
  if (end) return `Hasta el ${end}`;
  return 'Todas las fechas';
}

// cantidad de dias de un mes (month: 0-11)
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// posicion (0-6) del primer dia del mes con semana que empieza en lunes
export function firstWeekdayOffset(year: number, month: number): number {
  const jsDay = new Date(year, month, 1).getDay(); // 0 = domingo
  return (jsDay + 6) % 7;
}

