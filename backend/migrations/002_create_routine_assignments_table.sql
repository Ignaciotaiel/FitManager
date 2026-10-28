-- ==============================================================================
-- Migración: 002_create_routine_assignments_table.sql
-- Descripción: Tabla intermedia para asignación muchos-a-muchos entre rutinas y socios
-- Motor: MariaDB 10.4+ / MySQL 8.0+
-- NOTA DE SEGURIDAD:
--  - NO ejecutar sin autorización explícita del usuario.
--  - NO elimina el campo routines.member_id para garantizar retrocompatibilidad.
--  - Migra de forma segura las asignaciones preexistentes de routines.member_id.
-- ==============================================================================

-- 1. Tabla de Asignaciones de Rutinas (Muchos a Muchos)
CREATE TABLE IF NOT EXISTS routine_assignments (
  id INT(11) NOT NULL AUTO_INCREMENT,
  routine_id INT(11) NOT NULL,
  member_id INT(11) NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_routine_member (routine_id, member_id),
  KEY idx_routine_assignments_member (member_id),
  KEY idx_routine_assignments_routine (routine_id),
  CONSTRAINT fk_routine_assignments_routine FOREIGN KEY (routine_id) REFERENCES routines (id) ON DELETE CASCADE,
  CONSTRAINT fk_routine_assignments_member FOREIGN KEY (member_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Migración de datos históricos (Preserva asignaciones previas si existen)
-- Copia automáticamente cualquier asignación existente de routines.member_id a la nueva tabla sin duplicar
INSERT IGNORE INTO routine_assignments (routine_id, member_id, assigned_at)
SELECT id AS routine_id, member_id, created_at AS assigned_at
FROM routines
WHERE member_id IS NOT NULL;
