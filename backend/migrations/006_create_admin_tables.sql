-- ==============================================================================
-- Migración: 006_create_admin_tables.sql
-- Motor: MariaDB 10.4+ / MySQL 8.0+ (Layerbase)
-- Descripción:
--   1. Crea la tabla `activity_logs` para auditar acciones relevantes (usuarios,
--      rutinas, ejercicios, notificaciones, incidencias).
--   2. Crea la tabla `admin_notifications` para publicar comunicados internos dirigidos
--      a roles específicos (all, trainer, member).
--   3. Crea la tabla `incidents` para registrar y gestionar incidencias del gimnasio
--      con estados (pending, in_progress, resolved).
-- NOTA DE SEGURIDAD:
--   - Operación 100% idempotente (CREATE TABLE IF NOT EXISTS).
--   - No elimina, trunca ni modifica tablas ni datos existentes.
-- ==============================================================================

-- 1. Tabla de Registro de Actividades
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT(11) NOT NULL AUTO_INCREMENT,
  user_id INT(11) NULL DEFAULT NULL,
  action_type VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  metadata LONGTEXT NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_activity_logs_user (user_id),
  INDEX idx_activity_logs_category (category),
  INDEX idx_activity_logs_created_at (created_at),
  CONSTRAINT fk_activity_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de Centro de Notificaciones
CREATE TABLE IF NOT EXISTS admin_notifications (
  id INT(11) NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  target_role ENUM('all', 'trainer', 'member') NOT NULL DEFAULT 'all',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT(11) NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_admin_notif_target (target_role),
  INDEX idx_admin_notif_active (is_active),
  INDEX idx_admin_notif_created_by (created_by),
  INDEX idx_admin_notif_created_at (created_at),
  CONSTRAINT fk_admin_notif_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla de Gestión de Incidencias
CREATE TABLE IF NOT EXISTS incidents (
  id INT(11) NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category ENUM('equipment', 'facility', 'safety', 'cleanliness', 'other') NOT NULL DEFAULT 'other',
  status ENUM('pending', 'in_progress', 'resolved') NOT NULL DEFAULT 'pending',
  created_by INT(11) NULL DEFAULT NULL,
  resolution_notes TEXT NULL DEFAULT NULL,
  resolved_at DATETIME NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_incidents_category (category),
  INDEX idx_incidents_status (status),
  INDEX idx_incidents_created_by (created_by),
  INDEX idx_incidents_created_at (created_at),
  CONSTRAINT fk_incidents_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
