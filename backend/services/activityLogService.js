import pool from '../config/db.js';

/**
 * Registra una acción en la bitácora del sistema (activity_logs).
 * Maneja silenciosamente posibles errores para no interrumpir el flujo transaccional principal.
 * 
 * @param {Object} params
 * @param {number|null} params.userId - ID del usuario que ejecuta la acción
 * @param {string} params.actionType - Identificador del tipo de acción (ej. CREATE_USER, UPDATE_EXERCISE)
 * @param {string} params.category - Categoría ('users', 'routines', 'exercises', 'incidents', 'notifications', 'auth', 'system')
 * @param {string} params.description - Detalle legible de la acción realizada
 * @param {Object|null} [params.metadata] - Datos adicionales opcionales en JSON
 */
export async function logActivity({ userId, actionType, category, description, metadata = null }) {
  try {
    const metaString = metadata ? JSON.stringify(metadata) : null;
    await pool.execute(
      'INSERT INTO activity_logs (user_id, action_type, category, description, metadata) VALUES (?, ?, ?, ?, ?)',
      [userId || null, actionType, category, description, metaString]
    );
  } catch (error) {
    // Si la tabla no existe aún o hay un error de red temporal, registramos en log sin romper la app
    console.error('[activityLogService] Error al registrar actividad:', error.message);
  }
}

