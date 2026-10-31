-- ==============================================================================
-- Migración: 005_create_password_resets_table.sql
-- Motor: MariaDB 10.4+ / MySQL 8.0+ (Layerbase)
-- Descripción:
--   1. Crea la tabla independiente `password_resets` para gestionar solicitudes
--      de recuperación de contraseña con código numérico (SHA-256) y autorización
--      temporal de cambio (reset_token de un solo uso).
--   2. Añade la columna `token_version` a la tabla `users` (idempotente) para
--      invalidación atómica de todas las sesiones activas tras cambio de contraseña.
-- NOTA DE SEGURIDAD:
--   - NO ejecutar sin autorización explícita del usuario.
--   - Todas las operaciones son idempotentes y no bloquean tablas críticas.
-- ==============================================================================

-- ==============================================================================
-- INSTRUCCIÓN 1: Crear tabla `password_resets` (si no existe)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS password_resets (
  id INT(11) NOT NULL AUTO_INCREMENT,
  user_id INT(11) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  attempts INT(11) NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL DEFAULT NULL,
  reset_token_hash VARCHAR(255) NULL DEFAULT NULL,
  reset_token_expires_at DATETIME NULL DEFAULT NULL,
  reset_completed_at DATETIME NULL DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_pwd_resets_user_used (user_id, used_at),
  INDEX idx_pwd_resets_token (reset_token_hash),
  INDEX idx_pwd_resets_expires (expires_at),
  CONSTRAINT fk_pwd_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- INSTRUCCIÓN 2: Añadir columna `token_version` en `users` (si no existe)
-- ==============================================================================
SET @dbname = DATABASE();
SET @columnAlreadyExisted = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'token_version'
);

SET @alterStmtSql = (SELECT IF(
  @columnAlreadyExisted > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN token_version INT(11) NOT NULL DEFAULT 1 AFTER role'
));
PREPARE alterStmt FROM @alterStmtSql;
EXECUTE alterStmt;
DEALLOCATE PREPARE alterStmt;
