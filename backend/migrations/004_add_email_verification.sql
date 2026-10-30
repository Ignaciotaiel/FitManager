-- ==============================================================================
-- Migración: 004_add_email_verification.sql
-- Motor: MariaDB 10.4+ / MySQL 8.0+ (Layerbase)
-- Descripción:
--   1. Crea la tabla `auth_codes` para hashes SHA-256 de verificación.
--   2. Añade la columna `email_verified_at` a la tabla `users` (idempotente).
--   3. Ejecuta el backfill de usuarios históricos utilizando un CUTOFF_ID literal,
--      independiente de variables de sesión.
-- ==============================================================================

-- ==============================================================================
-- INSTRUCCIÓN 1: Crear tabla `auth_codes` (si no existe)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS auth_codes (
  id INT(11) NOT NULL AUTO_INCREMENT,
  user_id INT(11) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  type ENUM('email_verification', 'password_reset', '2fa_login') NOT NULL DEFAULT 'email_verification',
  attempts INT(11) NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_auth_codes_user_type_used (user_id, type, used_at),
  INDEX idx_auth_codes_expires (expires_at),
  CONSTRAINT fk_auth_codes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- INSTRUCCIÓN 2: Añadir columna `email_verified_at` en `users` (si no existe)
-- ==============================================================================
-- Nota: En consolas que no admiten bloques condicionales dinámicos, podés ejecutar
-- primero: SHOW COLUMNS FROM users LIKE 'email_verified_at';
-- Si no existe, ejecutar directamente:
-- ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL AFTER email;
SET @dbname = DATABASE();
SET @columnAlreadyExisted = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'email_verified_at'
);

SET @alterStmtSql = (SELECT IF(
  @columnAlreadyExisted > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL AFTER email'
));
PREPARE alterStmt FROM @alterStmtSql;
EXECUTE alterStmt;
DEALLOCATE PREPARE alterStmt;

-- ==============================================================================
-- INSTRUCCIÓN 3: Backfill de usuarios preexistentes con CUTOFF_ID LITERAL
-- ==============================================================================
-- REEMPLAZAR <CUTOFF_ID> por el número exacto obtenido de:
-- SELECT IFNULL(MAX(id), 0) FROM users;
-- Ejemplo: AND u.id <= 142
UPDATE users u
LEFT JOIN auth_codes ac ON ac.user_id = u.id AND ac.type = 'email_verification'
SET u.email_verified_at = NOW()
WHERE u.email_verified_at IS NULL
  AND u.id <= <CUTOFF_ID>
  AND ac.id IS NULL;
