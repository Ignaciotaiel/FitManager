import { File, Paths, EncodingType } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { ExportEntity } from './adminService';

export interface CsvColumn {
  key: string;
  header: string;
}

// encabezados de columnas especificos en espanol para cada informe
export const REPORT_COLUMNS: Record<ExportEntity, CsvColumn[]> = {
  users: [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Nombre' },
    { key: 'email', header: 'Correo electrónico' },
    { key: 'role', header: 'Rol' },
    { key: 'is_active', header: 'Activo' },
    { key: 'created_at', header: 'Fecha de registro' }
  ],
  trainers: [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Nombre' },
    { key: 'email', header: 'Correo electrónico' },
    { key: 'role', header: 'Rol' },
    { key: 'is_active', header: 'Activo' },
    { key: 'created_at', header: 'Fecha de registro' }
  ],
  members: [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Nombre' },
    { key: 'email', header: 'Correo electrónico' },
    { key: 'role', header: 'Rol' },
    { key: 'is_active', header: 'Activo' },
    { key: 'created_at', header: 'Fecha de registro' }
  ],
  exercises: [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Nombre' },
    { key: 'muscle_group', header: 'Grupo muscular' },
    { key: 'difficulty', header: 'Dificultad' },
    { key: 'description', header: 'Descripción' },
    { key: 'created_at', header: 'Fecha de creación' }
  ],
  routines: [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Nombre de rutina' },
    { key: 'description', header: 'Descripción' },
    { key: 'trainer_id', header: 'ID Entrenador' },
    { key: 'trainer_name', header: 'Entrenador responsable' },
    { key: 'created_at', header: 'Fecha de creación' }
  ],
  activity_logs: [
    { key: 'id', header: 'ID' },
    { key: 'user_id', header: 'ID Usuario' },
    { key: 'user_name', header: 'Usuario' },
    { key: 'user_role', header: 'Rol' },
    { key: 'action_type', header: 'Tipo de acción' },
    { key: 'category', header: 'Categoría' },
    { key: 'description', header: 'Descripción' },
    { key: 'created_at', header: 'Fecha y hora' }
  ],
  incidents: [
    { key: 'id', header: 'ID' },
    { key: 'title', header: 'Título' },
    { key: 'category', header: 'Categoría' },
    { key: 'status', header: 'Estado' },
    { key: 'reporter_name', header: 'Registrado por' },
    { key: 'resolution_notes', header: 'Notas de resolución' },
    { key: 'resolved_at', header: 'Fecha de resolución' },
    { key: 'created_at', header: 'Fecha de creación' }
  ]
};

// escapa un valor segun RFC 4180 protegiendo comas, comillas, saltos de linea y caracteres especiales
export function formatCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  let text: string;
  if (value instanceof Date) {
    text = value.toISOString();
  } else if (typeof value === 'object') {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  } else {
    text = String(value);
  }

  // normalizar saltos de linea internos
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // mitigacion de inyeccion de formulas en hojas de calculo
  if (/^[=+\-@\t]/.test(text)) {
    text = `'${text}`;
  }

  // escapado RFC 4180 cuando hay comas, punto y coma, comillas, saltos de linea o espacios extremos
  if (/[",;\n]/.test(text) || /^\s|\s$/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function recordsToCsv(
  records: Record<string, any>[],
  entityOrColumns?: ExportEntity | CsvColumn[] | string[]
): string {
  let columns: CsvColumn[] = [];

  if (typeof entityOrColumns === 'string' && REPORT_COLUMNS[entityOrColumns]) {
    columns = [...REPORT_COLUMNS[entityOrColumns]];
  } else if (Array.isArray(entityOrColumns) && entityOrColumns.length > 0) {
    columns = entityOrColumns.map((col) =>
      typeof col === 'string' ? { key: col, header: col } : col
    );
  }

  // agregar cualquier columna adicional presente en los registros
  const knownKeys = new Set(columns.map((c) => c.key));
  records.forEach((row) => {
    if (row && typeof row === 'object') {
      Object.keys(row).forEach((key) => {
        if (!knownKeys.has(key)) {
          knownKeys.add(key);
          columns.push({ key, header: key });
        }
      });
    }
  });

  const headerLine = columns.map((col) => formatCsvCell(col.header)).join(',');
  const dataLines = records.map((row) =>
    columns.map((col) => formatCsvCell(row ? row[col.key] : '')).join(',')
  );

  // prefijo UTF-8 BOM (\uFEFF) para que Excel/Sheets reconozca tildes y eñes en español
  return '\uFEFF' + [headerLine, ...dataLines].join('\r\n') + '\r\n';
}

export interface CsvExportResult {
  fileName: string;
  fileUri: string;
  rowCount: number;
}

// genera un archivo .csv independiente en el almacenamiento temporal de la app y abre el menu nativo para compartirlo
export async function exportRecordsToCsvFile(
  entity: ExportEntity,
  records: Record<string, any>[],
  reportTitle?: string
): Promise<CsvExportResult> {
  const csvContent = recordsToCsv(records, entity);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `fitmanager_${entity}_${dateStamp}.csv`;

  const csvFile = new File(Paths.cache, fileName);
  csvFile.create({ overwrite: true, intermediates: true });
  await csvFile.write(csvContent, { encoding: EncodingType.UTF8 });

  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    throw new Error('la función para compartir archivos no está disponible en este dispositivo');
  }

  await Sharing.shareAsync(csvFile.uri, {
    mimeType: 'text/csv',
    dialogTitle: reportTitle ? `Exportar informe: ${reportTitle}` : `Exportar ${fileName}`,
    UTI: 'public.comma-separated-values-text'
  });

  return {
    fileName,
    fileUri: csvFile.uri,
    rowCount: records.length
  };
}
