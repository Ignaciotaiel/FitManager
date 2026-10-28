import { Router } from 'express';
import {
  listMemberships,
  getMyMembership,
  getMembershipById,
  createMembership,
  updateMembership
} from '../controllers/membershipController.js';
import { verifyToken, requireRole } from '../middlewares/authMiddleware.js';

const router = Router();

// todas las rutas de membresias requieren token jwt autenticado
router.use(verifyToken);

// consulta de la propia membresia: accesible por member y admin (usa estrictamente req.user.id)
router.get('/my', requireRole('member', 'admin'), getMyMembership);

// rutas administrativas: restringidas a admin
router.get('/', requireRole('admin'), listMemberships);
router.get('/:id', requireRole('admin'), getMembershipById);
router.post('/', requireRole('admin'), createMembership);
router.patch('/:id', requireRole('admin'), updateMembership);

export default router;
