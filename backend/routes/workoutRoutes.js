import { Router } from 'express';
import {
  createSession,
  addSetToSession,
  getWorkoutHistory,
  getLastExerciseLog,
  getExerciseHistory,
  updateSet,
  deleteSet,
  finishSession,
  getActiveSession,
  getSessionById
} from '../controllers/workoutController.js';
import { verifyToken, requireRole } from '../middlewares/authMiddleware.js';

const router = Router();

// Todas las rutas de entrenamientos requieren autenticacion estricta con JWT
router.use(verifyToken);

// 1. Sesiones de entrenamiento
// - Obtener sesion activa en curso (si existe) para el usuario autenticado
router.get('/sessions/active', requireRole('member', 'admin'), getActiveSession);

// - Consultar detalle completo y series de una sesion puntual por ID
router.get('/sessions/:sessionId', getSessionById);

// - Registrar una nueva sesion (socio o admin)
router.post('/sessions', requireRole('member', 'admin'), createSession);

// - Finalizar sesion de entrenamiento
router.patch('/sessions/:sessionId/finish', requireRole('member', 'admin'), finishSession);

// - Agregar una serie individual a una sesion activa
router.post('/sessions/:sessionId/sets', requireRole('member', 'admin'), addSetToSession);

// 2. Consultas de historial
// - Historial de entrenamientos: socio ve el propio; entrenador ve el de sus alumnos; admin ve cualquiera
router.get('/history', getWorkoutHistory);

// - Ultimo peso/reps registrados de un ejercicio puntual
router.get('/exercises/:exerciseId/last', getLastExerciseLog);

// - Historial cronologico de un ejercicio puntual
router.get('/exercises/:exerciseId/history', getExerciseHistory);

// 3. Gestion de series individuales (correcion / anulacion)
// - Exclusivo para el socio dueño del registro (controlado dentro del controller con req.user.id)
router.patch('/sets/:id', requireRole('member', 'admin'), updateSet);
router.delete('/sets/:id', requireRole('member', 'admin'), deleteSet);

export default router;
