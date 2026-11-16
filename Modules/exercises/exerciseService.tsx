// Centraliza las consultas, operaciones CRUD, agrupación por grupo muscular y reconciliación en tiempo real sobre el catálogo de ejercicios.
import apiClient from '../api/client';
import { cleanDisplayText } from '../utils/dateFormat';

export interface MuscleGroupSection {
  key: string;
  title: string;
  rawMuscleGroup: string;
  count: number;
  exercises: any[];
}

const UNGROUPED_KEY = '__sin_grupo__';
const UNGROUPED_TITLE = 'SIN GRUPO ASIGNADO';

// Orden lógico anatómico para los grupos musculares principales establecidos en FitManager
const MUSCLE_GROUP_PRIORITY: Record<string, number> = {
  pecho: 1,
  pectoral: 1,
  pectorales: 1,
  espalda: 2,
  dorsal: 2,
  dorsales: 2,
  hombro: 3,
  hombros: 3,
  deltoides: 3,
  pierna: 4,
  piernas: 4,
  cuadriceps: 4,
  isquiotibiales: 4,
  biceps: 5,
  triceps: 6,
  brazos: 7,
  antebrazo: 7,
  gluteo: 8,
  gluteos: 8,
  abdomen: 9,
  abdominales: 9,
  core: 9
};

// Normaliza texto para comparaciones y búsquedas insensibles a mayúsculas, tildes y espacios múltiples.
export function normalizeSearchText(val: string | null | undefined): string {
  return String(val || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Obtiene una clave canónica de agrupación para el grupo muscular, conservando distinciones específicas
// pero unificando diferencias de mayúsculas/minúsculas o tildes (ej. "Pecho" y "pecho" -> "pecho").
export function normalizeMuscleGroupKey(rawGroup: string | null | undefined): string {
  const cleaned = cleanDisplayText(rawGroup).trim();
  if (!cleaned) return UNGROUPED_KEY;
  return normalizeSearchText(cleaned);
}

// Formatea el título visible de la sección del grupo muscular en mayúsculas limpias.
export function formatMuscleGroupLabel(rawGroup: string | null | undefined): string {
  const cleaned = cleanDisplayText(rawGroup).replace(/\s+/g, ' ').trim();
  if (!cleaned) return UNGROUPED_TITLE;
  return cleaned.toUpperCase();
}

function getMuscleGroupSortOrder(groupKey: string): number {
  if (groupKey === UNGROUPED_KEY) return 999;
  if (MUSCLE_GROUP_PRIORITY[groupKey] !== undefined) {
    return MUSCLE_GROUP_PRIORITY[groupKey];
  }
  return 100;
}

// Agrupa los ejercicios por su grupo muscular asignado, aplicando opcionalmente filtro de búsqueda
// y ordenando tanto las secciones como los ejercicios dentro de cada sección de forma alfabética.
export function groupExercisesByMuscleGroup(
  rawList: any[],
  searchQuery: string = ''
): MuscleGroupSection[] {
  const deduplicated = dedupeAndSortExercises(rawList);
  const q = normalizeSearchText(searchQuery);

  const filtered = q
    ? deduplicated.filter(
        (ex) =>
          normalizeSearchText(ex.name).includes(q) ||
          normalizeSearchText(ex.description).includes(q) ||
          normalizeSearchText(ex.muscle_group).includes(q)
      )
    : deduplicated;

  const sectionsMap = new Map<string, MuscleGroupSection>();

  for (const ex of filtered) {
    const key = normalizeMuscleGroupKey(ex.muscle_group);
    let section = sectionsMap.get(key);
    if (!section) {
      const cleanedRaw = cleanDisplayText(ex.muscle_group).replace(/\s+/g, ' ').trim();
      section = {
        key,
        title: formatMuscleGroupLabel(ex.muscle_group),
        rawMuscleGroup: cleanedRaw,
        count: 0,
        exercises: []
      };
      sectionsMap.set(key, section);
    }
    section.exercises.push(ex);
    section.count = section.exercises.length;
  }

  // Ordenar los grupos de forma lógica y consistente, y los ejercicios alfabéticamente dentro de cada grupo
  const sections = Array.from(sectionsMap.values()).filter((s) => s.count > 0);

  for (const sec of sections) {
    sec.exercises.sort((a, b) => {
      const nameA = cleanDisplayText(a.name).trim();
      const nameB = cleanDisplayText(b.name).trim();
      const cmp = nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      return Number(a.id) - Number(b.id);
    });
  }

  sections.sort((a, b) => {
    const orderA = getMuscleGroupSortOrder(a.key);
    const orderB = getMuscleGroupSortOrder(b.key);
    if (orderA !== orderB) return orderA - orderB;
    return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
  });

  return sections;
}

// Compara si dos registros de ejercicio representan exactamente el mismo contenido visible.
export function isSameExerciseItem(a: any, b: any): boolean {
  if (!a || !b) return false;
  return (
    Number(a.id) === Number(b.id) &&
    String(a.name || '') === String(b.name || '') &&
    String(a.description || '') === String(b.description || '') &&
    String(a.muscle_group || '') === String(b.muscle_group || '') &&
    String(a.difficulty || 'beginner') === String(b.difficulty || 'beginner') &&
    Number(a.is_active ?? 1) === Number(b.is_active ?? 1)
  );
}

// Filtra ejercicios inactivos/inválidos, elimina duplicados por ID y ordena alfabéticamente con desempate por ID.
export function dedupeAndSortExercises(rawList: any[]): any[] {
  if (!Array.isArray(rawList)) return [];

  const byId = new Map<number, any>();
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const numericId = Number(item.id);
    if (!Number.isInteger(numericId) || numericId <= 0) continue;
    // Excluir ejercicios dados de baja lógica (is_active = 0 o false)
    if (item.is_active === 0 || item.is_active === false) continue;

    byId.set(numericId, {
      ...item,
      id: numericId
    });
  }

  return Array.from(byId.values()).sort((a, b) => {
    const nameA = String(a.name || '').trim();
    const nameB = String(b.name || '').trim();
    const cmp = nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    if (cmp !== 0) return cmp;
    return Number(a.id) - Number(b.id);
  });
}

// Comprueba si dos listas de ejercicios son equivalentes en orden y contenido.
export function areExerciseListsEqual(prevList: any[], nextList: any[]): boolean {
  if (prevList === nextList) return true;
  if (!Array.isArray(prevList) || !Array.isArray(nextList)) return false;
  if (prevList.length !== nextList.length) return false;

  for (let i = 0; i < prevList.length; i++) {
    if (!isSameExerciseItem(prevList[i], nextList[i])) {
      return false;
    }
  }
  return true;
}

// Reconcilia el estado previo con la nueva lista del backend preservando referencias de elementos sin cambios
// para evitar parpadeos, re-renderizados innecesarios o pérdida de posición de scroll en FlatList.
export function reconcileExercisesState(prevList: any[], incomingList: any[]): any[] {
  const safePrev = Array.isArray(prevList) ? prevList : [];
  const normalizedNext = dedupeAndSortExercises(incomingList);

  if (areExerciseListsEqual(safePrev, normalizedNext)) {
    return safePrev;
  }

  const prevById = new Map<number, any>();
  for (const item of safePrev) {
    const id = Number(item?.id);
    if (Number.isInteger(id) && id > 0) {
      prevById.set(id, item);
    }
  }

  return normalizedNext.map((nextItem) => {
    const existing = prevById.get(Number(nextItem.id));
    if (existing && isSameExerciseItem(existing, nextItem)) {
      return existing;
    }
    return nextItem;
  });
}

// servicio desacoplado para interactuar con los endpoints de ejercicios
export const exerciseService = {
  // obtener listado de ejercicios con soporte para filtros opcionales
  getExercises: async (filters: Record<string, any> = {}, token?: string | null) => {
    let query = '';
    const params = new URLSearchParams();

    if (filters.muscle_group) params.append('muscle_group', filters.muscle_group);
    if (filters.difficulty) params.append('difficulty', filters.difficulty);
    if (filters.search) params.append('search', filters.search);

    const queryString = params.toString();
    if (queryString) {
      query = `?${queryString}`;
    }

    return apiClient.get(`/exercises${query}`, { token });
  },

  // obtener un ejercicio por identificador
  getExerciseById: async (id: number | string, token?: string | null) => {
    return apiClient.get(`/exercises/${id}`, { token });
  },

  // crear ejercicio (admin y trainer)
  createExercise: async (data: any, token?: string | null) => {
    return apiClient.post('/exercises', data, { token });
  },

  // actualizar ejercicio (admin y trainer)
  updateExercise: async (id: number | string, data: any, token?: string | null) => {
    return apiClient.patch(`/exercises/${id}`, data, { token });
  },

  // eliminar ejercicio (admin y trainer; baja lógica si tiene historial/rutinas o física si no tiene uso)
  deleteExercise: async (id: number | string, token?: string | null) => {
    return apiClient.delete(`/exercises/${id}`, { token });
  },

  // utilidades expuestas para sincronización sin parpadeos y agrupación por grupo muscular
  isSameExerciseItem,
  dedupeAndSortExercises,
  areExerciseListsEqual,
  reconcileExercisesState,
  normalizeSearchText,
  normalizeMuscleGroupKey,
  formatMuscleGroupLabel,
  groupExercisesByMuscleGroup
};

export default exerciseService;
