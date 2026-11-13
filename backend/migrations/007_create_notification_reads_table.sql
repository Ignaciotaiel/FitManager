-- ============================================================================
-- Migration 007: Registro individual de avisos leídos por usuario
-- Permite controlar de forma independiente qué socio o entrenador leyó cada aviso
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_reads (
  id INT(11) NOT NULL AUTO_INCREMENT,
  notification_id INT(11) NOT NULL,
  user_id INT(11) NOT NULL,
  read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notification_user (notification_id, user_id),
  INDEX idx_notif_reads_user (user_id),
  INDEX idx_notif_reads_notification (notification_id),
  CONSTRAINT fk_notif_reads_notification FOREIGN KEY (notification_id) REFERENCES admin_notifications (id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_reads_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

