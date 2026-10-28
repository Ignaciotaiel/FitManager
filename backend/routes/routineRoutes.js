import { Router } from 'express';
import {
  listRoutines,
  getRoutineById,
  createRoutine,
  updateRoutine,
  assignMembersToRoutine,
  removeMemberAssignment,
  deleteRoutine
} from '../controllers/routineController.js';
import { verifyToken, requireRole } from '../middlewares/authMiddleware.js';

const router = Router();

// todas las rutas de rutinas requieren token jwt
router.use(verifyToken);

// consulta: admin ve todas, trainer ve sus creadas, member ve sus asignadas
router.get('/', listRoutines);
router.get('/:id', getRoutineById);

// creacion, edicion y eliminacion: solo admin y trainer
router.post('/', requireRole('admin', 'trainer'), createRoutine);
router.patch('/:id', requireRole('admin', 'trainer'), updateRoutine);
router.delete('/:id', requireRole('admin', 'trainer'), deleteRoutine);

// gestion de asignaciones de socios: solo admin y trainer propietario
router.post('/:id/assignments', requireRole('admin', 'trainer'), assignMembersToRoutine);
router.delete('/:id/assignments/:memberId', requireRole('admin', 'trainer'), removeMemberAssignment);

export default router;
