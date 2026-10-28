import { Router } from 'express';
import {
  listExercises,
  getExerciseById,
  createExercise,
  updateExercise,
  deleteExercise
} from '../controllers/exerciseController.js';
import { verifyToken, requireRole } from '../middlewares/authMiddleware.js';

const router = Router();

// todos los endpoints de ejercicios requieren sesion autenticada
router.use(verifyToken);

// consulta: accesible para admin, trainer y member
router.get('/', listExercises);
router.get('/:id', getExerciseById);

// creacion y edicion: solo para admin y trainer
router.post('/', requireRole('admin', 'trainer'), createExercise);
router.patch('/:id', requireRole('admin', 'trainer'), updateExercise);

// eliminacion: exclusivamente para rol admin
router.delete('/:id', requireRole('admin'), deleteExercise);

export default router;
