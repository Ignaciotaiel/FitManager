import { Router } from 'express';
import {
  listUsers,
  getUserById,
  updateUserRoleOrStatus
} from '../controllers/userController.js';
import { verifyToken, requireRole } from '../middlewares/authMiddleware.js';

const router = Router();

// todas las rutas de usuarios requieren token valido
router.use(verifyToken);

// listar todos los usuarios: permitido exclusivamente a administradores
router.get('/', requireRole('admin'), listUsers);

// ver detalle de usuario: admin, trainer o el propio usuario (validado en controlador)
router.get('/:id', getUserById);

// actualizar rol o estado: permitido unicamente a administradores
router.patch('/:id', requireRole('admin'), updateUserRoleOrStatus);

export default router;
