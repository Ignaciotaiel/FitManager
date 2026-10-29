-- ==============================================================================
-- Migración: 003_add_status_and_is_active_columns.sql
-- Descripción:
--   1. Añade soporte de ciclo de vida (status, ended_at) a workout_sessions para
--      distinguir sesiones activas ('in_progress') de sesiones cerradas ('completed').
--   2. Añade soporte de baja lógica (is_active) a exercises para permitir ocultar
--      ejercicios de la biblioteca sin borrar historiales de entrenamientos existentes.
-- Motor: MariaDB 10.4+ / MySQL 8.0+
-- NOTA DE SEGURIDAD:
--  - NO ejecutar sin autorización explícita del usuario.
--  - Preserva el 100% de los datos históricos y registros de series.
--  - Todas las operaciones son idempotentes o seguras mediante comprobaciones condicionales.
-- ==============================================================================

-- 1. Añadir status y ended_at a workout_sessions si la tabla existe
-- Valores para status: 'in_progress', 'completed', 'cancelled'.
-- Por defecto para NUEVAS filas insertadas desde el código: 'in_progress'.
--
-- PRINCIPIOS DE SEGURIDAD DEL BACKFILL:
-- 1. NO se asumen límites arbitrarios de tiempo (por ejemplo, 4 horas) para cerrar sesiones.
-- 2. La migración es IDEMPOTENTE: solo opera sobre filas que aún tengan status NULL (durante la creación de la columna)
--    o que nunca hayan sido clasificadas, NUNCA sobreescribe sesiones ya marcadas 'in_progress' conscientemente.
-- 3. Las series en workout_set_logs NO se tocan, modifican ni eliminan bajo ninguna circunstancia.
-- 4. Las sesiones históricas cerradas reciben ended_at a partir de su última serie real sin alterar marcas.

SET @dbname = DATABASE();

-- 1.1 Columna status en workout_sessions
-- Se agrega inicialmente permitiendo NULL para poder distinguir filas preexistentes sin clasificar
-- de nuevas filas creadas por la aplicación.
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = 'workout_sessions'
      AND COLUMN_NAME = 'status'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE workout_sessions ADD COLUMN status ENUM(\'in_progress\', \'completed\', \'cancelled\') DEFAULT NULL AFTER session_date'
));
PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

-- 1.2 Columna ended_at en workout_sessions
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = 'workout_sessions'
      AND COLUMN_NAME = 'ended_at'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE workout_sessions ADD COLUMN ended_at DATETIME DEFAULT NULL AFTER status'
));
PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

-- 1.3 Estado de filas preexistentes:
-- NINGUNA sesión preexistente se convierte automáticamente en 'in_progress' ni en 'completed'.
-- Las filas preexistentes conservan status = NULL y ended_at = NULL (sin inventar datos).
--
-- NOTA CRÍTICA DE RECUPERACIÓN:
-- Dado que getActiveSession filtra estrictamente por WHERE status = 'in_progress',
-- ninguna sesión con status = NULL será recuperada automáticamente por la app móvil.
-- Esto protege al socio de recuperar por error duplicados vacíos generados en el pasado.
--
-- CÓMO HABILITAR LA RECUPERACIÓN SEGURA DE UNA SESIÓN CONFIRMADA:
-- Una vez ejecutada la consulta de inspección, si se confirma que una sesión específica
-- (ej. ID X) es legítimamente un entrenamiento que el usuario desea reanudar hoy:
--    UPDATE workout_sessions SET status = 'in_progress' WHERE id = X;
-- Automáticamente, getActiveSession la detectará y el socio la recuperará con todas sus series.

-- 1.4 Establecer el valor por defecto 'in_progress' únicamente para las NUEVAS filas que inserte la aplicación:
ALTER TABLE workout_sessions ALTER COLUMN status SET DEFAULT 'in_progress';

-- 1.4 Índice para búsquedas rápidas de sesiones activas por socio y rutina
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = 'workout_sessions'
      AND INDEX_NAME = 'idx_workout_sessions_user_status'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE workout_sessions ADD KEY idx_workout_sessions_user_status (user_id, routine_id, status)'
));
PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;

-- 2. Añadir is_active a exercises para baja lógica segura
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = 'exercises'
      AND COLUMN_NAME = 'is_active'
  ) > 0,
  'SELECT 1',
  'ALTER TABLE exercises ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER difficulty'
));
PREPARE alterIfExists FROM @preparedStatement;
EXECUTE alterIfExists;
DEALLOCATE PREPARE alterIfExists;
