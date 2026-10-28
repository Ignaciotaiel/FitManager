-- ==============================================================================
-- Migración: 001_create_workouts_tables.sql
-- Descripción: Tablas para registrar sesiones de entrenamiento e historial de series
-- Motor: MariaDB 10.4+ / MySQL 8.0+
-- NOTA DE SEGURIDAD:
--  - NO ejecutar sin autorización explícita del usuario.
--  - NO modifica ni elimina las tablas users, routines, routine_exercises ni exercises.
--  - fk_workout_sessions_routine usa ON DELETE SET NULL para evitar que borrar una
--    rutina elimine el historial de entrenamientos del usuario.
-- ==============================================================================

-- 1. Tabla de Sesiones de Entrenamiento
CREATE TABLE IF NOT EXISTS workout_sessions (
  id INT(11) NOT NULL AUTO_INCREMENT,
  user_id INT(11) NOT NULL,
  routine_id INT(11) DEFAULT NULL,
  session_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_workout_sessions_user_date (user_id, session_date),
  KEY idx_workout_sessions_routine (routine_id),
  CONSTRAINT fk_workout_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_workout_sessions_routine FOREIGN KEY (routine_id) REFERENCES routines (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de Registro de Series (Kilos, Repeticiones e Historial)
CREATE TABLE IF NOT EXISTS workout_set_logs (
  id INT(11) NOT NULL AUTO_INCREMENT,
  session_id INT(11) NOT NULL,
  user_id INT(11) NOT NULL,
  exercise_id INT(11) NOT NULL,
  routine_exercise_id INT(11) DEFAULT NULL,
  set_number INT(11) NOT NULL,
  weight_kg DECIMAL(6, 2) NOT NULL,
  reps_completed INT(11) NOT NULL,
  rpe DECIMAL(3, 1) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_workout_set_logs_session (session_id),
  KEY idx_workout_set_logs_user_exercise_date (user_id, exercise_id, created_at),
  KEY idx_workout_set_logs_routine_ex (routine_exercise_id),
  CONSTRAINT fk_workout_set_logs_session FOREIGN KEY (session_id) REFERENCES workout_sessions (id) ON DELETE CASCADE,
  CONSTRAINT fk_workout_set_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_workout_set_logs_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE,
  CONSTRAINT fk_workout_set_logs_routine_ex FOREIGN KEY (routine_exercise_id) REFERENCES routine_exercises (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
